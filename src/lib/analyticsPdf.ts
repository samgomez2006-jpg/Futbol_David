// Informe visual de analíticas en PDF: gráficos vectoriales dibujados directamente con jsPDF
// (barras, líneas, mapas de zonas) + tablas. Nada se rasteriza y nada se inventa: si falta un dato, la sección lo dice.

import type { jsPDF } from 'jspdf';
import { analyse, type Analysis, type ZoneAnalysis } from './analytics';
import { clean } from './pdf';
import { punctualityStats } from './punctuality';
import { activePlayers, playedMatches, playerStats, sortPlayers } from './stats';
import type { Dataset, Team } from './types';
import { ZONES, ZONE_H, ZONE_W, zoneCenter } from './zones';

type RGB = [number, number, number];
const NAVY: RGB = [20, 40, 75];
const FOR: RGB = [47, 95, 179];
const AGAINST: RGB = [217, 119, 6];
const WIN: RGB = [21, 128, 61];
const DRAW: RGB = [161, 92, 7];
const LOSS: RGB = [185, 28, 28];
const GRID: RGB = [222, 227, 236];
const MUTED: RGB = [100, 112, 135];
const INK: RGB = [30, 34, 44];
const M = 14;

const RES_COLOR = { V: WIN, E: [140, 148, 165] as RGB, D: LOSS };

type Doc = jsPDF;
interface Ctx {
  doc: Doc;
  y: number;
  w: number;
  h: number;
  cw: number;
}

const ensure = (c: Ctx, need: number) => {
  if (c.y + need > c.h - 16) {
    c.doc.addPage();
    c.y = 16;
  }
};

function heading(c: Ctx, title: string, sub?: string) {
  ensure(c, 34);
  c.y += 3;
  const { doc } = c;
  doc.setFont('helvetica', 'bold').setFontSize(12.5).setTextColor(...NAVY);
  doc.text(clean(title), M, c.y);
  doc.setDrawColor(...NAVY).setLineWidth(0.5).line(M, c.y + 1.8, M + 22, c.y + 1.8);
  c.y += 7;
  if (sub) {
    doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(...MUTED);
    const lines = doc.splitTextToSize(clean(sub), c.cw);
    doc.text(lines, M, c.y);
    c.y += lines.length * 3.8 + 2;
  }
  doc.setTextColor(...INK);
}

function note(c: Ctx, text: string) {
  ensure(c, 10);
  c.doc.setFont('helvetica', 'italic').setFontSize(8.5).setTextColor(...MUTED);
  const lines = c.doc.splitTextToSize(clean(text), c.cw);
  c.doc.text(lines, M, c.y + 3);
  c.y += lines.length * 3.8 + 6;
  c.doc.setTextColor(...INK);
}

function legend(c: Ctx, items: [string, RGB][], x = M, y = c.y) {
  let cx = x;
  c.doc.setFont('helvetica', 'normal').setFontSize(8.5);
  for (const [label, col] of items) {
    c.doc.setFillColor(...col).rect(cx, y - 2.6, 3.4, 3.4, 'F');
    c.doc.setTextColor(...INK).text(clean(label), cx + 5, y);
    cx += 8 + c.doc.getTextWidth(clean(label)) + 4;
  }
}

function kpiRow(c: Ctx, items: { v: string; l: string; tone?: RGB }[]) {
  ensure(c, 24);
  const gap = 3;
  const n = items.length;
  const bw = (c.cw - gap * (n - 1)) / n;
  items.forEach((it, i) => {
    const x = M + i * (bw + gap);
    c.doc.setFillColor(243, 245, 249).roundedRect(x, c.y, bw, 19, 2, 2, 'F');
    c.doc.setFont('helvetica', 'bold').setFontSize(15).setTextColor(...(it.tone ?? NAVY));
    c.doc.text(clean(it.v), x + bw / 2, c.y + 9, { align: 'center' });
    c.doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(...MUTED);
    c.doc.text(clean(it.l), x + bw / 2, c.y + 15, { align: 'center' });
  });
  c.y += 24;
  c.doc.setTextColor(...INK);
}

/** Ejes con líneas de guía; devuelve la función para pasar valores a coordenada Y. */
function axes(c: Ctx, x: number, y: number, w: number, h: number, max: number, ticks = 4) {
  const { doc } = c;
  doc.setDrawColor(...GRID).setLineWidth(0.2).setFont('helvetica', 'normal').setFontSize(7).setTextColor(...MUTED);
  for (let i = 0; i <= ticks; i++) {
    const v = (max / ticks) * i;
    const yy = y + h - (v / max) * h;
    doc.line(x, yy, x + w, yy);
    doc.text(String(Math.round(v * 10) / 10), x - 1.5, yy + 1, { align: 'right' });
  }
  doc.setDrawColor(...MUTED).setLineWidth(0.3).line(x, y + h, x + w, y + h);
  return (v: number) => y + h - (v / max) * h;
}

const niceMax = (v: number) => (v <= 4 ? 4 : Math.ceil(v / 4) * 4);

function groupedBars(c: Ctx, cats: { label: string; a: number; b: number }[], opts: { h?: number; la: string; lb: string }) {
  const h = opts.h ?? 46;
  ensure(c, h + 22);
  legend(c, [[opts.la, FOR], [opts.lb, AGAINST]]);
  c.y += 5;
  const x0 = M + 8;
  const w = c.cw - 8;
  const top = c.y;
  const max = niceMax(Math.max(1, ...cats.flatMap((k) => [k.a, k.b])));
  const yOf = axes(c, x0, top, w, h, max);
  const slot = w / cats.length;
  const bw = Math.min(7, slot * 0.36);
  cats.forEach((k, i) => {
    const cx = x0 + slot * i + slot / 2;
    c.doc.setFillColor(...FOR).rect(cx - bw, yOf(k.a), bw, top + h - yOf(k.a), 'F');
    c.doc.setFillColor(...AGAINST).rect(cx, yOf(k.b), bw, top + h - yOf(k.b), 'F');
    c.doc.setFont('helvetica', 'normal').setFontSize(cats.length > 14 ? 6 : 7).setTextColor(...MUTED);
    c.doc.text(clean(k.label), cx, top + h + 4, { align: 'center' });
  });
  c.y = top + h + 9;
}

function lineChart(c: Ctx, pts: number[], labels: string[], opts: { h?: number; color: RGB; title: string }) {
  const h = opts.h ?? 40;
  ensure(c, h + 16);
  c.doc.setFont('helvetica', 'bold').setFontSize(8.5).setTextColor(...INK).text(clean(opts.title), M, c.y);
  c.y += 3;
  const x0 = M + 8;
  const w = c.cw - 12;
  const top = c.y;
  const max = niceMax(Math.max(1, ...pts));
  const yOf = axes(c, x0, top, w, h, max);
  const step = pts.length > 1 ? w / (pts.length - 1) : 0;
  c.doc.setDrawColor(...opts.color).setLineWidth(0.8);
  pts.forEach((p, i) => {
    if (i) c.doc.line(x0 + step * (i - 1), yOf(pts[i - 1]), x0 + step * i, yOf(p));
  });
  pts.forEach((p, i) => {
    c.doc.setFillColor(...opts.color).circle(x0 + step * i + (pts.length === 1 ? w / 2 : 0), yOf(p), 1.1, 'F');
    if (i % Math.max(1, Math.ceil(pts.length / 12)) === 0) {
      c.doc.setFont('helvetica', 'normal').setFontSize(6.5).setTextColor(...MUTED).text(clean(labels[i]), x0 + step * i, top + h + 4, { align: 'center' });
    }
  });
  c.y = top + h + 9;
}

function hBars(c: Ctx, rows: { label: string; v: number; text?: string; color?: RGB }[], max?: number) {
  const m = max ?? Math.max(1, ...rows.map((r) => r.v));
  const lw = 44;
  const bw = c.cw - lw - 22;
  for (const r of rows) {
    ensure(c, 7);
    c.doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(...INK);
    c.doc.text(clean(r.label).slice(0, 26), M, c.y + 3.2);
    c.doc.setFillColor(238, 241, 246).rect(M + lw, c.y, bw, 4.4, 'F');
    c.doc.setFillColor(...(r.color ?? FOR)).rect(M + lw, c.y, Math.max(0.6, (r.v / m) * bw), 4.4, 'F');
    c.doc.setFont('helvetica', 'bold').setFontSize(8).text(clean(r.text ?? String(r.v)), M + lw + bw + 2, c.y + 3.4);
    c.y += 6.4;
  }
  c.y += 2;
}

function zoneMap(c: Ctx, x: number, y: number, w: number, a: ZoneAnalysis, col: RGB, title: string) {
  const { doc } = c;
  const k = w / ZONE_W;
  const H = ZONE_H * k;
  doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(...INK).text(clean(title), x + w / 2, y, { align: 'center' });
  const top = y + 3;
  doc.setFillColor(234, 241, 230).roundedRect(x, top, w, H, 2, 2, 'F');
  doc.setDrawColor(148, 173, 144).setLineWidth(0.3);
  doc.rect(x + 69 * k, top, 202 * k, 83 * k);
  doc.rect(x + 124 * k, top, 92 * k, 28 * k);
  doc.setLineDashPattern([1.2, 1.2], 0);
  for (const z of ZONES) doc.rect(x + z.x * k, top + z.y * k, z.w * k, z.h * k);
  doc.setLineDashPattern([], 0);
  const bubbles = ZONES.map((z) => ({ z, s: a.zones[z.id] })).filter((b) => b.s.goals > 0).map((b) => ({ ...b, r: Math.max(7, 5.6 * Math.sqrt(b.s.pct)) })).sort((p, q) => q.r - p.r);
  for (const { z, s, r } of bubbles) {
    const [zx, zy] = zoneCenter(z);
    const cx = Math.min(Math.max(zx, r + 3), ZONE_W - r - 3);
    const cy = Math.min(Math.max(zy, r + 3), ZONE_H - r - 3);
    doc.setGState(doc.GState({ opacity: 0.62 }));
    doc.setFillColor(...col).circle(x + cx * k, top + cy * k, r * k, 'F');
    doc.setGState(doc.GState({ opacity: 1 }));
    doc.setDrawColor(...col).setLineWidth(0.4).circle(x + cx * k, top + cy * k, r * k, 'S');
    doc.setFont('helvetica', 'bold').setFontSize(r >= 20 ? 9 : 7.5).setTextColor(r >= 13 ? 255 : INK[0], r >= 13 ? 255 : INK[1], r >= 13 ? 255 : INK[2]);
    doc.text(`${Math.round(s.pct)}%`, x + cx * k, top + cy * k + 1.2, { align: 'center' });
  }
  doc.setTextColor(...INK);
  return top + H;
}

function table(c: Ctx, head: string[], rows: (string | number)[][], autoTable: (d: Doc, o: object) => void, widths?: number[]) {
  ensure(c, 20);
  autoTable(c.doc, {
    startY: c.y, head: [head.map(clean)], body: rows.map((r) => r.map(clean)), theme: 'striped',
    styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 1.7, textColor: INK },
    headStyles: { fillColor: NAVY, textColor: 255, fontStyle: 'bold' }, alternateRowStyles: { fillColor: [243, 245, 249] },
    margin: { left: M, right: M, bottom: 16 },
    columnStyles: widths ? Object.fromEntries(widths.map((wd, i) => [i, { cellWidth: wd }])) : undefined,
  });
  c.y = (c.doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
}

/** Tramos proporcionales a la duración del partido (6 tramos). */
function goalsByBand(d: Dataset) {
  const ms = playedMatches(d);
  const bands = 6;
  const f = new Array(bands).fill(0) as number[];
  const a = new Array(bands).fill(0) as number[];
  let known = 0;
  let unknown = 0;
  for (const m of ms) {
    const at = (min: number) => Math.min(bands - 1, Math.max(0, Math.floor(((min - 0.001) / m.total_mins) * bands)));
    for (const g of m.goals) {
      if (g.min == null) unknown++;
      else {
        f[at(g.min)]++;
        known++;
      }
    }
    for (const g of m.conceded) {
      if (g.min == null) unknown++;
      else {
        a[at(g.min)]++;
        known++;
      }
    }
  }
  const mean = ms.length ? Math.round(ms.reduce((s, m) => s + m.total_mins, 0) / ms.length) : 60;
  const labels = Array.from({ length: bands }, (_, i) => `${Math.round((mean / bands) * i)}-${Math.round((mean / bands) * (i + 1))}'`);
  return { f, a, labels, known, unknown };
}

export async function buildAnalyticsPdf(d: Dataset, team: Team): Promise<Blob> {
  const [{ jsPDF }, auto] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const autoTable = auto.default as unknown as (d: Doc, o: object) => void;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const c: Ctx = { doc, y: 0, w: doc.internal.pageSize.getWidth(), h: doc.internal.pageSize.getHeight(), cw: doc.internal.pageSize.getWidth() - M * 2 };
  const a: Analysis = analyse(d);
  const played = playedMatches(d).sort((p, q) => (p.date < q.date ? -1 : 1));

  // --- Portada / cabecera ---
  doc.setFillColor(...NAVY).rect(0, 0, c.w, 42, 'F');
  doc.setTextColor(255, 255, 255).setFont('helvetica', 'bold').setFontSize(22).text('Informe de analíticas', M, 20);
  doc.setFontSize(13).text(clean(team.name), M, 29);
  doc.setFont('helvetica', 'normal').setFontSize(10);
  doc.text(clean([team.category, team.season && `Temporada ${team.season}`].filter(Boolean).join(' · ') || ' '), M, 35);
  doc.text(`Fecha del informe: ${new Date().toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' })}`, c.w - M, 35, { align: 'right' });
  c.y = 54;
  doc.setTextColor(...INK);

  if (!played.length) {
    heading(c, 'Sin partidos jugados');
    note(c, 'Todavía no hay partidos jugados registrados: el informe se completará automáticamente con las estadísticas cuando los haya.');
  } else {
    // --- 1. Resumen ---
    const s = a.summary;
    heading(c, '1. Resumen de la temporada', `${a.total} partidos jugados · datos registrados por el entrenador.`);
    kpiRow(c, [
      { v: String(s.played), l: 'Partidos' }, { v: `${s.w}-${s.dr}-${s.l}`, l: 'G-E-P' }, { v: String(s.pts), l: 'Puntos' },
      { v: String(s.gf), l: 'Goles a favor', tone: FOR }, { v: String(s.ga), l: 'Goles en contra', tone: AGAINST },
    ]);
    kpiRow(c, [
      { v: `${Math.round(a.winPct)}%`, l: '% victorias' }, { v: a.ppg.toFixed(2).replace('.', ','), l: 'Puntos / partido' },
      { v: (s.gf / s.played).toFixed(1).replace('.', ','), l: 'Goles a favor / p.', tone: FOR }, { v: (s.ga / s.played).toFixed(1).replace('.', ','), l: 'Goles en contra / p.', tone: AGAINST },
      { v: String(s.cleanSheets), l: 'Porterías a cero' },
    ]);

    // --- 2. Resultados ---
    heading(c, '2. Resultados y tendencia');
    ensure(c, 34);
    legend(c, [['Victoria', WIN], ['Empate', RES_COLOR.E], ['Derrota', LOSS]]);
    c.y += 5;
    const n = a.series.length;
    const cell = Math.min(11, (c.cw - 2) / n);
    a.series.forEach((p, i) => {
      const x = M + i * cell;
      doc.setFillColor(...RES_COLOR[p.res]).roundedRect(x, c.y, cell - 1, 9, 1, 1, 'F');
      doc.setTextColor(255, 255, 255).setFont('helvetica', 'bold').setFontSize(cell < 8 ? 6 : 7.5).text(`${p.gf}-${p.ga}`, x + (cell - 1) / 2, c.y + 5.8, { align: 'center' });
      doc.setTextColor(...MUTED).setFont('helvetica', 'normal').setFontSize(6).text(clean(p.rival).slice(0, Math.max(3, Math.floor(cell * 0.75))), x + (cell - 1) / 2, c.y + 13, { align: 'center' });
    });
    c.y += 19;
    let acc = 0;
    lineChart(c, a.series.map((p) => (acc += p.pts)), a.series.map((_, i) => String(i + 1)), { color: NAVY, title: 'Puntos acumulados por jornada jugada' });

    // --- 3. Goles ---
    heading(c, '3. Evolución de goles', 'Goles marcados y recibidos en cada partido, en orden cronológico.');
    groupedBars(c, a.series.map((p, i) => ({ label: String(i + 1), a: p.gf, b: p.ga })), { la: 'Goles a favor', lb: 'Goles en contra' });
    doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(...MUTED);
    doc.text(clean(`Rivales por orden: ${a.series.map((p, i) => `${i + 1} ${p.rival}`).join(' · ')}`), M, c.y, { maxWidth: c.cw });
    c.y += Math.ceil(doc.getTextWidth(clean(`Rivales por orden: ${a.series.map((p, i) => `${i + 1} ${p.rival}`).join(' · ')}`)) / c.cw) * 3.8 + 4;
    doc.setTextColor(...INK);

    // Local / visitante
    ensure(c, 30);
    hBars(c, [
      { label: `Local (${a.local.n} p.)`, v: a.local.w * 3 + a.local.e, text: `${a.local.w}G ${a.local.e}E ${a.local.d}P`, color: FOR },
      { label: `Visitante (${a.visit.n} p.)`, v: a.visit.w * 3 + a.visit.e, text: `${a.visit.w}G ${a.visit.e}E ${a.visit.d}P`, color: AGAINST },
    ], Math.max(1, a.local.w * 3 + a.local.e, a.visit.w * 3 + a.visit.e));
    note(c, 'Barras: puntos obtenidos como local y como visitante.');

    // --- 4. Por tiempos ---
    heading(c, '4. Goles por parte y por minuto');
    const h = a.halves;
    if (h.gfH1 + h.gfH2 + h.gaH1 + h.gaH2 === 0) note(c, 'No hay goles con minuto registrado, así que no se puede repartir por partes ni por tramos.');
    else {
      groupedBars(c, [{ label: '1ª parte', a: h.gfH1, b: h.gaH1 }, { label: '2ª parte', a: h.gfH2, b: h.gaH2 }], { la: 'A favor', lb: 'En contra', h: 34 });
      const g = goalsByBand(d);
      groupedBars(c, g.f.map((v, i) => ({ label: g.labels[i], a: v, b: g.a[i] })), { la: 'A favor', lb: 'En contra', h: 40 });
      note(c, `Tramos proporcionales a la duración de cada partido (6 tramos). ${g.unknown ? `${g.unknown} goles sin minuto no se incluyen.` : ''}`.trim());
    }

    // --- 5. Zonas ---
    heading(c, '5. Zonas de gol', 'Media pista con la portería atacada arriba. El área de cada burbuja es proporcional al % de goles de la zona.');
    const enough = (z: ZoneAnalysis) => z.enough;
    ensure(c, 78);
    const mw = (c.cw - 8) / 2;
    if (enough(a.zonesFor) || enough(a.zonesAgainst)) {
      const bottoms = [
        enough(a.zonesFor) ? zoneMap(c, M, c.y, mw, a.zonesFor, FOR, `Goles realizados (${a.zonesFor.withZone} con zona)`) : c.y,
        enough(a.zonesAgainst) ? zoneMap(c, M + mw + 8, c.y, mw, a.zonesAgainst, AGAINST, `Goles recibidos (${a.zonesAgainst.withZone} con zona)`) : c.y,
      ];
      if (!enough(a.zonesFor) || !enough(a.zonesAgainst)) {
        doc.setFont('helvetica', 'italic').setFontSize(8.5).setTextColor(...MUTED);
        doc.text('Aún no hay goles con zona suficientes para este mapa.', enough(a.zonesFor) ? M + mw + 8 : M, c.y + 20, { maxWidth: mw });
      }
      c.y = Math.max(...bottoms) + 6;
      const rowsFor = a.zonesFor.ranking.slice(0, 5).map((z) => [z.label, z.goals, `${Math.round(z.pct)}%`]);
      const rowsAg = a.zonesAgainst.ranking.slice(0, 5).map((z) => [z.label, z.goals, `${Math.round(z.pct)}%`]);
      if (rowsFor.length) table(c, ['Zona (goles a favor)', 'Goles', '%'], rowsFor, autoTable, [110, 30, 42]);
      if (rowsAg.length) table(c, ['Zona (goles en contra)', 'Goles', '%'], rowsAg, autoTable, [110, 30, 42]);
    } else note(c, `Registra la zona de al menos 5 goles a favor o en contra para ver los mapas (ahora: ${a.zonesFor.withZone} a favor y ${a.zonesAgainst.withZone} en contra).`);

    // --- 6. Jugadores ---
    heading(c, '6. Estadísticas de jugadores');
    const players = sortPlayers(activePlayers(d));
    const rows = players.map((p) => ({ p, st: playerStats(d, p.id) }));
    const scorers = [...rows].filter((r) => r.st.goals > 0).sort((x, y) => y.st.goals - x.st.goals).slice(0, 8);
    if (scorers.length) {
      doc.setFont('helvetica', 'bold').setFontSize(8.5).text('Goleadores', M, c.y);
      c.y += 3;
      hBars(c, scorers.map((r) => ({ label: r.p.name, v: r.st.goals, text: `${r.st.goals} (${r.st.assists} as.)` })));
    }
    table(c, ['Nº', 'Jugador', 'Pos.', 'PJ', 'Tit.', 'Min.', '% min', 'G', 'A', 'TA', 'TR'],
      rows.map(({ p, st }) => [p.number ?? '', p.name, p.position.slice(0, 3), st.matches, st.starts, st.mins, `${st.minsPct}%`, st.goals, st.assists, st.yellows, st.reds]), autoTable, [10, 56, 14, 12, 12, 16, 16, 12, 12, 11, 11]);

    // --- 7. Minutos ---
    heading(c, '7. Evolución de minutos', 'Minutos jugados y comparación entre los 3 últimos partidos y los anteriores.');
    const used = played.map((m) => m.lineup.filter((e) => e.mins > 0).length);
    if (used.some((u) => u > 0)) lineChart(c, used, played.map((_, i) => String(i + 1)), { color: FOR, title: 'Jugadores utilizados por partido (rotación)' });
    const loads = [...a.loads].filter((l) => l.mins > 0).sort((x, y) => y.mins - x.mins);
    if (loads.length) {
      hBars(c, loads.slice(0, 14).map((l) => ({ label: l.name, v: l.mins, text: `${l.mins}' (${Math.round(l.pct)}%)` })));
      if (loads.some((l) => l.matches >= 4)) table(c, ['Jugador', 'Últ. 3 partidos (min/p.)', 'Anteriores (min/p.)', 'Carga'], loads.filter((l) => l.matches >= 4).map((l) => [l.name, l.recentAvg, l.earlierAvg, l.level]), autoTable);
    } else note(c, 'Aún no hay minutos registrados.');

    // --- 8. Tendencias ---
    heading(c, '8. Tendencias y hallazgos');
    if (!a.findings.length) note(c, 'Aún no hay suficientes datos para detectar tendencias (se necesitan al menos 3 partidos).');
    else {
      for (const f of a.findings) {
        const text = clean(`${f.title}. ${f.text}`);
        const lines = doc.splitTextToSize(text, c.cw - 8) as string[];
        ensure(c, lines.length * 4 + 4);
        doc.setFillColor(...(f.level === 'warn' ? DRAW : f.level === 'good' ? WIN : FOR)).rect(M, c.y - 3, 1.6, lines.length * 4 + 1, 'F');
        doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(...INK).text(lines, M + 4.5, c.y);
        c.y += lines.length * 4 + 3;
      }
      note(c, 'Basado en los datos registrados; son tendencias, no conclusiones absolutas.');
    }
    if (a.patterns.length) table(c, ['Aspecto observado', 'Área', 'Partidos', 'Tono'], a.patterns.map((p) => [p.label, p.area, `${p.matches} de ${p.observed}`, p.tone]), autoTable);

    // --- 9. Puntualidad (solo si hay datos) ---
    const punct = players.map((p) => ({ p, s: punctualityStats(d, p.id) })).filter((x) => x.s.attended > 0);
    if (punct.length) {
      heading(c, '9. Puntualidad', 'Acumulado de entrenos y convocatorias con asistencia registrada.');
      const worst = [...punct].sort((x, y) => y.s.lates - x.s.lates).slice(0, 10);
      if (worst.some((x) => x.s.lates > 0)) hBars(c, worst.filter((x) => x.s.lates > 0).map((x) => ({ label: x.p.name, v: x.s.lates, text: `${x.s.lates} (${x.s.pctLate}%)`, color: DRAW })));
      else note(c, 'Nadie tiene retrasos registrados.');
    }
  }

  // Pie de página
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(120, 130, 150);
    doc.text(clean(`${team.name} · Informe de analíticas · Mi Equipo FC`), M, c.h - 7);
    doc.text(`${i} / ${pages}`, c.w - M, c.h - 7, { align: 'right' });
  }
  return doc.output('blob');
}
