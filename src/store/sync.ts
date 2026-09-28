import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { TABLES, emptyDataset, type Dataset, type Team } from '../lib/types';
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
    const { data: team, error } = await supabase.from('teams').select('id,name,season,category,invite_code').eq('id', teamId).maybeSingle();
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
      data: merged,
      team: teamPending ? { ...now.team, invite_code: team.invite_code } : (team as Team),
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

async function myTeams(userId: string): Promise<Team[]> {
  const { data, error } = await supabase!
    .from('team_members')
    .select('teams(id,name,season,category,invite_code)')
    .eq('user_id', userId);
  if (error) throw error;
  return (data ?? []).map((r) => (r as unknown as { teams: Team }).teams).filter(Boolean);
}

export const hasLocalData = () => {
  const d = useStore.getState().data;
  return TABLES.some((t) => d[t].length > 0);
};

/**
 * Tras iniciar sesión. Si el usuario no tiene equipo, se crea con el equipo local y se suben los datos.
 * Si ya tiene equipo, los datos locales de invitado se fusionan o descartan según `strategy`.
 */
export async function connectAccount(session: Session, strategy: LocalStrategy = 'merge'): Promise<'created' | 'joined'> {
  if (!supabase) throw new Error('Supabase no configurado');
  const st = useStore.getState();
  const teams = await myTeams(session.user.id);
  if (!teams.length) {
    if (strategy === 'discard') st._set({ data: emptyDataset() });
    const { data, error } = await supabase.rpc('create_team', {
      p_name: st.team.name, p_season: st.team.season, p_category: st.team.category, p_id: st.team.id,
    });
    if (error) throw error;
    st._set({ mode: 'cloud', team: data as Team, userEmail: session.user.email ?? null });
    useStore.getState()._set({ outbox: enqueueEverything() });
    await persistNow();
    await syncNow();
    return 'created';
  }
  await adoptTeam(teams[0], strategy, session.user.email ?? null);
  return 'joined';
}

export async function joinWithCode(code: string, strategy: LocalStrategy) {
  if (!supabase) throw new Error('Supabase no configurado');
  const { data, error } = await supabase.rpc('join_team', { p_code: code });
  if (error) throw new Error(error.code === 'P0002' ? 'Código de invitación no válido' : error.message);
  const { data: u } = await supabase.auth.getUser();
  await adoptTeam(data as Team, strategy, u.user?.email ?? null);
}

async function adoptTeam(team: Team, strategy: LocalStrategy, email: string | null) {
  const st = useStore.getState();
  const local = strategy === 'merge' ? st.data : emptyDataset();
  st._set({ mode: 'cloud', team, data: emptyDataset(), outbox: [], userEmail: email, syncError: null });
  if (strategy === 'merge' && TABLES.some((t) => local[t].length)) useStore.getState().bulkAdd(local as Dataset);
  await persistNow();
  await syncNow();
}

/** Cierra sesión y deja el dispositivo como un invitado vacío (los datos quedan en la nube). */
export async function signOut() {
  await flush();
  await supabase?.auth.signOut();
  useStore.getState()._set({
    mode: 'guest', team: newGuestTeam(), data: emptyDataset(), outbox: [], userEmail: null,
    lastSyncAt: null, sync: 'idle', syncError: null,
  });
  await persistNow();
}

/** Arranque: engancha eventos de auth/red/ciclo de vida. */
export function startSync() {
  if (!supabase) return;
  supabase.auth.getSession().then(({ data }) => {
    const s = useStore.getState();
    if (data.session) {
      s._set({ userEmail: data.session.user.email ?? null });
      if (s.mode === 'cloud') void syncNow();
    }
  });
  supabase.auth.onAuthStateChange((_e, session) => {
    useStore.getState()._set({ userEmail: session?.user.email ?? null });
  });
  window.addEventListener('online', () => void syncNow());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void syncNow();
  });
  setInterval(() => {
    if (document.visibilityState === 'visible') void syncNow();
  }, 120_000);
}
