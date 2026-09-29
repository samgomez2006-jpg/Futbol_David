import { unzipSync, strFromU8 } from 'fflate';
import { describe, expect, it } from 'vitest';
import { blankMatch } from './factories';
import { goalsTable, matchesTable, matchSections, minutesTable, playersTable, tablesFor, zonesTable } from './export';
import { emptyDataset, type Dataset } from './types';
import { buildCsv, buildXlsx, colName, sheetNames } from './xlsx';

function data(): Dataset {
  const d = emptyDataset();
  d.players = [
    { id: 'a', team_id: 'T', name: 'Ana "La Pistola"', number: 9, position: 'Delantero', birth: '2010-01-01', foot: 'D', archived_at: null },
    { id: 'b', team_id: 'T', name: 'Bea', number: null, position: 'Portero', birth: null, foot: 'I', archived_at: null },
  ];
  d.matches = [
    blankMatch({ id: 'm1', team_id: 'T', rival: 'Norte; FC', date: '2026-09-06', gf: 1, ga: 1, notes: '=SUMA(1)', goals: [{ id: 'g', pid: 'a', apid: null, min: 10, gtype: 'Penalti', body: '', field_zone: 'Z1', goal_zone: '' }], conceded: [{ id: 'c', min: 40, gtype: 'Centro', field_zone: 'Z8', goal_zone: '' }], lineup: [{ pid: 'a', role: 'TIT', slot: 'DEL#9', mins: 60 }, { pid: 'b', role: 'SUP', slot: null, mins: 0 }] }),
    blankMatch({ id: 'm2', team_id: 'T', rival: 'Futuro', status: 'scheduled', date: '2099-01-01' }),
  ];
  return d;
}

describe('tablas de exportación', () => {
  const d = data();
  it('plantilla incluye minutos y estadísticas', () => {
    const t = playersTable(d);
    const ana = t.rows.find((r) => r[1] === 'Ana "La Pistola"')!;
    expect(ana[t.head.indexOf('Minutos')]).toBe(60);
    expect(ana[t.head.indexOf('Goles')]).toBe(1);
  });
  it('partidos: un programado no exporta resultado', () => {
    const t = matchesTable(d);
    expect(t.rows).toHaveLength(2);
    expect(t.rows[0][t.head.indexOf('Resultado')]).toBe('Empate');
    expect(t.rows[1][t.head.indexOf('Estado')]).toBe('Programado');
    expect(t.rows[1][t.head.indexOf('Goles a favor')]).toBeNull();
  });
  it('goles con tipo y zona; minutos por partido; zonas con porcentajes', () => {
    expect(goalsTable(d).rows).toEqual([
      ['06/09/2026', 'Norte; FC', 'A favor', 10, 'Penalti', 'Área pequeña', 'Ana "La Pistola"', '', ''],
      ['06/09/2026', 'Norte; FC', 'En contra', 40, 'Centro', 'Banda izquierda', '', '', ''],
    ]);
    expect(minutesTable(d).rows[0][5]).toBe(60);
    const z = zonesTable(d).rows.find((r) => r[0] === 'A favor' && r[1] === 'Área pequeña')!;
    expect(z.slice(2)).toEqual([1, 100]);
  });
  it('ficha de partido en PDF incluye las secciones con datos', () => {
    const titles = matchSections(d, d.matches[0]).map((s) => s.title);
    expect(titles).toEqual(expect.arrayContaining(['Datos del partido', 'Alineación', 'Goles', 'Observaciones']));
    expect(tablesFor('todo', d).length).toBeGreaterThanOrEqual(8);
  });
});

describe('xlsx y csv', () => {
  it('colName', () => expect([0, 25, 26, 27, 701].map(colName)).toEqual(['A', 'Z', 'AA', 'AB', 'ZZ']));
  it('nombres de hoja válidos y únicos', () => {
    expect(sheetNames([{ name: 'A/B:C', head: [], rows: [] }, { name: 'A B C', head: [], rows: [] }, { name: 'x'.repeat(40), head: [], rows: [] }])).toEqual(['A B C', 'A B C 2', 'x'.repeat(31)]);
  });
  it('genera un zip con las partes de Office Open XML y escapa el texto', async () => {
    const blob = buildXlsx([{ name: 'Datos', head: ['Nombre', 'N'], rows: [['A & <B>', 3], [null, 4]] }]);
    const files = unzipSync(new Uint8Array(await blob.arrayBuffer()));
    expect(Object.keys(files).sort()).toEqual(['[Content_Types].xml', '_rels/.rels', 'xl/_rels/workbook.xml.rels', 'xl/styles.xml', 'xl/workbook.xml', 'xl/worksheets/sheet1.xml']);
    const sheet = strFromU8(files['xl/worksheets/sheet1.xml']);
    expect(sheet).toContain('A &amp; &lt;B&gt;');
    expect(sheet).toContain('<c r="B2"><v>3</v></c>');
    expect(sheet).toContain('<pane ySplit="1"');
  });
  it('csv: separador ;, BOM, comillas escapadas y protección contra fórmulas', async () => {
    const blob = buildCsv({ name: 'x', head: ['a', 'b'], rows: [['Norte; FC', 'di "hola"'], ['=1+1', 5]] });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]); // BOM UTF-8 para que Excel lea las tildes
    const text = new TextDecoder().decode(bytes.slice(3));
    expect(text).toContain('"Norte; FC";"di ""hola"""');
    expect(text).toContain("'=1+1;5");
  });
});
