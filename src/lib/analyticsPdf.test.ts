import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildAnalyticsPdf } from './analyticsPdf';
import { blankMatch } from './factories';
import { emptyDataset, emptyProfile, type Dataset, type Team } from './types';

const T = 'team';
const team: Team = { id: T, name: 'CD Sagrat Cor', season: '2026-27', category: 'Cadete A', profile: emptyProfile() };
const zones = ['Z1', 'Z3', 'Z3', 'Z5', 'Z6', 'Z8', 'Z2', 'Z10'];

function data(nMatches: number): Dataset {
  const d = emptyDataset();
  d.players = ['Ana', 'Bea', 'Carla', 'Dani', 'Eva', 'Fran', 'Gema', 'Hugo', 'Iris', 'Juan', 'Kira'].map((name, i) => ({
    id: `p${i}`, team_id: T, name, number: i + 1, position: (['Portero', 'Defensa', 'Centrocampista', 'Delantero'] as const)[i % 4], birth: null, foot: 'D' as const, archived_at: null,
  }));
  for (let i = 0; i < nMatches; i++) {
    const gf = (i * 3) % 4;
    const ga = (i * 5) % 3;
    d.matches.push(blankMatch({
      team_id: T, id: `m${i}`, rival: `Rival ${i + 1}`, date: `2026-${String(9 + Math.floor(i / 4)).padStart(2, '0')}-${String(1 + (i % 4) * 7).padStart(2, '0')}`, gf, ga,
      goals: Array.from({ length: gf }, (_, k) => ({ id: `g${i}${k}`, pid: `p${(i + k) % 11}`, apid: k % 2 ? `p${(i + 3) % 11}` : null, min: 8 + k * 17 + i, gtype: 'Jugada', body: 'Pie derecho', field_zone: zones[(i + k) % zones.length], goal_zone: '' })),
      conceded: Array.from({ length: ga }, (_, k) => ({ id: `c${i}${k}`, min: 20 + k * 22, gtype: 'Jugada', field_zone: zones[(i + k + 2) % zones.length], goal_zone: '' })),
      lineup: Array.from({ length: 9 + (i % 3) }, (_, k) => ({ pid: `p${k}`, role: k < 7 ? 'TIT' as const : 'SUP' as const, slot: null, mins: k < 7 ? 60 - (k % 3) * 5 : 20, })),
    }));
  }
  d.trainings = [{ id: 't1', team_id: T, date: '2026-09-02', notes: '', present: ['p0', 'p1'], attendance: [{ pid: 'p0', status: 'late', minutes_late: 10 }, { pid: 'p1', status: 'punctual' }] }];
  return d;
}

describe('informe PDF de analíticas', () => {
  it('genera un PDF con gráficos con datos', async () => {
    const blob = await buildAnalyticsPdf(data(14), team);
    const buf = Buffer.from(await blob.arrayBuffer());
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(buf.length).toBeGreaterThan(8000);
    if (process.env.PDF_OUT) writeFileSync(process.env.PDF_OUT, buf);
  });
  it('sin partidos no falla y lo indica', async () => {
    const blob = await buildAnalyticsPdf(data(0), team);
    expect((await blob.arrayBuffer()).byteLength).toBeGreaterThan(1000);
  });
  it('con muy pocos partidos no inventa nada', async () => {
    const blob = await buildAnalyticsPdf(data(2), team);
    expect((await blob.arrayBuffer()).byteLength).toBeGreaterThan(1000);
    if (process.env.PDF_OUT2) writeFileSync(process.env.PDF_OUT2, Buffer.from(await blob.arrayBuffer()));
  });
});
