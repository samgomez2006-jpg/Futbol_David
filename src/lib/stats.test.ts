import { describe, expect, it } from 'vitest';
import { analyse, objectiveProgress, playerStats, teamSummary, timeSlots, validateMatch } from './stats';
import { emptyDataset, type Dataset, type Match } from './types';

const T = 'team';
const match = (p: Partial<Match>): Match => ({
  id: Math.random().toString(36), team_id: T, rival: 'Rival', date: '2026-01-01', venue: 'L', gf: 0, ga: 0,
  total_mins: 60, tactic: '4-3-3', notes: '', motm: null, goals: [], conceded: [], cards: [], lineup: [], deleted_at: null, ...p,
});
const goal = (pid: string | null, min: number, apid: string | null = null) => ({ id: `${pid}${min}`, pid, apid, min, gtype: 'Penalti', body: 'Pie derecho', field_zone: '', goal_zone: '' });

function dataset(): Dataset {
  const d = emptyDataset();
  d.players = [
    { id: 'a', team_id: T, name: 'Ana', number: 9, position: 'Delantero', birth: null, foot: 'D', archived_at: null },
    { id: 'b', team_id: T, name: 'Bea', number: 1, position: 'Portero', birth: null, foot: 'D', archived_at: null },
  ];
  d.matches = [
    match({ date: '2026-01-01', gf: 2, ga: 0, goals: [goal('a', 10, 'b'), goal('a', 50)], lineup: [{ pid: 'a', role: 'TIT', slot: 'DEL#9', mins: 60 }, { pid: 'b', role: 'SUP', slot: null, mins: 15 }], motm: 'a' }),
    match({ date: '2026-01-08', gf: 1, ga: 1, goals: [goal('b', 30)], conceded: [{ id: 'c', min: 59, gtype: 'Córner', field_zone: '', goal_zone: '' }], cards: [{ id: 'k', pid: 'a', type: 'Y', min: 20 }], lineup: [{ pid: 'a', role: 'TIT', slot: 'DEL#9', mins: 45 }, { pid: 'b', role: 'SUP', slot: null, mins: 0 }] }),
    match({ date: '2026-01-15', gf: 0, ga: 3, deleted_at: '2026-01-20T00:00:00Z', goals: [], lineup: [{ pid: 'a', role: 'TIT', slot: 'DEL#9', mins: 60 }] }),
  ];
  d.trainings = [
    { id: 't1', team_id: T, date: '2026-01-02', notes: '', present: ['a'] },
    { id: 't2', team_id: T, date: '2026-01-03', notes: '', present: ['a', 'b'] },
  ];
  return d;
}

describe('playerStats', () => {
  it('cuenta goles, asistencias, minutos y tarjetas (regresión: el original comparaba string con number)', () => {
    const s = playerStats(dataset(), 'a');
    expect(s.goals).toBe(2);
    expect(s.assists).toBe(0);
    expect(s.matches).toBe(2);
    expect(s.starts).toBe(2);
    expect(s.mins).toBe(105);
    expect(s.yellows).toBe(1);
    expect(s.motm).toBe(1);
    expect(s.attPct).toBe(100);
  });
  it('los suplentes que juegan cuentan como partido jugado; los que no, no', () => {
    const s = playerStats(dataset(), 'b');
    expect(s.matches).toBe(1);
    expect(s.subApps).toBe(1);
    expect(s.assists).toBe(1);
    expect(s.goals).toBe(1);
    expect(s.cleanSheets).toBe(1);
    expect(s.attPct).toBe(50);
  });
  it('ignora partidos en la papelera', () => {
    expect(teamSummary(dataset().matches.filter((m) => !m.deleted_at)).ga).toBe(1);
  });
});

describe('teamSummary', () => {
  it('calcula puntos y racha', () => {
    const s = teamSummary([match({ date: '2026-01-01', gf: 1 }), match({ date: '2026-01-02', gf: 2, ga: 1 }), match({ date: '2026-01-03', gf: 3 })]);
    expect(s.pts).toBe(9);
    expect(s.streak).toEqual({ type: 'V', count: 3 });
  });
});

describe('timeSlots', () => {
  it('reparte proporcionalmente a la duración del partido', () => {
    const r = timeSlots([match({ total_mins: 90, goals: [goal('a', 89), goal('a', 1)] }), match({ total_mins: 60, goals: [goal('a', 59)] })]);
    expect(r.scored[0]).toBe(1);
    expect(r.scored[5]).toBe(2);
  });
});

describe('validateMatch', () => {
  const base = match({ gf: 1, ga: 0 });
  it('exige rival', () => expect(validateMatch({ ...base, rival: ' ' })).toMatch(/rival/));
  it('no permite más goles detallados que el marcador', () => expect(validateMatch({ ...base, goals: [goal('a', 1), goal('a', 2)] })).toMatch(/marcador/));
  it('rechaza minutos fuera del partido', () => expect(validateMatch({ ...base, goals: [goal('a', 200)] })).toMatch(/Minuto/));
  it('rechaza autoasistencia', () => expect(validateMatch({ ...base, goals: [goal('a', 5, 'a')] })).toMatch(/asistente/));
  it('acepta un partido válido', () => expect(validateMatch({ ...base, goals: [goal('a', 5, 'b')] })).toBeNull());
});

describe('objectiveProgress', () => {
  it('objetivos de jugador y de equipo', () => {
    const d = dataset();
    const o = { id: 'o', team_id: T, title: 'x', scope: 'player' as const, player_id: 'a', category: 'goals' as const, target: 4, current: 0 };
    expect(objectiveProgress(d, o)).toEqual({ current: 2, pct: 50, done: false });
    expect(objectiveProgress(d, { ...o, scope: 'team', player_id: null, category: 'wins', target: 1 }).done).toBe(true);
    expect(objectiveProgress(d, { ...o, category: 'custom', current: 3, target: 3 }).done).toBe(true);
  });
});

describe('analyse', () => {
  it('no genera insights con menos de 3 partidos y no falla con datos vacíos', () => {
    expect(analyse(emptyDataset()).total).toBe(0);
    expect(analyse(dataset()).insights).toEqual([]);
  });
});
