import { describe, expect, it } from 'vitest';
import { analyse, fmtPct, halvesOf, zoneAnalysis } from './analytics';
import { blankMatch } from './factories';
import { normalizeMatch } from './normalize';
import { emptyDataset, type Dataset, type Match, type ScoredGoal } from './types';

const T = 'T';
const g = (min: number | null, zone = '', gtype = 'Jugada', pid: string | null = null): ScoredGoal => ({ id: `${min}${zone}`, pid, apid: null, min, gtype, body: '', field_zone: zone, goal_zone: '' });
const mk = (i: number, p: Partial<Match>) => blankMatch({ id: `m${i}`, team_id: T, date: `2026-03-${String(i).padStart(2, '0')}`, rival: `R${i}`, ...p });

describe('halvesOf', () => {
  it('reparte por mitad según la duración de cada partido', () => {
    const h = halvesOf([
      mk(1, { total_mins: 60, goals: [g(10), g(31), g(null)], conceded: [g(30) as never, g(59) as never] }),
      mk(2, { total_mins: 90, conceded: [g(45) as never, g(46) as never] }),
    ]);
    expect(h).toEqual({ gfH1: 1, gfH2: 1, gaH1: 2, gaH2: 2, unknown: 1 });
  });
});

describe('zoneAnalysis (los porcentajes = goles de la zona / goles con zona × 100)', () => {
  const ms = [
    mk(1, { gf: 3, goals: [g(5, 'Z3'), g(10, 'Z3'), g(20, 'Z5')] }),
    mk(2, { gf: 2, goals: [g(5, 'Z3'), g(9, '')] }),
    mk(3, { gf: 1, goals: [g(8, 'Z8')] }),
  ];
  const a = zoneAnalysis(ms, 'scored', new Map());
  it('calcula porcentajes sobre los goles con zona', () => {
    expect(a.totalGoals).toBe(6);
    expect(a.withZone).toBe(5);
    expect(a.noZone).toBe(1);
    expect(a.zones.Z3.goals).toBe(3);
    expect(a.zones.Z3.pct).toBeCloseTo(60);
    expect(a.zones.Z5.pct).toBeCloseTo(20);
    expect(a.ranking[0].id).toBe('Z3');
    expect(a.topShare).toBeCloseTo(60);
  });
  it('enough solo con 5 o más goles con zona; lista los partidos de cada zona', () => {
    expect(a.enough).toBe(true);
    expect(zoneAnalysis(ms.slice(0, 1), 'scored', new Map()).enough).toBe(false);
    expect(a.zones.Z3.items.map((i) => i.rival)).toEqual(['R1', 'R1', 'R2']);
  });
  it('los goles en contra usan exactamente las mismas zonas', () => {
    const c = zoneAnalysis([mk(1, { ga: 2, conceded: [g(3, 'Z8') as never, g(4, 'Z8') as never] })], 'conceded', new Map());
    expect(Object.keys(c.zones)).toEqual(Object.keys(a.zones));
    expect(c.zones.Z8.pct).toBe(100);
  });
});

describe('analyse', () => {
  it('no falla sin datos ni genera hallazgos con pocos partidos', () => {
    const empty = analyse(emptyDataset());
    expect(empty.total).toBe(0);
    expect(empty.zonesFor.enough).toBe(false);
    expect(empty.findings).toEqual([]);
  });
  it('detecta que se encaja más en la segunda parte y la concentración de goles por zona', () => {
    const d: Dataset = emptyDataset();
    d.matches = [1, 2, 3, 4].map((i) => mk(i, { gf: 1, ga: 2, goals: [g(10, 'Z5')], conceded: [g(50, 'Z8') as never, g(55, 'Z8') as never] }));
    const a = analyse(d);
    expect(a.findings.some((f) => f.id === 'ga-h2')).toBe(true);
    expect(a.findings.some((f) => f.id === 'zone-against')).toBe(true);
    expect(a.findings.find((f) => f.id === 'zone-against')!.text).toContain('100');
  });
  it('avisa de carga alta de minutos y usa solo partidos jugados', () => {
    const d: Dataset = emptyDataset();
    d.players = [{ id: 'p', team_id: T, name: 'Pepe', number: 8, position: 'Centrocampista', birth: null, foot: 'D', archived_at: null }];
    d.matches = [1, 2, 3, 4, 5].map((i) => mk(i, { gf: 1, lineup: [{ pid: 'p', role: 'TIT', slot: 'MC#6', mins: 60 }] }));
    d.matches.push(mk(6, { status: 'scheduled', lineup: [] }));
    const a = analyse(d);
    expect(a.total).toBe(5);
    expect(a.loads[0]).toMatchObject({ pid: 'p', pct: 100, level: 'alta' });
    expect(a.findings.some((f) => f.id === 'load-high')).toBe(true);
  });
  it('fmtPct usa coma y espacio fino', () => expect(fmtPct(26.666, 1)).toBe('26,7 %'));
});

describe('normalizeMatch (datos de versiones anteriores)', () => {
  it('rellena campos nuevos y actualiza tipos de gol y zonas antiguas', () => {
    const old = { ...mk(1, {}), goals: [{ ...g(4, 'Dentro del área', 'Jugada elaborada') }] } as Partial<Match>;
    delete old.status;
    delete old.subs;
    delete old.plan;
    const m = normalizeMatch(old as Match);
    expect(m.status).toBe('played');
    expect(m.subs).toEqual([]);
    expect(m.plan.attack.buildup).toBe('');
    expect(m.goals[0].gtype).toBe('Jugada');
    expect(m.goals[0].field_zone).toBe('Z3');
    expect(normalizeMatch(m)).toEqual(m); // idempotente
  });
});
