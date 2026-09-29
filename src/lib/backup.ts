// Exportación / importación de copias de seguridad.
// - Formato nuevo (version 5): { app, version, team, data }
// - Formato antiguo (miecfc_v4 del HTML original): ids numéricos, goles con pid en string, playtime...
// Todo lo que entra se sanea: nunca confiamos en la forma del JSON importado.

import { FORMATIONS, POSITIONS, SKILLS, slotKey } from './constants';
import { currentSeason, todayISO } from './dates';
import { uid } from './id';
import { normalizeArrival, normalizeDataset, normalizeMatch, normalizeProfile } from './normalize';
import type {
  BoardData, BoardItem, BoardLine, Callup, CallupStatus, CardEvent, ConcededGoal, Dataset, Evaluation, Incident, LineupEntry,
  Match, Objective, ObjectiveCategory, Play, PlayKind, Player, ScoredGoal, Substitution, Team, Training,
} from './types';
import { emptyDataset } from './types';

export const BACKUP_APP = 'mi-equipo-fc';
export const BACKUP_VERSION = 6;

export interface Backup {
  app: typeof BACKUP_APP;
  version: number;
  exported_at: string;
  team: Omit<Team, 'id' | 'invite_code'>;
  data: Dataset;
}

type Obj = Record<string, unknown>;
type LegacyMatch = Omit<Match, 'competition' | 'status' | 'callup_id' | 'subs' | 'incidents' | 'rival_info' | 'plan'>;
const isObj = (x: unknown): x is Obj => typeof x === 'object' && x !== null && !Array.isArray(x);
const arr = (x: unknown): unknown[] => (Array.isArray(x) ? x : []);
const str = (x: unknown, max = 200, def = ''): string => (typeof x === 'string' ? x.trim().slice(0, max) : typeof x === 'number' ? String(x) : def);
const int = (x: unknown, min: number, max: number): number | null => {
  const n = typeof x === 'number' ? x : typeof x === 'string' && x.trim() !== '' ? Number(x) : NaN;
  return Number.isFinite(n) ? Math.min(Math.max(Math.round(n), min), max) : null;
};
const date = (x: unknown): string | null => (typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x) ? x : null);
const oneOf = <T extends string>(x: unknown, opts: readonly T[], def: T): T => (opts.includes(x as T) ? (x as T) : def);

export function makeBackup(team: Team, data: Dataset): Backup {
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exported_at: new Date().toISOString(),
    team: { name: team.name, season: team.season, category: team.category, profile: team.profile },
    data,
  };
}

/** Convierte cualquier copia (nueva o antigua) en un Dataset limpio con UUID nuevos asignados al equipo dado. */
export function parseBackup(raw: unknown, teamId: string): { team: Omit<Team, 'id'>; data: Dataset } {
  if (!isObj(raw)) throw new Error('Archivo no válido');
  const done = (r: { team: Omit<Team, 'id'>; data: Dataset }) => ({ ...r, data: normalizeDataset(r.data) });
  if (raw.app === BACKUP_APP && isObj(raw.data)) return done(fromV5(raw, teamId));
  if (Array.isArray(raw.players) && Array.isArray(raw.matches)) return done(fromLegacy(raw, teamId));
  throw new Error('El archivo no parece una copia de Mi Equipo FC');
}

// ---------------------------------------------------------------------------

function idMapper() {
  const map = new Map<string, string>();
  return (old: unknown): string | null => {
    if (old === null || old === undefined || old === '') return null;
    const k = String(old);
    if (!map.has(k)) map.set(k, uid());
    return map.get(k)!;
  };
}

function fromLegacy(d: Obj, teamId: string) {
  const pidOf = idMapper();
  const cfg = isObj(d.cfg) ? d.cfg : {};
  const knownPids = new Set<string>();

  const players: Player[] = arr(d.players).filter(isObj).map((p) => {
    const id = pidOf(p.id)!;
    knownPids.add(id);
    return {
      id, team_id: teamId,
      name: str(p.name, 80) || 'Jugador',
      number: int(p.number, 0, 99),
      position: oneOf(p.position, POSITIONS, 'Centrocampista'),
      birth: date(p.birth),
      foot: oneOf(p.foot, ['D', 'I', 'A'] as const, 'D'),
      archived_at: null,
    };
  });
  // Solo aceptamos referencias a jugadores que existen (el original dejaba referencias colgando).
  const ref = (x: unknown) => {
    const id = pidOf(x);
    return id && knownPids.has(id) ? id : null;
  };

  const matches: LegacyMatch[] = arr(d.matches).filter(isObj).map((m) => {
    const total = int(m.totalMins, 1, 150) ?? 60;
    const tactic = str(m.tactic, 20);
    const slots = FORMATIONS[tactic] ?? FORMATIONS['4-3-3'];
    const lineup: LineupEntry[] = [];
    for (const pt of arr(m.playtime).filter(isObj)) {
      const pid = ref(pt.pid);
      if (!pid || lineup.some((x) => x.pid === pid)) continue;
      const isStarter = pt.role === 'TIT';
      let slot: string | null = null;
      if (isStarter && typeof pt.posKey === 'string') {
        const i = slots.findIndex((s, idx) => s.p + idx === pt.posKey);
        slot = i >= 0 ? slotKey(slots[i], i) : `${String(pt.position ?? pt.posKey).replace(/\d+$/, '')}#0`;
      }
      lineup.push({ pid, role: isStarter ? 'TIT' : 'SUP', slot, mins: int(pt.mins, 0, 150) ?? (isStarter ? total : 0) });
    }
    const goal = (g: Obj): ScoredGoal => ({
      id: uid(), pid: ref(g.pid), apid: ref(g.apid), min: int(g.min, 1, 150),
      gtype: str(g.gtype, 40), body: str(g.body, 40), field_zone: str(g.fieldZone, 40), goal_zone: str(g.goalZone, 40),
    });
    const conc = (g: Obj): ConcededGoal => ({
      id: uid(), min: int(g.min, 1, 150), gtype: str(g.gtype, 40), field_zone: str(g.fieldZone, 40), goal_zone: str(g.goalZone, 40),
    });
    const cards: CardEvent[] = arr(m.cards).filter(isObj).flatMap((c) => {
      const pid = ref(c.pid);
      return pid ? [{ id: uid(), pid, type: c.type === 'R' ? 'R' : 'Y', min: int(c.min, 1, 150) } as CardEvent] : [];
    });
    return {
      id: uid(), team_id: teamId,
      rival: str(m.rival, 80) || 'Rival',
      date: date(m.date) ?? todayISO(),
      venue: m.venue === 'V' ? 'V' : 'L',
      gf: int(m.gf, 0, 99) ?? 0,
      ga: int(m.ga, 0, 99) ?? 0,
      total_mins: total,
      tactic,
      notes: str(m.notes, 4000),
      motm: ref(m.motm),
      goals: arr(m.goals).filter(isObj).map(goal),
      conceded: arr(m.conceded).filter(isObj).map(conc),
      cards,
      lineup,
      deleted_at: typeof m.deletedAt === 'string' ? m.deletedAt : null,
    };
  });

  const trainings: Training[] = arr(d.trainings).filter(isObj).map((t) => ({
    id: uid(), team_id: teamId,
    date: date(t.date) ?? todayISO(),
    notes: str(t.notes, 2000),
    present: arr(t.present).map(ref).filter((x): x is string => !!x),
    attendance: [],
  }));

  const evaluations: Evaluation[] = arr(d.evaluations).filter(isObj).flatMap((e) => {
    const pid = ref(e.pid);
    if (!pid) return [];
    return [{ id: uid(), team_id: teamId, player_id: pid, date: date(e.date) ?? todayISO(), skills: skillsOf(e.skills), notes: str(e.notes, 2000) }];
  });

  const objectives: Objective[] = arr(d.objectives).filter(isObj).flatMap((o) => {
    const scope = o.type === 'player' ? 'player' : 'team';
    const pid = scope === 'player' ? ref(o.pid) : null;
    if (scope === 'player' && !pid) return [];
    return [{
      id: uid(), team_id: teamId, title: str(o.title, 120) || 'Objetivo', scope, player_id: pid,
      category: objCat(o.cat), target: int(o.target, 1, 100000) ?? 1, current: int(o.current, 0, 100000) ?? 0,
    }];
  });

  const callups: Callup[] = arr(d.callups).filter(isObj).map((c) => ({
    id: uid(), team_id: teamId, rival: str(c.rival, 80) || 'Rival', date: date(c.date) ?? todayISO(), meet_time: '', place: '',
    players: callupPlayers(c.players, ref),
  }));

  return {
    team: { name: str(cfg.name, 80) || 'Mi Equipo FC', season: str(cfg.season, 20) || currentSeason(), category: str(cfg.cat, 60), profile: normalizeProfile(null) },
    data: { ...emptyDataset(), players, matches: matches.map((m) => normalizeMatch(m as Match)), trainings, evaluations, objectives, callups },
  };
}

function fromV5(raw: Obj, teamId: string) {
  // Re-sanea pasando por el mismo camino de IDs para no pisar datos de otro equipo.
  const d = raw.data as Obj;
  const t = isObj(raw.team) ? raw.team : {};
  const pidOf = idMapper();
  const cidOf = idMapper();
  const players: Player[] = arr(d.players).filter(isObj).map((p) => ({
    id: pidOf(p.id)!, team_id: teamId, name: str(p.name, 80) || 'Jugador', number: int(p.number, 0, 99),
    position: oneOf(p.position, POSITIONS, 'Centrocampista'), birth: date(p.birth),
    foot: oneOf(p.foot, ['D', 'I', 'A'] as const, 'D'), archived_at: typeof p.archived_at === 'string' ? p.archived_at : null,
  }));
  const known = new Set(players.map((p) => p.id));
  const ref = (x: unknown) => {
    const id = pidOf(x);
    return id && known.has(id) ? id : null;
  };
  const callupIds = new Set(arr(d.callups).filter(isObj).map((c) => cidOf(c.id)));
  const callupRef = (x: unknown) => {
    const id = cidOf(x);
    return id && callupIds.has(id) ? id : null;
  };
  const ev = (g: Obj) => ({ id: uid(), min: int(g.min, 1, 150), gtype: str(g.gtype, 40), field_zone: str(g.field_zone, 40), goal_zone: str(g.goal_zone, 40) });
  const text = (x: unknown, max = 2000) => str(x, max);
  const matches: Match[] = arr(d.matches).filter(isObj).map((m) =>
    normalizeMatch({
      id: uid(), team_id: teamId, rival: str(m.rival, 80) || 'Rival', date: date(m.date) ?? todayISO(),
      venue: m.venue === 'V' ? 'V' : 'L', competition: str(m.competition, 80), status: m.status === 'scheduled' ? 'scheduled' : 'played',
      callup_id: callupRef(m.callup_id),
      gf: int(m.gf, 0, 99) ?? 0, ga: int(m.ga, 0, 99) ?? 0,
      total_mins: int(m.total_mins, 1, 150) ?? 60, tactic: str(m.tactic, 20), notes: str(m.notes, 4000), motm: ref(m.motm),
      goals: arr(m.goals).filter(isObj).map((g) => ({ ...ev(g), pid: ref(g.pid), apid: ref(g.apid), body: str(g.body, 40) })),
      conceded: arr(m.conceded).filter(isObj).map(ev),
      cards: arr(m.cards).filter(isObj).flatMap((c) => {
        const pid = ref(c.pid);
        return pid ? [{ id: uid(), pid, type: c.type === 'R' ? 'R' : 'Y', min: int(c.min, 1, 150) } as CardEvent] : [];
      }),
      lineup: arr(m.lineup).filter(isObj).flatMap((e) => {
        const pid = ref(e.pid);
        return pid ? [{ pid, role: e.role === 'TIT' ? 'TIT' : 'SUP', slot: typeof e.slot === 'string' ? e.slot.slice(0, 20) : null, mins: int(e.mins, 0, 150) ?? 0, mins_manual: e.mins_manual === true } as LineupEntry] : [];
      }),
      subs: arr(m.subs).filter(isObj).flatMap((s) => {
        const out = ref(s.out_pid);
        const inn = ref(s.in_pid);
        return out && inn ? [{ id: uid(), min: int(s.min, 1, 150), out_pid: out, in_pid: inn } as Substitution] : [];
      }),
      incidents: arr(m.incidents).filter(isObj).map((i) => ({ id: uid(), min: int(i.min, 1, 150), text: text(i.text, 500) }) as Incident),
      rival_info: (isObj(m.rival_info) ? m.rival_info : {}) as unknown as Match['rival_info'],
      plan: (isObj(m.plan) ? m.plan : {}) as unknown as Match['plan'],
      deleted_at: typeof m.deleted_at === 'string' ? m.deleted_at : null,
    }),
  );
  const plays: Play[] = arr(d.plays).filter(isObj).map((p) => {
    const data = isObj(p.data) ? p.data : {};
    const items: BoardItem[] = arr(data.items).filter(isObj).slice(0, 200).map((i) => ({
      id: str(i.id, 40) || uid(), type: oneOf(i.type, ['player', 'rival', 'gk', 'ball', 'cone', 'goal', 'text', 'area'] as const, 'player'),
      x: Number(i.x) || 0, y: Number(i.y) || 0, label: str(i.label, 30), size: Number(i.size) || undefined,
    }));
    const lines: BoardLine[] = arr(data.lines).filter(isObj).slice(0, 200).map((l) => ({
      id: str(l.id, 40) || uid(), kind: oneOf(l.kind, ['move', 'pass', 'dribble'] as const, 'move'),
      points: arr(l.points).slice(0, 400).flatMap((pt) => (Array.isArray(pt) && pt.length === 2 ? [[Number(pt[0]) || 0, Number(pt[1]) || 0] as [number, number]] : [])),
      from: typeof l.from === 'string' ? l.from : undefined,
    }));
    const board: BoardData = { pitch: oneOf(data.pitch, ['full', 'half', 'blank'] as const, 'full'), items, lines };
    return { id: uid(), team_id: teamId, title: str(p.title, 120) || 'Jugada', kind: oneOf<PlayKind>(p.kind, ['jugada', 'ejercicio', 'situacion'], 'jugada'), description: text(p.description, 4000), data: board };
  });
  return {
    team: { name: str(t.name, 80) || 'Mi Equipo FC', season: str(t.season, 20), category: str(t.category, 60), profile: normalizeProfile(t.profile) },
    data: {
      ...emptyDataset(),
      players,
      matches,
      plays,
      trainings: arr(d.trainings).filter(isObj).map((x) => ({
        id: uid(), team_id: teamId, date: date(x.date) ?? todayISO(), notes: str(x.notes, 2000),
        present: arr(x.present).map(ref).filter((y): y is string => !!y),
        attendance: arr(x.attendance).filter(isObj).flatMap((a) => { const pid = ref(a.pid); const ar = normalizeArrival(a); return pid && ar ? [{ pid, ...ar }] : []; }),
      })),
      evaluations: arr(d.evaluations).filter(isObj).flatMap((e) => {
        const pid = ref(e.player_id);
        return pid ? [{ id: uid(), team_id: teamId, player_id: pid, date: date(e.date) ?? todayISO(), skills: skillsOf(e.skills), notes: str(e.notes, 2000) }] : [];
      }),
      objectives: arr(d.objectives).filter(isObj).flatMap((o) => {
        const scope: Objective['scope'] = o.scope === 'player' ? 'player' : 'team';
        const pid = scope === 'player' ? ref(o.player_id) : null;
        if (scope === 'player' && !pid) return [];
        return [{ id: uid(), team_id: teamId, title: str(o.title, 120) || 'Objetivo', scope, player_id: pid, category: objCat(o.category), target: int(o.target, 1, 100000) ?? 1, current: int(o.current, 0, 100000) ?? 0 }];
      }),
      callups: arr(d.callups).filter(isObj).map((c) => ({
        id: cidOf(c.id)!, team_id: teamId, rival: str(c.rival, 80) || 'Rival', date: date(c.date) ?? todayISO(),
        meet_time: str(c.meet_time, 40), place: str(c.place, 120), players: callupPlayers(c.players, ref),
      })),
    },
  };
}

function skillsOf(x: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!isObj(x)) return out;
  for (const k of SKILLS) {
    const v = int(x[k], 1, 10);
    if (v != null) out[k] = v;
  }
  return out;
}

const OBJ_CATS: ObjectiveCategory[] = ['wins', 'goals', 'assists', 'matches', 'attendance', 'cleansheets', 'custom'];
const objCat = (x: unknown): ObjectiveCategory => oneOf(x, OBJ_CATS, 'custom');

function callupPlayers(x: unknown, ref: (x: unknown) => string | null) {
  const out: Callup['players'] = [];
  for (const e of arr(x).filter(isObj)) {
    const pid = ref(e.pid);
    if (pid && !out.some((y) => y.pid === pid)) out.push({ pid, status: oneOf<CallupStatus>(e.status, ['pending', 'confirmed', 'declined'], 'pending'), arrival: normalizeArrival(e.arrival) });
  }
  return out;
}
