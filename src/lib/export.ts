// Construye las tablas de datos que se exportan a Excel / CSV / PDF a partir del estado de la app.

import { analyse, fmtPct } from './analytics';
import { fmtDate, ageYears } from './dates';
import { resolveAssign } from './lineup';
import { activePlayers, callupOfMatch, playedMatches, playerStats, resultOf, sortPlayers, squadOf } from './stats';
import { normalizeTraining } from './normalize';
import { PUNCT_LABEL } from './punctuality';
import type { Arrival, Dataset, Match } from './types';
import { zoneLabel, ZONES } from './zones';
import type { PdfSection } from './pdf';
import type { Table } from './xlsx';

export type Scope = 'todo' | 'plantilla' | 'partidos' | 'asistencia' | 'analiticas' | 'jugadas';
export const SCOPE_LABEL: Record<Scope, string> = {
  todo: 'Todos los datos de la temporada', plantilla: 'Plantilla y estadísticas', partidos: 'Partidos, goles y minutos',
  asistencia: 'Convocatorias y asistencia', analiticas: 'Analíticas y zonas de gol', jugadas: 'Jugadas de la pizarra',
};

const RESULT = { V: 'Victoria', E: 'Empate', D: 'Derrota' } as const;
const POS = { TIT: 'Titular', SUP: 'Suplente' } as const;

export function playersTable(d: Dataset): Table {
  const active = sortPlayers(activePlayers(d));
  return {
    name: 'Plantilla',
    head: ['Dorsal', 'Nombre', 'Posición', 'Pie', 'Edad', 'Partidos', 'Titular', 'Suplente', 'Minutos', '% minutos', 'Media min.', 'Goles', 'Asistencias', 'Amarillas', 'Rojas', 'Porterías a cero', 'MVP', 'Entrenos', '% asistencia', 'Convocado'],
    rows: active.map((p) => {
      const s = playerStats(d, p.id);
      return [p.number, p.name, p.position, { D: 'Derecho', I: 'Izquierdo', A: 'Ambidiestro' }[p.foot], ageYears(p.birth), s.matches, s.starts, s.subApps, s.mins, s.minsPct, s.avgMins, s.goals, s.assists, s.yellows, s.reds, s.cleanSheets, s.motm, s.trains, s.attPct, s.called];
    }),
  };
}

const nameOf = (d: Dataset, pid: string | null) => (pid ? d.players.find((p) => p.id === pid)?.name ?? '' : '');
const byDate = (a: Match, b: Match) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
const liveMatches = (d: Dataset) => d.matches.filter((m) => !m.deleted_at).sort(byDate);

export function matchesTable(d: Dataset): Table {
  return {
    name: 'Partidos',
    head: ['Fecha', 'Rival', 'Local/Visitante', 'Competición', 'Estado', 'Goles a favor', 'Goles en contra', 'Resultado', 'Sistema', 'Convocados', 'Observaciones'],
    rows: liveMatches(d).map((m) => {
      const played = m.status === 'played';
      return [fmtDate(m.date), m.rival, m.venue === 'L' ? 'Local' : 'Visitante', m.competition, played ? 'Jugado' : 'Programado', played ? m.gf : null, played ? m.ga : null, played ? RESULT[resultOf(m)] : '', m.tactic, squadOf(d, m)?.length ?? null, m.notes];
    }),
  };
}

export function goalsTable(d: Dataset): Table {
  const rows: (string | number | null)[][] = [];
  for (const m of playedMatches(d).sort(byDate)) {
    for (const g of m.goals) rows.push([fmtDate(m.date), m.rival, 'A favor', g.min, g.gtype, zoneLabel(g.field_zone), nameOf(d, g.pid), nameOf(d, g.apid), g.body]);
    for (const g of m.conceded) rows.push([fmtDate(m.date), m.rival, 'En contra', g.min, g.gtype, zoneLabel(g.field_zone), '', '', '']);
  }
  return { name: 'Goles', head: ['Fecha', 'Rival', 'Tipo', 'Minuto', 'Tipo de gol', 'Zona', 'Goleador', 'Asistente', 'Parte del cuerpo'], rows };
}

export function minutesTable(d: Dataset): Table {
  const rows: (string | number | null)[][] = [];
  for (const m of playedMatches(d).sort(byDate))
    for (const e of m.lineup) rows.push([fmtDate(m.date), m.rival, nameOf(d, e.pid), POS[e.role], e.slot ? e.slot.split('#')[0].replace(/\d+$/, '') : '', e.mins]);
  return { name: 'Minutos', head: ['Fecha', 'Rival', 'Jugador', 'Rol', 'Posición', 'Minutos'], rows };
}

const arrivalCells = (a: Arrival | null | undefined): (string | number | null)[] =>
  a ? [PUNCT_LABEL[a.status], a.status === 'late' ? a.minutes_late ?? null : null, a.arrival_time ?? '', a.note ?? ''] : ['', null, '', ''];

export function callupsTable(d: Dataset): Table {
  const rows: (string | number | null)[][] = [];
  for (const c of [...d.callups].sort((a, b) => (a.date < b.date ? -1 : 1)))
    for (const p of c.players) rows.push([fmtDate(c.date), c.rival, c.meet_time, c.place, nameOf(d, p.pid), p.status === 'confirmed' ? 'Convocado' : p.status === 'declined' ? 'Baja' : 'Pendiente', ...arrivalCells(p.status === 'confirmed' ? p.arrival : null)]);
  return { name: 'Convocatorias', head: ['Fecha', 'Rival', 'Hora', 'Lugar', 'Jugador', 'Estado', 'Puntualidad', 'Min. retraso', 'Hora llegada', 'Observación'], rows };
}

export function trainingsTable(d: Dataset): Table {
  const rows: (string | number | null)[][] = [];
  const players = sortPlayers(activePlayers(d));
  for (const raw of [...d.trainings].sort((a, b) => (a.date < b.date ? -1 : 1))) {
    const t = normalizeTraining(raw);
    for (const p of players) {
      const a = t.attendance.find((x) => x.pid === p.id) ?? { status: 'absent' as const };
      rows.push([fmtDate(t.date), t.notes, p.name, a.status === 'absent' ? 'No' : 'Sí', ...arrivalCells(a)]);
    }
  }
  return { name: 'Entrenos', head: ['Fecha', 'Notas', 'Jugador', 'Presente', 'Puntualidad', 'Min. retraso', 'Hora llegada', 'Observación'], rows };
}

export function zonesTable(d: Dataset): Table {
  const a = analyse(d);
  const rows: (string | number | null)[][] = [];
  for (const [label, z] of [['A favor', a.zonesFor], ['En contra', a.zonesAgainst]] as const)
    for (const zone of ZONES) rows.push([label, zone.label, z.zones[zone.id].goals, Math.round(z.zones[zone.id].pct * 10) / 10]);
  return { name: 'Zonas de gol', head: ['Goles', 'Zona', 'Cantidad', '% sobre goles con zona'], rows };
}

export function analyticsTable(d: Dataset): Table {
  const a = analyse(d);
  const rows: (string | number | null)[][] = [
    ['Partidos jugados', a.total], ['Puntos', a.summary.pts], ['Victorias / Empates / Derrotas', `${a.summary.w} / ${a.summary.dr} / ${a.summary.l}`],
    ['Goles a favor', a.summary.gf], ['Goles en contra', a.summary.ga], ['Porterías a cero', a.summary.cleanSheets], ['Puntos por partido', Math.round(a.ppg * 100) / 100],
    ['Goles a favor 1ª / 2ª parte', `${a.halves.gfH1} / ${a.halves.gfH2}`], ['Goles en contra 1ª / 2ª parte', `${a.halves.gaH1} / ${a.halves.gaH2}`],
    ...a.findings.map((f) => [`Hallazgo (${f.area})`, `${f.title}. ${f.text}`]),
    ...a.patterns.map((p) => [`Patrón en observaciones (${p.area})`, `${p.label}: ${p.matches} de ${p.observed} partidos`]),
  ];
  return { name: 'Analíticas', head: ['Indicador', 'Valor'], rows };
}

export function playsTable(d: Dataset): Table {
  return { name: 'Jugadas', head: ['Título', 'Tipo', 'Descripción', 'Elementos', 'Líneas'], rows: d.plays.map((p) => [p.title, p.kind, p.description, p.data.items.length, p.data.lines.length]) };
}

export function tablesFor(scope: Scope, d: Dataset): Table[] {
  switch (scope) {
    case 'plantilla': return [playersTable(d), minutesTable(d)];
    case 'partidos': return [matchesTable(d), goalsTable(d), minutesTable(d), callupsTable(d)];
    case 'asistencia': return [trainingsTable(d), callupsTable(d)];
    case 'analiticas': return [analyticsTable(d), zonesTable(d)];
    case 'jugadas': return [playsTable(d)];
    default: return [playersTable(d), matchesTable(d), goalsTable(d), minutesTable(d), callupsTable(d), trainingsTable(d), zonesTable(d), analyticsTable(d), playsTable(d)];
  }
}

// --- PDF ---------------------------------------------------------------------------------------------
const pick = (t: Table, cols: string[], title: string, note?: string): PdfSection => {
  const idx = cols.map((c) => t.head.indexOf(c));
  return { title, head: cols, rows: t.rows.map((r) => idx.map((i) => r[i] ?? '')), note };
};

export function reportSections(scope: Scope, d: Dataset): PdfSection[] {
  const a = analyse(d);
  const players = playersTable(d);
  const matches = matchesTable(d);
  const s = {
    plantilla: [pick(players, ['Dorsal', 'Nombre', 'Posición', 'Partidos', 'Titular', 'Minutos', '% minutos', 'Goles', 'Asistencias', 'Amarillas', 'Rojas', '% asistencia'], 'Plantilla y estadísticas')],
    partidos: [pick(matches, ['Fecha', 'Rival', 'Local/Visitante', 'Competición', 'Estado', 'Goles a favor', 'Goles en contra', 'Resultado', 'Sistema'], 'Partidos')],
    asistencia: [pick(playersTable(d), ['Nombre', 'Entrenos', '% asistencia', 'Convocado'], 'Asistencia y convocatorias')],
    analiticas: [
      { title: 'Resumen', head: ['Indicador', 'Valor'], rows: analyticsTable(d).rows.slice(0, 9).map((r) => r.map((v) => v ?? '')) },
      { title: 'Hallazgos', head: ['Área', 'Hallazgo'], rows: a.findings.map((f) => [f.area, `${f.title}. ${f.text}`]), note: 'Basado en los datos registrados; son tendencias, no conclusiones absolutas.' },
      { title: 'Goles por zona', head: ['Goles', 'Zona', 'Cantidad', '% sobre goles con zona'], rows: zonesTable(d).rows.filter((r) => Number(r[2]) > 0).map((r) => r.map((v) => v ?? '')) },
      { title: 'Patrones detectados en las observaciones', head: ['Aspecto', 'Área', 'Partidos', 'Tono'], rows: a.patterns.map((p) => [p.label, p.area, `${p.matches} de ${p.observed}`, p.tone]), note: 'Detectados a partir de las observaciones escritas por el entrenador.' },
    ],
    jugadas: [pick(playsTable(d), ['Título', 'Tipo', 'Descripción'], 'Jugadas guardadas')],
    todo: [] as PdfSection[],
  };
  return scope === 'todo' ? [...s.plantilla, ...s.partidos, ...s.analiticas] : s[scope];
}

/** Ficha completa de un partido en formato PDF. */
export function matchSections(d: Dataset, m: Match): PdfSection[] {
  const name = (id: string | null) => nameOf(d, id) || '—';
  const kv = (rows: [string, string | number | null | undefined][]) => rows.filter(([, v]) => v !== '' && v != null).map(([k, v]) => [k, String(v)]);
  const callup = callupOfMatch(d, m);
  const { assign } = resolveAssign(m.tactic, m.lineup);
  const starters = m.lineup.filter((e) => e.role === 'TIT');
  const played = m.status === 'played';
  const sections: PdfSection[] = [
    {
      title: 'Datos del partido', head: ['Concepto', 'Detalle'],
      rows: kv([
        ['Rival', m.rival], ['Fecha', fmtDate(m.date)], ['Local / visitante', m.venue === 'L' ? 'Local' : 'Visitante'], ['Competición', m.competition],
        ['Resultado', played ? `${m.gf} - ${m.ga} (${RESULT[resultOf(m)]})` : 'Programado'], ['Sistema', m.tactic], ['Hora de citación', callup?.meet_time], ['Lugar', callup?.place],
        ['Jugador del partido', m.motm ? name(m.motm) : ''],
      ]),
    },
  ];
  const called = callup?.players.filter((p) => p.status === 'confirmed') ?? [];
  if (called.length) sections.push({ title: `Convocados (${called.length})`, head: ['Jugadores'], rows: [[called.map((p) => name(p.pid)).join(', ')]] });
  if (starters.length)
    sections.push({
      title: 'Alineación', head: ['Posición', 'Jugador', 'Minutos'],
      rows: starters.map((e) => [Object.entries(assign).find(([, pid]) => pid === e.pid)?.[0]?.split('#')[0].replace(/\d+$/, '') ?? '', name(e.pid), e.mins]),
    });
  const bench = m.lineup.filter((e) => e.role === 'SUP');
  if (bench.length) sections.push({ title: 'Suplentes', head: ['Jugador', 'Minutos'], rows: bench.map((e) => [name(e.pid), e.mins]) });
  if (m.subs.length) sections.push({ title: 'Cambios', head: ['Minuto', 'Sale', 'Entra'], rows: m.subs.map((s) => [s.min ?? '', name(s.out_pid), name(s.in_pid)]) });
  if (m.goals.length || m.conceded.length)
    sections.push({
      title: 'Goles', head: ['Min.', 'Equipo', 'Jugador', 'Tipo', 'Zona'],
      rows: [...m.goals.map((g) => [g.min ?? '', 'A favor', g.gtype === 'Propia puerta' ? 'Propia puerta' : name(g.pid), g.gtype, zoneLabel(g.field_zone)]), ...m.conceded.map((g) => [g.min ?? '', 'En contra', '', g.gtype, zoneLabel(g.field_zone)])],
    });
  if (m.cards.length || m.incidents.length)
    sections.push({ title: 'Incidencias', head: ['Min.', 'Detalle'], rows: [...m.cards.map((c) => [c.min ?? '', `${c.type === 'Y' ? 'Amarilla' : 'Roja'}: ${name(c.pid)}`]), ...m.incidents.map((i) => [i.min ?? '', i.text])] });
  const r = m.rival_info;
  const rival = kv([['Observaciones generales', r.general], ['Características', r.traits], ['Fortalezas', r.strengths], ['Debilidades', r.weaknesses], ['Sistema', r.system], ['Jugadores relevantes', r.key_players], ['Otra información', r.other]]);
  if (rival.length) sections.push({ title: 'Información del rival', head: ['Aspecto', 'Detalle'], rows: rival });
  const a = m.plan.attack;
  const df = m.plan.defense;
  const atk = kv([['Objetivos ofensivos', a.objectives], ['Salida de balón', a.buildup], ['Progresión', a.progression], ['Ataque', a.attack], ['Ocupación de espacios', a.spaces], ['Principios ofensivos', a.principles], ['Indicaciones para este rival', a.specific]]);
  const def = kv([['Organización defensiva', df.organization], ['Presión', df.press], ['Bloque defensivo', df.block], ['Marcajes', df.marking], ['Vigilancias', df.vigilance], ['Objetivos defensivos', df.objectives], ['Indicaciones para este rival', df.specific]]);
  if (atk.length) sections.push({ title: 'Planteamiento en ataque', head: ['Aspecto', 'Detalle'], rows: atk });
  if (def.length) sections.push({ title: 'Planteamiento en defensa', head: ['Aspecto', 'Detalle'], rows: def });
  if (m.notes.trim()) sections.push({ title: 'Observaciones', head: ['Notas'], rows: [[m.notes]] });
  return sections;
}

export { fmtPct };
