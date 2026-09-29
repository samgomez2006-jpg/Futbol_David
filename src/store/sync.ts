import { supabase } from '../lib/supabase';
import { normalizeDataset, normalizeTeam } from '../lib/normalize';
import { TABLES, emptyDataset, emptyProfile, type Dataset, type Team } from '../lib/types';
import { enqueueEverything, newGuestTeam, persistNow, setChangeListener, useStore, type Mutation } from './store';

// ---------------------------------------------------------------------------
// Motor de sincronización (last-write-wins por registro).
//  - flush(): sube la cola `outbox` en orden seguro para las FK.
//  - pull():  descarga todo el equipo y lo fusiona respetando lo pendiente de subir.
// Los datos de un equipo son pequeños (cientos de filas), así que un pull completo es
// más simple y robusto que un sync incremental.
// ---------------------------------------------------------------------------

const ORDER = ['teams', ...TABLES];
const PAGE = 1000;

let flushing: Promise<void> | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;

/** Error de red/servidor temporal → reintentar más tarde. Error de datos/permisos → descartar. */
function isTransient(err: { code?: string; message?: string; status?: number } | null): boolean {
  if (!err) return false;
  if (!err.code) return true; // fetch falló (sin conexión)
  return err.code === 'PGRST301' || err.code.startsWith('08') || err.code === '57014' || /fetch|network/i.test(err.message ?? '');
}

async function run(m: Mutation) {
  const sb = supabase!;
  if (m.table === 'teams') return sb.from('teams').update(m.row!).eq('id', m.rowId);
  if (m.op === 'delete') return sb.from(m.table).delete().eq('id', m.rowId);
  const row = { ...m.row };
  delete row.updated_at; // lo pone el servidor
  return sb.from(m.table).upsert(row);
}

export function flush(): Promise<void> {
  if (!supabase || useStore.getState().mode !== 'cloud') return Promise.resolve();
  if (flushing) return flushing;
  flushing = (async () => {
    const st = useStore.getState();
    if (!st.outbox.length) return;
    st._set({ sync: 'syncing' });
    const queue = [...st.outbox].sort((a, b) => {
      if (a.op !== b.op) return a.op === 'upsert' ? -1 : 1; // altas antes que bajas
      const d = ORDER.indexOf(a.table) - ORDER.indexOf(b.table);
      return a.op === 'upsert' ? d : -d; // padres antes al crear, hijos antes al borrar
    });
    for (const m of queue) {
      const { error } = await run(m);
      if (error && isTransient(error)) {
        useStore.getState()._set({ sync: 'offline' });
        return;
      }
      const s = useStore.getState();
      s._set({
        outbox: s.outbox.filter((x) => x.id !== m.id),
        syncError: error ? `No se pudo guardar un cambio en ${m.table}: ${error.message}` : s.syncError,
      });
    }
    useStore.getState()._set({ sync: useStore.getState().syncError ? 'error' : 'idle' });
  })().finally(() => {
    flushing = null;
  });
  return flushing;
}

async function fetchAll(table: string, teamId: string) {
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase!.from(table).select('*').eq('team_id', teamId).range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...data);
    if (data.length < PAGE) return rows;
  }
}

export async function pull(): Promise<void> {
  if (!supabase) return;
  const st = useStore.getState();
  if (st.mode !== 'cloud') return;
  st._set({ sync: 'syncing' });
  try {
    const teamId = st.team.id;
    const { data: team, error } = await supabase.from('teams').select('id,name,season,category,invite_code,profile').eq('id', teamId).maybeSingle();
    if (error) throw error;
    if (!team) {
      // Ya no somos miembros (o el equipo fue borrado).
      st._set({ sync: 'error', syncError: 'Ya no tienes acceso a este equipo.' });
      return;
    }
    const remote = emptyDataset();
    const results = await Promise.all(TABLES.map((t) => fetchAll(t, teamId)));
    TABLES.forEach((t, i) => ((remote as unknown as Record<string, unknown[]>)[t] = results[i]));

    // Fusión: lo pendiente de subir gana sobre lo remoto.
    const now = useStore.getState();
    const merged = emptyDataset();
    for (const t of TABLES) {
      const pending = now.outbox.filter((m) => m.table === t);
      const pendingIds = new Set(pending.map((m) => m.rowId));
      const localPending = (now.data[t] as { id: string }[]).filter((r) => pendingIds.has(r.id));
      const deleted = new Set(pending.filter((m) => m.op === 'delete').map((m) => m.rowId));
      (merged as unknown as Record<string, unknown[]>)[t] = [
        ...(remote[t] as { id: string }[]).filter((r) => !pendingIds.has(r.id) && !deleted.has(r.id)),
        ...localPending,
      ];
    }
    const teamPending = now.outbox.some((m) => m.table === 'teams');
    now._set({
      data: normalizeDataset(merged),
      team: teamPending ? { ...now.team, invite_code: team.invite_code } : normalizeTeam(team as Team),
      lastSyncAt: new Date().toISOString(),
      sync: now.syncError ? 'error' : 'idle',
    });
  } catch (e) {
    const err = e as { code?: string; message?: string };
    useStore.getState()._set({ sync: isTransient(err) ? 'offline' : 'error', syncError: isTransient(err) ? null : err.message ?? 'Error de sincronización' });
  }
}

export async function syncNow() {
  await flush();
  await pull();
}

export function scheduleSync(delay = 1200) {
  clearTimeout(timer);
  timer = setTimeout(() => void flush(), delay);
}

setChangeListener(() => scheduleSync());

// ---------------------------------------------------------------------------
// Conexión de la cuenta con el equipo
// ---------------------------------------------------------------------------

export type LocalStrategy = 'merge' | 'discard';

export type MyTeam = Team & { role: 'owner' | 'coach' };

export async function myTeams(userId: string): Promise<MyTeam[]> {
  const { data, error } = await supabase!
    .from('team_members')
    .select('role,teams(id,name,season,category,invite_code,profile)')
    .eq('user_id', userId);
  if (error) throw error;
  return (data ?? [])
    .map((r) => r as unknown as { role: 'owner' | 'coach'; teams: Team | null })
    .filter((r) => r.teams)
    .map((r) => ({ ...normalizeTeam(r.teams!), role: r.role }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

export const hasLocalData = () => {
  const d = useStore.getState().data;
  return TABLES.some((t) => d[t].length > 0);
};

interface Who {
  userId: string;
  email: string | null;
}

/** Crea el equipo en la nube. Con `keepLocal` sube los datos que ya hay en este dispositivo. */
export async function createCloudTeam(who: Who, input: { name: string; season: string; category: string }, opts: { keepLocal: boolean; extra?: Dataset }) {
  if (!supabase) throw new Error('Supabase no configurado');
  const st = useStore.getState();
  const local = opts.keepLocal ? st.data : emptyDataset();
  const id = opts.keepLocal ? st.team.id : crypto.randomUUID();
  const { data, error } = await supabase.rpc('create_team', { p_name: input.name, p_season: input.season, p_category: input.category, p_id: id });
  if (error) throw error;
  const remote = normalizeTeam(data as Team);
  const profile = opts.keepLocal ? st.team.profile : emptyProfile();
  st._set({ mode: 'cloud', ownerId: who.userId, team: { ...remote, profile }, data: local, stash: {}, outbox: [], userEmail: who.email, syncError: null });
  useStore.getState()._set({ outbox: enqueueEverything() });
  if (opts.extra) useStore.getState().bulkAdd(opts.extra);
  await persistNow();
  await syncNow();
}

export async function adoptTeam(who: Who, team: Team, strategy: LocalStrategy) {
  const st = useStore.getState();
  const local = strategy === 'merge' ? st.data : emptyDataset();
  st._set({ mode: 'cloud', ownerId: who.userId, team, data: emptyDataset(), stash: {}, outbox: [], userEmail: who.email, syncError: null });
  if (strategy === 'merge' && TABLES.some((t) => local[t].length)) useStore.getState().bulkAdd(local as Dataset);
  await persistNow();
  await syncNow();
}

export async function joinWithCode(who: Who, code: string, strategy: LocalStrategy) {
  if (!supabase) throw new Error('Supabase no configurado');
  const { data, error } = await supabase.rpc('join_team', { p_code: code });
  if (error) throw new Error(error.code === 'P0002' ? 'Código de invitación no válido' : error.message);
  await adoptTeam(who, normalizeTeam(data as Team), strategy);
}

// ---------------------------------------------------------------------------
// Varios equipos por cuenta. El equipo activo vive en `team`/`data`; los demás quedan en `stash`.
// Todos los datos cuelgan de team_id, así que cambiar de equipo cambia toda la app sin mezclar nada.
// ---------------------------------------------------------------------------

/** Aparta el equipo activo en la caché y activa el indicado (con su caché o vacío). */
function activate(target: Team) {
  const st = useStore.getState();
  const stash = { ...st.stash };
  if (st.team.id !== target.id) stash[st.team.id] = { team: st.team, data: st.data };
  const cached = stash[target.id];
  delete stash[target.id];
  st._set({ team: cached ? { ...cached.team, ...target } : target, data: cached?.data ?? emptyDataset(), stash, syncError: null });
}

/** Cambia de equipo: sube lo pendiente, activa el otro y lo actualiza desde la nube. */
export async function switchTeam(target: Team) {
  const st = useStore.getState();
  if (st.mode !== 'cloud' || st.team.id === target.id) return;
  await flush();
  activate(target);
  await persistNow();
  await pull();
}

/** Crea un equipo más en la cuenta (sin tocar los existentes) y lo deja activo. */
export async function addTeam(input: { name: string; season: string; category: string }, extra?: Dataset, profile?: Team['profile']) {
  if (!supabase) throw new Error('Supabase no configurado');
  await flush();
  const { data, error } = await supabase.rpc('create_team', { p_name: input.name, p_season: input.season, p_category: input.category, p_id: crypto.randomUUID() });
  if (error) throw error;
  const created = normalizeTeam(data as Team);
  activate(created);
  if (profile) useStore.getState().updateTeam({ profile });
  if (extra) useStore.getState().bulkAdd(extra);
  await persistNow();
  await syncNow();
  return created;
}

/** Cuenta de registros de un equipo (para avisar antes de borrarlo). */
export async function teamCounts(teamId: string): Promise<Record<TableNameLite, number>> {
  const out = {} as Record<TableNameLite, number>;
  await Promise.all(
    TABLES.map(async (t) => {
      const { count, error } = await supabase!.from(t).select('id', { count: 'exact', head: true }).eq('team_id', teamId);
      if (error) throw error;
      out[t] = count ?? 0;
    }),
  );
  return out;
}
type TableNameLite = (typeof TABLES)[number];

/**
 * Elimina un equipo. Propietario: se borra el equipo y TODOS sus datos (cascada en la base de datos).
 * Cuerpo técnico: solo abandona el equipo. Devuelve el equipo que queda activo (o null si no queda ninguno).
 */
export async function removeTeam(target: MyTeam, userId: string): Promise<MyTeam | null> {
  if (!supabase) throw new Error('Supabase no configurado');
  await flush();
  const q = target.role === 'owner'
    ? supabase.from('teams').delete().eq('id', target.id).select('id')
    : supabase.from('team_members').delete().eq('team_id', target.id).eq('user_id', userId).select('team_id');
  const { data, error } = await q;
  if (error) throw error;
  if (!data?.length) throw new Error('No se pudo eliminar el equipo (¿sin permisos?)');

  const st = useStore.getState();
  // Nada pendiente de un equipo que ya no existe.
  const outbox = st.outbox.filter((m) => (m.row as { team_id?: string } | undefined)?.team_id !== target.id && m.rowId !== target.id);
  const stash = { ...st.stash };
  delete stash[target.id];
  st._set({ outbox, stash });

  const rest = await myTeams(userId);
  if (st.team.id !== target.id) return null;
  const next = rest[0];
  if (!next) {
    resetLocal();
    await persistNow();
    return null;
  }
  activate(next);
  await persistNow();
  await pull();
  return next;
}

/** Deja el dispositivo limpio (sin datos de ninguna cuenta). */
export function resetLocal() {
  useStore.getState()._set({
    mode: 'guest', ownerId: null, team: newGuestTeam(), data: emptyDataset(), stash: {}, outbox: [], userEmail: null,
    lastSyncAt: null, sync: 'idle', syncError: null,
  });
}

/** Cierra sesión: sube lo pendiente y borra los datos del dispositivo (siguen en la nube). */
export async function signOut() {
  await flush();
  await supabase?.auth.signOut();
  resetLocal();
  await persistNow();
}

let started = false;
/** Arranque: enganchamos red y ciclo de vida para sincronizar. La sesión la gestiona store/auth.ts. */
export function startSync() {
  if (!supabase || started) return;
  started = true;
  window.addEventListener('online', () => void syncNow());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void syncNow();
  });
  setInterval(() => {
    if (document.visibilityState === 'visible') void syncNow();
  }, 120_000);
}
