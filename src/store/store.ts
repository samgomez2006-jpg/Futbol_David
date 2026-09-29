import { create } from 'zustand';
import { parseBackup } from '../lib/backup';
import { TRASH_DAYS } from '../lib/constants';
import { currentSeason } from '../lib/dates';
import { uid } from '../lib/id';
import { normalizeDataset, normalizeProfile, normalizeTeam } from '../lib/normalize';
import { storage } from '../lib/storage';
import { emptyDataset, emptyProfile, TABLES, type Dataset, type TableName, type Team } from '../lib/types';

// ---------------------------------------------------------------------------
// Estado persistido
// ---------------------------------------------------------------------------
// Local-first: cada cambio se aplica al instante en memoria + disco y, si hay sesión,
// se encola en `outbox` para subirlo a Supabase cuando haya conexión.

export type SyncTable = TableName | 'teams';
export interface Mutation {
  id: string;
  table: SyncTable;
  op: 'upsert' | 'delete';
  rowId: string;
  row?: Record<string, unknown>;
}

export type Mode = 'guest' | 'cloud';
export type SyncStatus = 'idle' | 'syncing' | 'offline' | 'error';

interface Persisted {
  v: 6;
  mode: Mode;
  /** Usuario de Supabase al que pertenecen los datos en modo nube (aísla cuentas en un mismo dispositivo). */
  ownerId: string | null;
  team: Team;
  data: Dataset;
  outbox: Mutation[];
  lastSyncAt: string | null;
}

type Row<T extends TableName> = Dataset[T][number];

interface State extends Persisted {
  ready: boolean;
  userEmail: string | null;
  sync: SyncStatus;
  syncError: string | null;

  hydrate: () => Promise<void>;
  upsert: <T extends TableName>(table: T, row: Row<T>) => void;
  remove: (table: TableName, id: string) => void;
  updateTeam: (patch: Partial<Omit<Team, 'id'>>) => void;
  /** Añade datos en bloque (importación). Encola todo si hay nube. */
  bulkAdd: (data: Dataset) => void;
  _set: (patch: Partial<State>) => void;
}

const KEY = 'mef_state_v5';
const LEGACY_KEY = 'miecfc_v4';

export const newGuestTeam = (): Team => ({ id: uid(), name: 'Mi Equipo FC', season: currentSeason(), category: '', profile: emptyProfile() });

let saveTimer: ReturnType<typeof setTimeout> | undefined;
let onChange: (() => void) | null = null;
/** El módulo de sync se registra aquí para enterarse de cambios locales (evita import circular). */
export const setChangeListener = (fn: () => void) => (onChange = fn);

function persistSoon() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => void persistNow(), 150);
}
const snapshot = (): Persisted => {
  const s = useStore.getState();
  return { v: 6, mode: s.mode, ownerId: s.ownerId, team: s.team, data: s.data, outbox: s.outbox, lastSyncAt: s.lastSyncAt };
};
export async function persistNow() {
  clearTimeout(saveTimer);
  await storage.set(KEY, snapshot());
}

// Al cerrar la pestaña o pasar la app a segundo plano se guarda al instante (el guardado normal va con 150 ms de margen).
if (typeof window !== 'undefined') {
  const flushNow = () => {
    if (!useStore.getState().ready) return;
    clearTimeout(saveTimer);
    if (!storage.setSync(KEY, snapshot())) void persistNow();
  };
  window.addEventListener('pagehide', flushNow);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && flushNow());
}

/** Añade una mutación fusionándola con las pendientes del mismo registro. */
export function enqueue(outbox: Mutation[], m: Omit<Mutation, 'id'>): Mutation[] {
  const rest = outbox.filter((x) => !(x.table === m.table && x.rowId === m.rowId));
  return [...rest, { ...m, id: uid() }];
}

function purgeOldTrash(data: Dataset): { data: Dataset; purged: string[] } {
  const limit = Date.now() - TRASH_DAYS * 864e5;
  const purged = data.matches.filter((m) => m.deleted_at && Date.parse(m.deleted_at) < limit).map((m) => m.id);
  if (!purged.length) return { data, purged };
  return { data: { ...data, matches: data.matches.filter((m) => !purged.includes(m.id)) }, purged };
}

const teamRow = (t: Team) => ({ name: t.name, season: t.season, category: t.category, profile: t.profile });

export const useStore = create<State>((set, get) => ({
  v: 6,
  ready: false,
  mode: 'guest',
  ownerId: null,
  team: newGuestTeam(),
  data: emptyDataset(),
  outbox: [],
  lastSyncAt: null,
  userEmail: null,
  sync: 'idle',
  syncError: null,

  async hydrate() {
    type Stored = Omit<Persisted, 'v' | 'ownerId'> & { v: number; ownerId?: string | null };
    let p = await storage.get<Stored>(KEY);
    if (!p) {
      // Primera ejecución: intenta recuperar los datos del HTML original si están en este mismo origen.
      try {
        const legacy = localStorage.getItem(LEGACY_KEY);
        if (legacy) {
          const team = newGuestTeam();
          const parsed = parseBackup(JSON.parse(legacy), team.id);
          p = { v: 6, mode: 'guest', team: { ...team, ...parsed.team }, data: parsed.data, outbox: [], lastSyncAt: null };
        }
      } catch {
        /* datos antiguos corruptos: se ignoran */
      }
    }
    if (p) {
      const { data: clean, purged } = purgeOldTrash(normalizeDataset(p.data));
      let outbox = p.outbox ?? [];
      if (p.mode === 'cloud') for (const id of purged) outbox = enqueue(outbox, { table: 'matches', op: 'delete', rowId: id });
      set({
        mode: p.mode, ownerId: p.ownerId ?? null, team: normalizeTeam(p.team), data: clean, outbox,
        lastSyncAt: p.lastSyncAt ?? null,
      });
      if (purged.length || p.v !== 6) persistSoon();
    }
    set({ ready: true });
  },

  upsert(table, row) {
    const s = get();
    const r = { ...row, team_id: s.team.id, updated_at: new Date().toISOString() } as Row<typeof table>;
    const list = s.data[table] as Row<typeof table>[];
    const i = list.findIndex((x) => x.id === r.id);
    const next = i >= 0 ? list.map((x, j) => (j === i ? r : x)) : [...list, r];
    set({
      data: { ...s.data, [table]: next },
      outbox: s.mode === 'cloud' ? enqueue(s.outbox, { table, op: 'upsert', rowId: r.id, row: r as unknown as Record<string, unknown> }) : s.outbox,
    });
    persistSoon();
    onChange?.();
  },

  remove(table, id) {
    const s = get();
    const data = { ...s.data, [table]: (s.data[table] as { id: string }[]).filter((x) => x.id !== id) } as Dataset;
    // Borrados en cascada locales (en el servidor los hace la FK).
    if (table === 'players') {
      data.evaluations = data.evaluations.filter((e) => e.player_id !== id);
      data.objectives = data.objectives.filter((o) => o.player_id !== id);
    }
    if (table === 'callups') data.matches = data.matches.map((m) => (m.callup_id === id ? { ...m, callup_id: null } : m));
    set({ data, outbox: s.mode === 'cloud' ? enqueue(s.outbox, { table, op: 'delete', rowId: id }) : s.outbox });
    persistSoon();
    onChange?.();
  },

  updateTeam(patch) {
    const s = get();
    const team = { ...s.team, ...patch, profile: patch.profile ? normalizeProfile(patch.profile) : s.team.profile };
    set({
      team,
      outbox: s.mode === 'cloud' ? enqueue(s.outbox, { table: 'teams', op: 'upsert', rowId: team.id, row: teamRow(team) }) : s.outbox,
    });
    persistSoon();
    onChange?.();
  },

  bulkAdd(add) {
    const s = get();
    const data = { ...s.data };
    let outbox = s.outbox;
    const now = new Date().toISOString();
    for (const t of TABLES) {
      const rows = (add[t] as { id: string }[]).map((r) => ({ ...r, team_id: s.team.id, updated_at: now }));
      (data as Record<TableName, unknown[]>)[t] = [...(s.data[t] as unknown[]), ...rows];
      if (s.mode === 'cloud') for (const r of rows) outbox = enqueue(outbox, { table: t, op: 'upsert', rowId: r.id, row: r });
    }
    set({ data, outbox });
    persistSoon();
    onChange?.();
  },

  _set(patch) {
    set(patch);
    persistSoon();
  },
}));

/** Encola TODO el contenido local (al pasar de invitado a nube). El orden lo fija el sync por dependencias. */
export function enqueueEverything(): Mutation[] {
  const s = useStore.getState();
  let outbox = s.outbox;
  outbox = enqueue(outbox, { table: 'teams', op: 'upsert', rowId: s.team.id, row: teamRow(s.team) });
  for (const t of TABLES) {
    for (const r of s.data[t] as { id: string }[]) {
      outbox = enqueue(outbox, { table: t, op: 'upsert', rowId: r.id, row: { ...r, team_id: s.team.id } });
    }
  }
  return outbox;
}
