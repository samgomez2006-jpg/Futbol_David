// Puntualidad: se acumula desde los entrenos (asistencia con retraso) y las convocatorias (llegada el día del partido).
// Nunca se inventan datos: una convocatoria sin llegada registrada simplemente no cuenta.

import { normalizeTraining } from './normalize';
import type { Arrival, Dataset, ISODate, Player } from './types';

export interface Counts {
  punctual: number;
  late: number;
  absent: number;
}
export interface MonthPoint {
  month: string; // AAAA-MM
  late: number;
  attended: number;
}
export interface PunctualityStats {
  pid: string;
  trainings: Counts;
  callups: Counts;
  /** Total de retrasos (entrenos + convocatorias). */
  lates: number;
  /** Veces que acudió (puntual o tarde). */
  attended: number;
  /** % de retrasos sobre las veces que acudió. */
  pctLate: number;
  minutesLate: number;
  /** Retrasos con minutos anotados y media de esos minutos. */
  avgMinutes: number;
  withMinutes: number;
  byMonth: MonthPoint[];
}

const zero = (): Counts => ({ punctual: 0, late: 0, absent: 0 });

interface Event {
  date: ISODate;
  source: 'training' | 'callup';
  a: Arrival;
}

export function eventsOf(d: Dataset, pid: string): Event[] {
  const out: Event[] = [];
  for (const raw of d.trainings) {
    const t = normalizeTraining(raw);
    const e = t.attendance.find((x) => x.pid === pid);
    out.push({ date: t.date, source: 'training', a: e ?? { status: 'absent' } });
  }
  for (const c of d.callups) {
    const e = c.players.find((x) => x.pid === pid);
    if (e && e.status === 'confirmed' && e.arrival) out.push({ date: c.date, source: 'callup', a: e.arrival });
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : 1));
}

export function punctualityStats(d: Dataset, pid: string): PunctualityStats {
  const s: PunctualityStats = {
    pid, trainings: zero(), callups: zero(), lates: 0, attended: 0, pctLate: 0, minutesLate: 0, avgMinutes: 0, withMinutes: 0, byMonth: [],
  };
  const months = new Map<string, MonthPoint>();
  for (const ev of eventsOf(d, pid)) {
    const bucket = ev.source === 'training' ? s.trainings : s.callups;
    bucket[ev.a.status]++;
    if (ev.a.status === 'absent') continue;
    s.attended++;
    const key = ev.date.slice(0, 7);
    const m = months.get(key) ?? { month: key, late: 0, attended: 0 };
    m.attended++;
    if (ev.a.status === 'late') {
      m.late++;
      s.lates++;
      if (typeof ev.a.minutes_late === 'number') {
        s.minutesLate += ev.a.minutes_late;
        s.withMinutes++;
      }
    }
    months.set(key, m);
  }
  s.pctLate = s.attended ? Math.round((s.lates / s.attended) * 100) : 0;
  s.avgMinutes = s.withMinutes ? Math.round(s.minutesLate / s.withMinutes) : 0;
  s.byMonth = [...months.values()].sort((a, b) => (a.month < b.month ? -1 : 1));
  return s;
}

/** Plantilla ordenada por número de retrasos (más primero); empata por % y por nombre. */
export function squadPunctuality(d: Dataset, players: Player[]): { p: Player; s: PunctualityStats }[] {
  return players
    .map((p) => ({ p, s: punctualityStats(d, p.id) }))
    .sort((a, b) => b.s.lates - a.s.lates || b.s.pctLate - a.s.pctLate || a.p.name.localeCompare(b.p.name, 'es'));
}

export const PUNCT_LABEL = { punctual: 'Puntual', late: 'Tarde', absent: 'Falta' } as const;
export const monthLabel = (m: string) => new Date(`${m}-01T12:00:00`).toLocaleDateString('es', { month: 'short', year: '2-digit' });
