// Normaliza datos de cualquier versión anterior (local, Supabase o copias de seguridad)
// al modelo actual. Es idempotente: pasarlo dos veces no cambia nada.

import { LEGACY_GOAL_TYPES } from './constants';
import { uid } from './id';
import { emptyDataset, emptyPlan, emptyProfile, emptyRival, type Arrival, type Dataset, type Match, type Punctuality, type Team, type TeamProfile, type Training, type TrainingAttendance } from './types';
import { normalizeZone } from './zones';

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const strs = <T extends object>(base: T, src: unknown): T => {
  const out = { ...base } as Record<string, unknown>;
  if (isObj(src)) for (const k of Object.keys(base)) if (typeof src[k] === 'string') out[k] = src[k];
  return out as T;
};

export function normalizeProfile(p: unknown): TeamProfile {
  const base = emptyProfile();
  if (!isObj(p)) return base;
  const staff = Array.isArray(p.staff)
    ? p.staff.filter(isObj).map((s) => ({ id: typeof s.id === 'string' ? s.id : uid(), name: String(s.name ?? '').slice(0, 80), role: String(s.role ?? '').slice(0, 60) }))
    : [];
  return { ...base, ...strs({ info: '', system: '', model: '', principles: '', ideas: '', other: '' }, p), staff };
}

export function normalizeTeam(t: Team | (Omit<Team, 'profile'> & { profile?: unknown })): Team {
  return { ...t, profile: normalizeProfile((t as { profile?: unknown }).profile) };
}

const goalType = (t: unknown) => {
  const s = typeof t === 'string' ? t : '';
  return LEGACY_GOAL_TYPES[s] ?? s;
};

export function normalizeMatch(m: Match): Match {
  const cards = Array.isArray(m.cards) ? m.cards : [];
  const subs = Array.isArray(m.subs) ? m.subs : [];
  return {
    ...m,
    competition: m.competition ?? '',
    status: m.status === 'scheduled' ? 'scheduled' : 'played',
    callup_id: m.callup_id ?? null,
    goals: (m.goals ?? []).map((g) => ({ ...g, gtype: goalType(g.gtype), field_zone: normalizeZone(g.field_zone) })),
    conceded: (m.conceded ?? []).map((g) => ({ ...g, gtype: goalType(g.gtype), field_zone: normalizeZone(g.field_zone) })),
    cards,
    subs,
    incidents: Array.isArray(m.incidents) ? m.incidents : [],
    lineup: m.lineup ?? [],
    rival_info: strs(emptyRival(), m.rival_info),
    plan: {
      attack: strs(emptyPlan().attack, (m.plan as { attack?: unknown } | undefined)?.attack),
      defense: strs(emptyPlan().defense, (m.plan as { defense?: unknown } | undefined)?.defense),
    },
  };
}

const PUNCT: Punctuality[] = ['punctual', 'late', 'absent'];

/** Limpia una llegada: los campos de retraso solo se conservan si está «late». */
export function normalizeArrival(x: unknown): Arrival | null {
  if (!isObj(x) || !PUNCT.includes(x.status as Punctuality)) return null;
  const status = x.status as Punctuality;
  if (status !== 'late') return { status };
  const mins = typeof x.minutes_late === 'number' && Number.isFinite(x.minutes_late) ? Math.min(240, Math.max(0, Math.round(x.minutes_late))) : null;
  return {
    status, minutes_late: mins,
    ...(typeof x.arrival_time === 'string' && x.arrival_time ? { arrival_time: x.arrival_time.slice(0, 5) } : {}),
    ...(typeof x.note === 'string' && x.note.trim() ? { note: x.note.trim().slice(0, 300) } : {}),
  };
}

/** Entrenos antiguos solo tenían `present[]`: pasan a `attendance` con todos puntuales (sin datos de retraso). */
export function normalizeTraining(t: Training): Training {
  const seen = new Set<string>();
  let attendance: TrainingAttendance[] = [];
  for (const e of Array.isArray(t.attendance) ? t.attendance : []) {
    const a = normalizeArrival(e);
    if (a && typeof e.pid === 'string' && !seen.has(e.pid)) {
      seen.add(e.pid);
      attendance.push({ pid: e.pid, ...a });
    }
  }
  if (!attendance.length && Array.isArray(t.present)) attendance = t.present.map((pid) => ({ pid, status: 'punctual' as const }));
  return { ...t, attendance, present: attendance.filter((a) => a.status !== 'absent').map((a) => a.pid) };
}

export function normalizeDataset(d: Partial<Dataset> | undefined | null): Dataset {
  const base = emptyDataset();
  const src = d ?? {};
  return {
    ...base,
    ...src,
    matches: (src.matches ?? []).map(normalizeMatch),
    trainings: (src.trainings ?? []).map(normalizeTraining),
    callups: (src.callups ?? []).map((c) => ({ ...c, players: (c.players ?? []).map((e) => ({ pid: e.pid, status: e.status, arrival: normalizeArrival(e.arrival) })) })),
    plays: (src.plays ?? []).map((p) => ({ ...p, data: { pitch: p.data?.pitch ?? 'full', items: p.data?.items ?? [], lines: p.data?.lines ?? [] } })),
  };
}
