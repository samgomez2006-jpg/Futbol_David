import { describe, expect, it } from 'vitest';
import { blankMatch } from './factories';
import { callupOfMatch, nextMatch, objectiveProgress, playedMatches, playerStats, squadOf, teamSummary, validateMatch } from './stats';
import { emptyDataset, type Dataset, type Match } from './types';

const T = 'team';
const match = (p: Partial<Match>): Match => blankMatch({ team_id: T, id: Math.random().toString(36).slice(2), ...p });
const goal = (pid: string | null, min: number, apid: string | null = null, zone = '') => ({ id: `${pid}${min}`, pid, apid, min, gtype: 'Jugada', body: 'Pie derecho', field_zone: zone, goal_zone: '' });

function dataset(): Dataset {
  const d = emptyDataset();
  d.players = [
    { id: 'a', team_id: T, name: 'Ana', number: 9, position: 'Delantero', birth: null, foot: 'D', archived_at: null },
    { id: 'b', team_id: T, name: 'Bea', number: 1, position: 'Portero', birth: null, foot: 'D', archived_at: null },
  ];
  d.matches = [
    match({ date: '2026-01-01', gf: 2, ga: 0, goals: [goal('a', 10, 'b'), goal('a', 50)], lineup: [{ pid: 'a', role: 'TIT', slot: 'DEL#9', mins: 60 }, { pid: 'b', role: 'SUP', slot: null, mins: 15 }], motm: 'a' }),
    match({ date: '2026-01-08', gf: 1, ga: 1, goals: [goal('b', 30)], conceded: [{ id: 'c', min: 59, gtype: 'Córner', field_zone: '', goal_zone: '' }], cards: [{ id: 'k', pid: 'a', type: 'Y', min: 20 }], lineup: [{ pid: 'a', role: 'TIT', slot: 'DEL#9', mins: 45 }, { pid: 'b', role: 'SUP', slot: null, mins: 0 }] }),
    match({ date: '2026-01-15', gf: 0, ga: 3, deleted_at: '2026-01-20T00:00:00Z', lineup: [{ pid: 'a', role: 'TIT', slot: 'DEL#9', mins: 60 }] }),
    match({ date: '2099-01-01', rival: 'Futuro', status: 'scheduled', lineup: [] }),
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
    expect(s.matches).toBe(2);
    expect(s.starts).toBe(2);
    expect(s.mins).toBe(105);
    expect(s.avgMins).toBe(53);
    expect(s.minsPct).toBe(88); // 105 de 120 minutos posibles (2 partidos jugados de 60')
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
  it('ignora partidos en la papelera y partidos solo programados', () => {
    const d = dataset();
    expect(playedMatches(d)).toHaveLength(2);
    expect(teamSummary(playedMatches(d)).ga).toBe(1);
  });
});

describe('convocatoria ↔ partido', () => {
  it('el partido conoce a los convocados a través de su convocatoria', () => {
    const d = dataset();
    d.callups = [{ id: 'c1', team_id: T, rival: 'Futuro', date: '2099-01-01', meet_time: '', place: '', players: [{ pid: 'a', status: 'confirmed' }, { pid: 'b', status: 'declined' }] }];
    d.matches[3].callup_id = 'c1';
    expect(callupOfMatch(d, d.matches[3])?.id).toBe('c1');
    expect(squadOf(d, d.matches[3])).toEqual(['a']);
    expect(squadOf(d, d.matches[0])).toBeNull();
    expect(playerStats(d, 'a').called).toBe(1);
    expect(playerStats(d, 'b').called).toBe(0);
  });
  it('nextMatch devuelve el programado más cercano', () => {
    expect(nextMatch(dataset())?.rival).toBe('Futuro');
  });
});

describe('teamSummary', () => {
  it('calcula puntos, racha y forma', () => {
    const s = teamSummary([match({ date: '2026-01-01', gf: 1 }), match({ date: '2026-01-02', gf: 2, ga: 1 }), match({ date: '2026-01-03', gf: 3 })]);
    expect(s.pts).toBe(9);
    expect(s.streak).toEqual({ type: 'V', count: 3 });
    expect(s.form).toEqual(['V', 'V', 'V']);
  });
});

describe('validateMatch', () => {
  const base = match({ rival: 'Rival', gf: 1, ga: 0 });
  it('exige rival', () => expect(validateMatch({ ...base, rival: ' ' })).toMatch(/rival/));
  it('no permite más goles detallados que el marcador', () => expect(validateMatch({ ...base, goals: [goal('a', 1), goal('a', 2)] })).toMatch(/marcador/));
  it('rechaza minutos fuera del partido', () => expect(validateMatch({ ...base, goals: [goal('a', 200)] })).toMatch(/Minuto/));
  it('rechaza autoasistencia', () => expect(validateMatch({ ...base, goals: [goal('a', 5, 'a')] })).toMatch(/asistente/));
  it('un partido programado no valida el marcador', () => expect(validateMatch({ ...base, status: 'scheduled', gf: 0, goals: [goal('a', 5)] })).toBeNull());
  it('rechaza que entre un titular', () =>
    expect(validateMatch({ ...base, lineup: [{ pid: 'a', role: 'TIT', slot: 'DEL#0', mins: 60 }], subs: [{ id: 's', min: 30, out_pid: 'b', in_pid: 'a' }] })).toMatch(/titular/));
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
