import { describe, expect, it } from 'vitest';
import { parseActa, parseMatches, parseScorers, parseStandings } from '../../server/fcf';
import { blankMatch } from '../factories';
import { normalizeFcfLink } from '../normalize';
import { findTeam, goalTiming, headToHead, insights, positionHistory, shortTeamName, teamRecord, teamScorers } from './analysis';
import { actaOfMatch, planCalendar } from './calendar';
import type { FcfGroupData, FcfLink, FcfMatch } from './types';

// Datos sintéticos con la forma real de la FCF (sin datos de personas reales).
const raw = (acta: string, round: number, date: string | null, h: [string, string], a: [string, string], hg: number | null, ag: number | null) => ({
  CODACTA: acta, JORNADA: String(round), COMIENZO1: date ? `${date} 11:30:00` : null, CODEQUIPO_CASA: h[0], NOMBRE_CASA: h[1], CODEQUIPO_FUERA: a[0], NOMBRE_FUERA: a[1],
  GOLES_CASA: hg === null ? null : String(hg), GOLES_FUERA: ag === null ? null : String(ag), CERRADA: hg === null ? '0' : '1', CAMPO: 'CAMP MPAL.',
});
const US: [string, string] = ['100', 'SAGRAT COR, C.E. A'];
const R1: [string, string] = ['200', 'NAVATA, C.F. A'];
const R2: [string, string] = ['300', 'LES PRESES, C.F. A'];
const R3: [string, string] = ['400', 'NAVATA, C.F. B'];
const BYE: [string, string] = ['-1', 'Descans'];

const rawMatches = {
  1: [raw('1', 1, '2026-09-05', US, R1, 2, 1), raw('2', 1, '2026-09-05', R2, R3, 0, 0)],
  2: [raw('3', 2, '2026-09-12', R1, R2, 3, 1), raw('4', 2, '2026-09-12', R3, US, 1, 1)],
  3: [raw('5', 3, '2026-09-19', US, R2, 0, 2), raw('6', 3, '2026-09-19', R3, R1, 0, 4)],
  4: [raw('7', 4, '2026-09-26', R1, US, null, null), raw('8', 4, null, R2, BYE, null, null)],
};

function group(): FcfGroupData {
  const matches = parseMatches(rawMatches);
  return {
    groupId: '9', season: '22', fetchedAt: new Date().toISOString(), matches,
    teams: [US, R1, R2, R3].map(([id, name]) => ({ id, name, logo: null })),
    standings: parseStandings({ data: [{ position: '1', team: { name: R1[1], teamId: '200' }, points: '6.00', played: 3, won: 2, drawn: 0, lost: 1, goalsFor: '8', goalsAgainst: '3' }] }),
    scorers: parseScorers([{ nombre_jugador: 'JUGADOR, UNO', codequipo: '200', codjugador: '1', goles: 5, penalti: 1, total: 3, nombre_equipo: 'NAVATA, C.F.' }, { nombre_jugador: 'JUGADOR, DOS', codequipo: '200', codjugador: '2', goles: 2, penalti: 0, total: 3, nombre_equipo: 'NAVATA, C.F.' }]),
  };
}
const link = (links: Record<string, string> = {}): FcfLink => ({
  season: { id: '22', label: '2026-2027' }, discipline: { id: '1', label: 'Futbol 11' }, competition: { id: '2', label: 'CADET PRIMERA DIVISIÓ S15' },
  group: { id: '9', label: 'GRUP 1' }, team: { id: '100', label: US[1] }, halfMins: 40, links, linkedAt: '2026-09-01T00:00:00Z',
});

/** Payload RSC como el de la página del acta. */
function actaHtml(goals: [string, string, string, number][]) {
  const parts = ['{"children":"2 - 1"}'].concat(goals.map(([score, name, type, min]) =>
    `{"children":"${score}"}],"$L1",["$","div",null,{"children":[["$","$L2",null,{"player":{"id":"9","nombre":"${name}","dorsal":"7"},"teamName":"X","children":["$","span",null,{"children":["${name}"," ",["$","span",null,{"children":["(","${type}"," ","(${min}')",")"]}]]}]}]]}`));
  const payload = JSON.stringify(parts.join(','));
  return `<html><script>self.__next_f.push([1,${payload}])</script></html>`;
}

describe('parsers FCF', () => {
  it('partidos: resultados, pendientes y descansos', () => {
    const m = parseMatches(rawMatches);
    expect(m).toHaveLength(8);
    expect(m[0]).toMatchObject({ acta: '1', round: 1, date: '2026-09-05', time: '11:30', hg: 2, ag: 1, closed: true, bye: false });
    expect(m.find((x) => x.acta === '7')).toMatchObject({ closed: false, hg: null });
    expect(m.find((x) => x.acta === '8')?.bye).toBe(true);
  });
  it('acta: minuto, tipo y equipo por el marcador', () => {
    const a = parseActa('1', actaHtml([['1 - 0', 'A, B', 'GOL', 12], ['1 - 1', 'C, D', 'GOL PENAL', 44], ['2 - 1', 'E, F', 'GOL EN PROPIA', 70]]));
    expect(a.goals).toEqual([
      { min: 12, kind: 'goal', side: 'home', player: 'A, B' },
      { min: 44, kind: 'penalty', side: 'away', player: 'C, D' },
      { min: 70, kind: 'own', side: 'home', player: 'E, F' },
    ]);
  });
  it('acta sin goles o con formato desconocido: lista vacía, sin inventar', () => {
    expect(parseActa('1', '<html>nada</html>').goals).toEqual([]);
  });
});

describe('análisis de rival', () => {
  it('récord, casa/fuera y medias', () => {
    const r = teamRecord(group(), '200');
    expect(r).toMatchObject({ pj: 3, w: 2, d: 0, l: 1, gf: 8, ga: 3, pts: 6 });
    expect(r.home).toMatchObject({ pj: 1, w: 1, gf: 3 });
    expect(r.away).toMatchObject({ pj: 2, w: 1, l: 1 });
    expect(r.upcoming.map((m) => m.acta)).toEqual(['7']);
    expect(r.avgGf).toBeCloseTo(8 / 3);
  });
  it('evolución de la clasificación por jornada', () => {
    const h = positionHistory(group());
    expect(h.get('200')!.map((p) => p.pos)).toEqual([4, 2, 1]);
    expect(h.get('100')!.map((p) => p.pts)).toEqual([3, 4, 4]);
  });
  it('enfrentamientos directos', () => {
    expect(headToHead(group(), '100', '200').map((p) => [p.gf, p.ga])).toEqual([[2, 1]]);
  });
  it('goleadores con % sobre los goles del equipo', () => {
    const s = teamScorers(group(), '200', 8);
    expect(s.list.map((x) => Math.round(x.share))).toEqual([63, 25]);
    expect(s.maybeIncomplete).toBe(false);
  });
  it('goles por partes y tramos solo con actas cargadas; frases solo con muestra suficiente', () => {
    const g = group();
    const actas = {
      '1': { id: '1', goals: [{ min: 10, kind: 'goal' as const, side: 'home' as const, player: '' }, { min: 50, kind: 'goal' as const, side: 'away' as const, player: '' }, { min: 75, kind: 'goal' as const, side: 'home' as const, player: '' }] },
      '3': { id: '3', goals: [{ min: 41, kind: 'goal' as const, side: 'home' as const, player: '' }, { min: 55, kind: 'goal' as const, side: 'home' as const, player: '' }, { min: 60, kind: 'goal' as const, side: 'home' as const, player: '' }, { min: 5, kind: 'goal' as const, side: 'away' as const, player: '' }] },
      '6': { id: '6', goals: [{ min: 70, kind: 'goal' as const, side: 'away' as const, player: '' }, { min: 71, kind: 'goal' as const, side: 'away' as const, player: '' }, { min: 72, kind: 'goal' as const, side: 'away' as const, player: '' }, { min: null, kind: 'goal' as const, side: 'away' as const, player: '' }] },
    };
    const t = goalTiming(g, '200', actas, 40);
    expect(t.loaded).toBe(3);
    // Navata (200): acta 1 fuera → marca el 50'; acta 3 en casa → 41', 55', 60'; acta 6 fuera → 70', 71', 72' y uno sin minuto.
    expect([t.forH1, t.forH2, t.forNoMin]).toEqual([0, 7, 1]);
    expect([t.agH1, t.agH2]).toEqual([2, 1]);
    const f = insights(teamRecord(g, '200'), t);
    expect(f[0]).toBe('El rival ha marcado el 100 % de sus goles en la segunda parte.');
    expect(f.some((x) => x.startsWith('Encaja'))).toBe(false); // solo 3 goles recibidos con minuto
  });
});

describe('reconocer rival y nombres', () => {
  const teams = group().teams;
  it('encuentra al rival escrito a mano', () => {
    expect(findTeam('Navata', teams)?.id).toBe('200');
    expect(findTeam('CF Navata B', teams)?.id).toBe('400');
    expect(findTeam('Les Preses', teams)?.id).toBe('300');
    expect(findTeam('Girona FC', teams)).toBeNull();
  });
  it('nombre corto', () => {
    expect(shortTeamName('NAVATA, C.F. A')).toBe('Navata A');
    expect(shortTeamName("L'ESCALA, F.C. B")).toBe("L'Escala B");
  });
});

describe('calendario sin duplicados', () => {
  it('crea pendientes, vincula existentes y no duplica al repetir', () => {
    const g = group();
    const existing = blankMatch({ rival: 'Navata', date: '2026-09-05', status: 'played', gf: 2, ga: 1 });
    const p1 = planCalendar([existing], link(), g, 't');
    expect(p1.linked).toBe(1);
    expect(p1.links['1']).toBe(existing.id);
    expect(p1.create).toHaveLength(1); // solo el pendiente (acta 7)
    expect(p1.create[0]).toMatchObject({ rival: 'Navata A', date: '2026-09-26', venue: 'V', status: 'scheduled', competition: 'CADET PRIMERA DIVISIÓ S15' });
    const all = [existing, ...p1.create];
    const p2 = planCalendar(all, link(p1.links), g, 't');
    expect(p2.create).toHaveLength(0);
    expect(p2.update).toHaveLength(0);
    // La FCF cambia la fecha → se actualiza solo ese partido.
    const moved = { ...g, matches: g.matches.map((m: FcfMatch) => (m.acta === '7' ? { ...m, date: '2026-09-27' } : m)) };
    const p3 = planCalendar(all, link(p1.links), moved, 't');
    expect(p3.update.map((m) => m.date)).toEqual(['2026-09-27']);
    expect(actaOfMatch(link(p1.links), p1.create[0].id)).toBe('7');
  });
  it('no toca partidos jugados ni en la papelera', () => {
    const g = group();
    const m = blankMatch({ rival: 'Navata', date: '2026-09-20', status: 'scheduled', deleted_at: '2026-09-01T00:00:00Z' });
    const p = planCalendar([m], link({ '7': m.id }), g, 't');
    expect(p.update).toHaveLength(0);
    expect(p.create).toHaveLength(0);
  });
});

describe('vinculación guardada en el perfil', () => {
  it('valida y descarta datos rotos', () => {
    expect(normalizeFcfLink(link({ '7': 'x' }))?.links).toEqual({ '7': 'x' });
    expect(normalizeFcfLink({ ...link(), team: { id: 'abc' } })).toBeNull();
    expect(normalizeFcfLink({ ...link(), halfMins: 500 })?.halfMins).toBe(40);
  });
});
