import { useEffect } from 'react';
import { create } from 'zustand';
import { fcfApi } from '../lib/fcf/client';
import type { FcfActa, FcfGroupData, FcfLink } from '../lib/fcf/types';
import { storage } from '../lib/storage';
import { useStore } from './store';

// Caché local de los datos FCF por equipo de la app. No se sube a Supabase: se puede volver a descargar
// siempre y así los datos oficiales nunca se mezclan con los que registra el entrenador.

interface Entry {
  groupId: string;
  group: FcfGroupData | null;
  actas: Record<string, FcfActa>;
}
interface State {
  byTeam: Record<string, Entry>;
  loading: Record<string, boolean>;
  errors: Record<string, string | null>;
  ready: boolean;
  hydrate: () => Promise<void>;
  refresh: (teamId: string, link: FcfLink) => Promise<FcfGroupData | null>;
  loadActas: (teamId: string, ids: string[], onProgress?: (done: number, total: number) => void) => Promise<void>;
  forget: (teamId: string) => void;
}

const KEY = 'mef_fcf_v1';
/** Se refresca solo al abrir la competición si los datos tienen más de 6 horas. */
export const STALE_MS = 6 * 3600_000;

const save = () => void storage.set(KEY, useFcf.getState().byTeam);

export const useFcf = create<State>((set, get) => ({
  byTeam: {},
  loading: {},
  errors: {},
  ready: false,
  async hydrate() {
    if (get().ready) return;
    const stored = await storage.get<Record<string, Entry>>(KEY);
    set({ byTeam: stored ?? {}, ready: true });
  },
  async refresh(teamId, link) {
    await get().hydrate();
    set({ loading: { ...get().loading, [teamId]: true }, errors: { ...get().errors, [teamId]: null } });
    try {
      const group = await fcfApi.group(link.group.id, link.season.id);
      const prev = get().byTeam[teamId];
      const actas = prev && prev.groupId === link.group.id ? prev.actas : {};
      set({ byTeam: { ...get().byTeam, [teamId]: { groupId: link.group.id, group, actas } } });
      save();
      return group;
    } catch (e) {
      set({ errors: { ...get().errors, [teamId]: e instanceof Error ? e.message : 'Error al consultar la FCF' } });
      return null;
    } finally {
      set({ loading: { ...get().loading, [teamId]: false } });
    }
  },
  async loadActas(teamId, ids, onProgress) {
    const entry = get().byTeam[teamId];
    if (!entry) return;
    const todo = ids.filter((id) => !entry.actas[id]);
    let done = 0;
    // Dos a la vez como máximo: se piden una vez y quedan guardadas (las actas cerradas no cambian).
    const queue = [...todo];
    const worker = async () => {
      while (queue.length) {
        const id = queue.shift()!;
        try {
          const acta = await fcfApi.acta(id);
          const cur = get().byTeam[teamId];
          set({ byTeam: { ...get().byTeam, [teamId]: { ...cur, actas: { ...cur.actas, [id]: acta } } } });
        } catch {
          /* se reintentará la próxima vez */
        }
        onProgress?.(++done, todo.length);
      }
    };
    await Promise.all([worker(), worker()]);
    save();
  },
  forget(teamId) {
    const byTeam = { ...get().byTeam };
    delete byTeam[teamId];
    set({ byTeam });
    save();
  },
}));

/** Datos FCF del equipo activo. Descarga al abrir si no hay datos o tienen más de 6 horas. */
export function useFcfGroup() {
  const team = useStore((s) => s.team);
  const link = team.profile.fcf ?? null;
  const entry = useFcf((s) => s.byTeam[team.id]);
  const loading = useFcf((s) => !!s.loading[team.id]);
  const error = useFcf((s) => s.errors[team.id] ?? null);
  const ready = useFcf((s) => s.ready);
  const valid = entry && link && entry.groupId === link.group.id ? entry : null;
  const stale = !valid?.group || Date.now() - Date.parse(valid.group.fetchedAt) > STALE_MS;
  useEffect(() => {
    void useFcf.getState().hydrate();
  }, []);
  useEffect(() => {
    if (ready && link && stale && !loading && !error) void useFcf.getState().refresh(team.id, link);
  }, [ready, link, stale, loading, error, team.id]);
  return {
    teamId: team.id, link, group: valid?.group ?? null, actas: valid?.actas ?? {}, loading, error,
    refresh: () => (link ? useFcf.getState().refresh(team.id, link) : Promise.resolve(null)),
  };
}
