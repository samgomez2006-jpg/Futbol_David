// Escritor mínimo de .xlsx (Office Open XML) sin dependencias de terceros salvo fflate (zip).
// Una hoja por tabla: cabecera en azul marino con texto blanco, primera fila fija y columnas ajustadas.

import { strToU8, zipSync } from 'fflate';

export interface Table {
  name: string;
  head: string[];
  rows: (string | number | null)[][];
}

const esc = (s: string) =>
  s.replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]!)
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');

export const colName = (i: number): string => {
  let s = '';
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
};

/** Nombre de hoja válido en Excel: ≤31 caracteres, sin []:*?/\ y único. */
export function sheetNames(tables: Table[]): string[] {
  const used = new Set<string>();
  return tables.map((t) => {
    const base = t.name.replace(/[[\]:*?/\\]/g, ' ').trim().slice(0, 31) || 'Hoja';
    let n = base;
    for (let i = 2; used.has(n.toLowerCase()); i++) n = `${base.slice(0, 28)} ${i}`;
    used.add(n.toLowerCase());
    return n;
  });
}

function sheetXml(t: Table): string {
  const all = [t.head, ...t.rows];
  const widths = t.head.map((_, c) => Math.min(60, Math.max(8, ...all.map((r) => String(r[c] ?? '').split('\n')[0].length + 2))));
  const cols = widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('');
  const rowXml = (r: (string | number | null)[], ri: number, header: boolean) =>
    `<row r="${ri + 1}">${r
      .map((v, ci) => {
        const ref = `${colName(ci)}${ri + 1}`;
        if (v === null || v === '') return header ? `<c r="${ref}" s="1"/>` : '';
        if (typeof v === 'number' && Number.isFinite(v)) return `<c r="${ref}"${header ? ' s="1"' : ''}><v>${v}</v></c>`;
        return `<c r="${ref}" t="inlineStr"${header ? ' s="1"' : ' s="2"'}><is><t xml:space="preserve">${esc(String(v))}</t></is></c>`;
      })
      .join('')}</row>`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${cols}</cols><sheetData>${all.map((r, i) => rowXml(r, i, i === 0)).join('')}</sheetData></worksheet>`;
}

export function buildXlsx(tables: Table[]): Blob {
  const names = sheetNames(tables);
  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${tables
        .map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
        .join('')}</Types>`,
    ),
    '_rels/.rels': strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    ),
    'xl/workbook.xml': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${names
        .map((n, i) => `<sheet name="${esc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
        .join('')}</sheets></workbook>`,
    ),
    'xl/_rels/workbook.xml.rels': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${tables
        .map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`)
        .join('')}<Relationship Id="rId${tables.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    ),
    'xl/styles.xml': strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF14284B"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>',
    ),
  };
  tables.forEach((t, i) => (files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(sheetXml(t))));
  return new Blob([zipSync(files, { level: 6 }) as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

/** CSV para Excel en español: separador «;», UTF-8 con BOM, comillas dobles escapadas. */
export function buildCsv(t: Table): Blob {
  const cell = (v: string | number | null) => {
    const s = v === null ? '' : String(v);
    // Protege contra fórmulas al abrir en Excel (=, +, -, @) sin alterar los números.
    const safe = typeof v === 'string' && /^[=+\-@]/.test(s) ? `'${s}` : s;
    return /[";\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  const lines = [t.head, ...t.rows].map((r) => r.map(cell).join(';'));
  return new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
}
