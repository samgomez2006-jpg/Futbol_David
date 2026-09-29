import { describe, expect, it } from 'vitest';
import { normalizeDataset, normalizeTraining } from './normalize';
import { punctualityStats, squadPunctuality } from './punctuality';
import { emptyDataset, type Dataset } from './types';

const T = 't';
const player = (id: string) => ({ id, team_id: T, name: id, number: null, position: 'Defensa' as const, birth: null, foot: 'D' as const, archived_at: null });

function data(): Dataset {
  const d = emptyDataset();
  d.players = [player('a'), player('b')];
  d.trainings = [
    { id: '1', team_id: T, date: '2026-09-01', notes: '', present: [], attendance: [{ pid: 'a', status: 'late', minutes_late: 10 }, { pid: 'b', status: 'punctual' }] },
    { id: '2', team_id: T, date: '2026-09-08', notes: '', present: [], attendance: [{ pid: 'a', status: 'late', minutes_late: 20 }] },
    { id: '3', team_id: T, date: '2026-10-01', notes: '', present: [], attendance: [{ pid: 'a', status: 'punctual' }, { pid: 'b', status: 'punctual' }] },
  ];
  d.callups = [{ id: 'c', team_id: T, rival: 'X', date: '2026-10-05', meet_time: '', place: '', players: [
    { pid: 'a', status: 'confirmed', arrival: { status: 'late', minutes_late: 5 } },
    { pid: 'b', status: 'declined', arrival: { status: 'late' } },
  ] }];
  return normalizeDataset(d);
}

describe('puntualidad', () => {
  it('acumula retrasos de entrenos y convocatorias', () => {
    const s = punctualityStats(data(), 'a');
    expect(s.trainings).toEqual({ punctual: 1, late: 2, absent: 0 });
    expect(s.callups.late).toBe(1);
    expect(s.lates).toBe(3);
    expect(s.attended).toBe(4);
    expect(s.pctLate).toBe(75);
    expect(s.minutesLate).toBe(35);
    expect(s.avgMinutes).toBe(12);
    expect(s.byMonth.map((m) => [m.month, m.late])).toEqual([['2026-09', 2], ['2026-10', 1]]);
  });
  it('los no listados en un entreno cuentan como falta y las bajas de convocatoria no cuentan', () => {
    const s = punctualityStats(data(), 'b');
    expect(s.trainings).toEqual({ punctual: 2, late: 0, absent: 1 });
    expect(s.callups).toEqual({ punctual: 0, late: 0, absent: 0 });
    expect(s.pctLate).toBe(0);
  });
  it('ordena la plantilla por retrasos', () => {
    const d = data();
    expect(squadPunctuality(d, d.players).map((x) => x.p.id)).toEqual(['a', 'b']);
  });
  it('los entrenos antiguos (solo present) se leen como puntuales', () => {
    const t = normalizeTraining({ id: 'x', team_id: T, date: '2026-01-01', notes: '', present: ['a', 'b'], attendance: [] });
    expect(t.attendance.map((e) => e.status)).toEqual(['punctual', 'punctual']);
    expect(t.present).toEqual(['a', 'b']);
  });
  it('present se deriva de attendance y se limpian los campos de retraso si no es «tarde»', () => {
    const t = normalizeTraining({ id: 'x', team_id: T, date: '2026-01-01', notes: '', present: [], attendance: [
      { pid: 'a', status: 'punctual', minutes_late: 9 }, { pid: 'b', status: 'absent' }, { pid: 'c', status: 'late', minutes_late: 999 },
    ] });
    expect(t.present).toEqual(['a', 'c']);
    expect(t.attendance[0]).toEqual({ pid: 'a', status: 'punctual' });
    expect(t.attendance[2].minutes_late).toBe(240);
  });
});
