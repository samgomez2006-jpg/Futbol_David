import { describe, expect, it } from 'vitest';
import { makeBackup, parseBackup } from './backup';
import { playerStats } from './stats';

// Estructura real del localStorage 'miecfc_v4' del HTML original.
const legacy = {
  cfg: { name: 'Alevín A', season: '2024-25', cat: 'Alevín' },
  players: [
    { id: 1, name: 'Hugo <img src=x onerror=alert(1)>', number: '10', position: 'Delantero', birth: '2014-03-02', foot: 'I' },
    { id: 2, name: 'Leo', number: '', position: 'Portero', birth: '', foot: 'D' },
  ],
  matches: [
    {
      id: 1, rival: 'CD Norte', date: '2025-10-05', gf: 2, ga: 1, result: 'V', venue: 'L', tactic: '4-4-2', totalMins: 60, notes: '', motm: 1,
      goals: [{ pid: '1', apid: '2', min: '12', gtype: 'Contraataque', body: 'Pie izquierdo', fieldZone: 'Dentro del área', goalZone: 'Centro' }],
      conceded: [{ min: '40', gtype: 'Córner', fieldZone: '', goalZone: '' }],
      playtime: [{ pid: 1, mins: 60, role: 'TIT', bench: false, posKey: 'DEL19', position: 'DEL1' }, { pid: 2, mins: 0, role: 'SUP', bench: true }],
      cards: [{ pid: '2', type: 'Y', min: '30' }, { pid: '99', type: 'R', min: '3' }],
    },
  ],
  trainings: [{ id: 1, date: '2025-10-01', notes: '', present: [1, 2, 7] }],
  evaluations: [{ id: 1, pid: 1, date: '2025-10-02', skills: { Técnica: 8, Pase: '7', Inventada: 3 }, notes: 'ok' }],
  objectives: [{ id: 1, title: 'Goles', type: 'player', pid: 1, cat: 'goals', target: 10 }],
  callups: [{ id: 1, rival: 'CD Norte', date: '2025-10-05', players: [{ pid: 1, status: 'confirmed' }] }],
  nPid: 3, nMid: 2,
};

describe('parseBackup (formato antiguo v4)', () => {
  const { team, data } = parseBackup(legacy, 'T1');

  it('convierte ids numéricos a UUID y conserva la configuración', () => {
    expect(team.name).toBe('Alevín A');
    expect(data.players).toHaveLength(2);
    expect(data.players[0].id).toMatch(/^[0-9a-f-]{36}$/);
    expect(data.players[0].team_id).toBe('T1');
    expect(data.players[0].number).toBe(10);
    expect(data.players[1].number).toBeNull();
    expect(data.players[1].birth).toBeNull();
  });

  it('repara las referencias en string (bug del original) y las estadísticas funcionan', () => {
    const hugo = data.players[0].id;
    const leo = data.players[1].id;
    const m = data.matches[0];
    expect(m.goals[0].pid).toBe(hugo);
    expect(m.goals[0].apid).toBe(leo);
    expect(m.goals[0].min).toBe(12);
    expect(m.goals[0].field_zone).toBe('Z3'); // zona antigua → id de zona actual
    expect(m.motm).toBe(hugo);
    expect(m.lineup.find((e) => e.pid === hugo)?.slot).toBe('DEL1#9');
    expect(playerStats(data, hugo).goals).toBe(1);
    expect(playerStats(data, leo).yellows).toBe(1);
  });

  it('descarta referencias a jugadores inexistentes', () => {
    expect(data.matches[0].cards).toHaveLength(1);
    expect(data.trainings[0].present).toHaveLength(2);
  });

  it('sanea evaluaciones, objetivos y convocatorias', () => {
    expect(data.evaluations[0].skills).toEqual({ Técnica: 8, Pase: 7 });
    expect(data.objectives[0].scope).toBe('player');
    expect(data.callups[0].players[0].status).toBe('confirmed');
  });

  it('guarda el texto tal cual (React lo escapa al pintar, no se ejecuta)', () => {
    expect(data.players[0].name).toContain('<img');
  });
});

describe('parseBackup (formato nuevo)', () => {
  it('ida y vuelta conserva los datos con UUID nuevos', () => {
    const first = parseBackup(legacy, 'T1');
    const backup = JSON.parse(JSON.stringify(makeBackup({ id: 'T1', ...first.team }, first.data)));
    const again = parseBackup(backup, 'T2');
    expect(again.data.players.map((p) => p.name)).toEqual(first.data.players.map((p) => p.name));
    expect(again.data.players[0].id).not.toBe(first.data.players[0].id);
    expect(again.data.players[0].team_id).toBe('T2');
    expect(playerStats(again.data, again.data.players[0].id).goals).toBe(1);
  });

  it('rechaza archivos que no son copias', () => {
    expect(() => parseBackup({ foo: 1 }, 'T')).toThrow();
    expect(() => parseBackup('x', 'T')).toThrow();
  });
});

describe('equipo de partida SAGRAT COR (incluido en la app)', () => {
  it('se carga con su plantilla completa y datos coherentes', async () => {
    const { seedFor } = await import('./seed');
    const { team, data } = seedFor('T');
    expect(team).toMatchObject({ name: 'SAGRAT COR', season: '2026-27', category: 'CADETE SUB15' });
    expect(data.players).toHaveLength(17);
    expect(data.players.every((p) => p.team_id === 'T' && p.name)).toBe(true);
    expect(data.players.map((p) => p.position)).toContain('Portero');
  });
});
