import { zipSync } from 'fflate';
import { slug } from './boardExport';
import { todayISO } from './dates';
import { matchSections, reportSections, SCOPE_LABEL, tablesFor, type Scope } from './export';
import { saveBlob } from './platform';
import type { Dataset, Match, Team } from './types';
import { buildCsv, buildXlsx } from './xlsx';

export type Format = 'xlsx' | 'csv' | 'pdf';

/** Genera y descarga/comparte un archivo con los datos del alcance indicado. */
export async function runExport(scope: Scope, format: Format, d: Dataset, team: Team, match?: Match) {
  const base = `${slug(team.name)}_${match ? `partido_${slug(match.rival)}` : scope}_${todayISO()}`;
  const tables = tablesFor(scope, d);
  if (format === 'xlsx') return saveBlob(`${base}.xlsx`, buildXlsx(tables));
  if (format === 'csv') {
    if (tables.length === 1) return saveBlob(`${base}.csv`, buildCsv(tables[0]));
    const files: Record<string, Uint8Array> = {};
    for (const t of tables) files[`${slug(t.name)}.csv`] = new Uint8Array(await buildCsv(t).arrayBuffer());
    return saveBlob(`${base}_csv.zip`, new Blob([zipSync(files) as BlobPart], { type: 'application/zip' }));
  }
  if (scope === 'analiticas' && !match) return saveBlob(`${base}.pdf`, await (await import('./analyticsPdf')).buildAnalyticsPdf(d, team));
  const { buildReportPdf } = await import('./pdf');
  const subtitle = `${team.name}${team.category ? ` · ${team.category}` : ''} · ${team.season} · ${new Date().toLocaleDateString('es')}`;
  const blob = match
    ? await buildReportPdf({ title: `Ficha del partido: vs ${match.rival}`, subtitle, team: team.name, sections: matchSections(d, match) })
    : await buildReportPdf({ title: SCOPE_LABEL[scope], subtitle, team: team.name, sections: reportSections(scope, d), landscape: scope === 'plantilla' || scope === 'partidos' });
  return saveBlob(`${base}.pdf`, blob);
}
