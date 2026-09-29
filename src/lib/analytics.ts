// Analíticas inteligentes: convierte los partidos registrados en hallazgos que un entrenador
// difícilmente vería mirando solo las estadísticas. Todo se calcula con partidos JUGADOS.

import { compareDateDesc } from './dates';
import { detectPatterns, MIN_OBSERVED, type Pattern } from './patterns';
import { playedMatches, pointsOf, resultOf, sortPlayers, teamSummary, type TeamSummary } from './stats';
import type { Dataset, Match, Result } from './types';
import { MIN_ZONE_GOALS, ZONES, zoneLabel } from './zones';

export const fmtPct = (v: number, digits = 0) => `${v.toFixed(digits).replace('.', ',')}\u00A0%`;
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const round1 = (n: number) => Math.round(n * 10) / 10;

export type Level = 'good' | 'warn' | 'info';
export interface Finding {
  id: string;
  level: Level;
  area: 'Resultados' | 'Goles' | 'Defensa' | 'Zonas' | 'Plantilla' | 'Observaciones' | 'Sistema' | 'Disciplina';
  title: string;
  text: string;
}

export interface MatchPoint {
  id: string;
  date: string;
  rival: string;
  gf: number;
  ga: number;
  res: Result;
  pts: number;
}

export interface Halves {
  gfH1: number;
  gfH2: number;
  gaH1: number;
  gaH2: number;
  /** Goles sin minuto registrado (no entran en el reparto). */
  unknown: number;
}

export interface PlayerLoad {
  pid: string;
  name: string;
  number: number | null;
  position: string;
  mins: number;
  matches: number;
  pct: number; // % de los minutos posibles
  recentAvg: number; // minutos por partido en los 3 últimos
  earlierAvg: number; // minutos por partido en los anteriores
  level: 'alta' | 'normal' | 'baja';
}

export interface ZoneGoal {
  matchId: string;
  rival: string;
  date: string;
  min: number | null;
  gtype: string;
  scorer: string | null;
}
export interface ZoneStat {
  id: string;
  label: string;
  goals: number;
  pct: number; // goles de la zona / goles con zona × 100
  items: ZoneGoal[];
  /** Goles en la primera / segunda mitad de los partidos jugados (evolución). */
  earlier: number;
  recent: number;
}
export interface ZoneAnalysis {
  totalGoals: number; // todos los goles (con o sin zona)
  withZone: number;
  noZone: number;
  enough: boolean;
  zones: Record<string, ZoneStat>;
  ranking: ZoneStat[]; // con goles, de más a menos
  topShare: number; // % de la zona principal
  matchesWithGoals: number;
}

export interface Analysis {
  total: number;
  summary: TeamSummary;
  winPct: number;
  csPct: number;
  ppg: number;
  series: MatchPoint[]; // cronológico
  halves: Halves;
  local: { n: number; w: number; e: number; d: number };
  visit: { n: number; w: number; e: number; d: number };
  goalTypes: { scored: [string, number][]; conceded: [string, number][] };
  bodyParts: [string, number][];
  tactics: { tactic: string; played: number; w: number; pts: number; gf: number; ga: number }[];
  loads: PlayerLoad[];
  zonesFor: ZoneAnalysis;
  zonesAgainst: ZoneAnalysis;
  patterns: Pattern[];
  observed: number;
  findings: Finding[];
}

const countBy = <T,>(xs: T[], key: (x: T) => string | null | undefined) => {
  const out: Record<string, number> = {};
  for (const x of xs) {
    const k = key(x);
    if (k) out[k] = (out[k] ?? 0) + 1;
  }
  return Object.entries(out).sort((a, b) => b[1] - a[1]);
};

/** Reparto de goles por mitad usando el minuto respecto a la duración de cada partido. */
export function halvesOf(ms: Match[]): Halves {
  const h: Halves = { gfH1: 0, gfH2: 0, gaH1: 0, gaH2: 0, unknown: 0 };
  for (const m of ms) {
    const half = m.total_mins / 2;
    for (const g of m.goals) {
      if (g.min == null) h.unknown++;
      else if (g.min <= half) h.gfH1++;
      else h.gfH2++;
    }
    for (const g of m.conceded) {
      if (g.min == null) h.unknown++;
      else if (g.min <= half) h.gaH1++;
      else h.gaH2++;
    }
  }
  return h;
}

export function zoneAnalysis(ms: Match[], kind: 'scored' | 'conceded', names: Map<string, string>): ZoneAnalysis {
  const chrono = [...ms].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const midpoint = Math.floor(chrono.length / 2);
  const zones: Record<string, ZoneStat> = {};
  for (const z of ZONES) zones[z.id] = { id: z.id, label: z.label, goals: 0, pct: 0, items: [], earlier: 0, recent: 0 };
  let totalGoals = 0;
  let withZone = 0;
  const matchIds = new Set<string>();

  chrono.forEach((m, i) => {
    const list = kind === 'scored' ? m.goals : m.conceded;
    for (const g of list) {
      totalGoals++;
      const z = zones[g.field_zone];
      if (!z) continue;
      withZone++;
      matchIds.add(m.id);
      z.goals++;
      if (i < midpoint) z.earlier++;
      else z.recent++;
      z.items.push({
        matchId: m.id, rival: m.rival, date: m.date, min: g.min, gtype: g.gtype,
        scorer: kind === 'scored' ? names.get((g as Match['goals'][number]).pid ?? '') ?? null : null,
      });
    }
  });

  for (const z of Object.values(zones)) z.pct = withZone ? (z.goals / withZone) * 100 : 0;
  const ranking = Object.values(zones).filter((z) => z.goals > 0).sort((a, b) => b.goals - a.goals);
  return {
    totalGoals, withZone, noZone: totalGoals - withZone, enough: withZone >= MIN_ZONE_GOALS, zones, ranking,
    topShare: ranking[0]?.pct ?? 0, matchesWithGoals: matchIds.size,
  };
}

export function playerLoads(d: Dataset, ms: Match[]): PlayerLoad[] {
  const chrono = [...ms].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const possible = chrono.reduce((a, m) => a + m.total_mins, 0);
  const recentIds = new Set(chrono.slice(-3).map((m) => m.id));
  return sortPlayers(d.players.filter((p) => !p.archived_at))
    .map((p) => {
      let mins = 0;
      let played = 0;
      const rec: number[] = [];
      const ear: number[] = [];
      for (const m of chrono) {
        const e = m.lineup.find((x) => x.pid === p.id);
        const v = e?.mins ?? 0;
        if (v > 0) {
          mins += v;
          played++;
        }
        (recentIds.has(m.id) ? rec : ear).push(v);
      }
      const pct = possible ? Math.round((mins / possible) * 100) : 0;
      const level: PlayerLoad['level'] = chrono.length >= 4 && p.position !== 'Portero' && pct >= 80 ? 'alta' : chrono.length >= 5 && pct < 15 ? 'baja' : 'normal';
      return { pid: p.id, name: p.name, number: p.number, position: p.position, mins, matches: played, pct, recentAvg: Math.round(avg(rec)), earlierAvg: Math.round(avg(ear)), level };
    })
    .sort((a, b) => b.mins - a.mins);
}

export function analyse(d: Dataset): Analysis {
  const ms = playedMatches(d);
  const summary = teamSummary(ms);
  const total = ms.length;
  const chrono = [...ms].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const series: MatchPoint[] = chrono.map((m) => ({ id: m.id, date: m.date, rival: m.rival, gf: m.gf, ga: m.ga, res: resultOf(m), pts: pointsOf(resultOf(m)) }));
  const rec = (xs: Match[]) => ({
    n: xs.length,
    w: xs.filter((m) => resultOf(m) === 'V').length,
    e: xs.filter((m) => resultOf(m) === 'E').length,
    d: xs.filter((m) => resultOf(m) === 'D').length,
  });
  const local = rec(ms.filter((m) => m.venue === 'L'));
  const visit = rec(ms.filter((m) => m.venue === 'V'));
  const halves = halvesOf(ms);
  const names = new Map(d.players.map((p) => [p.id, p.name]));
  const zonesFor = zoneAnalysis(ms, 'scored', names);
  const zonesAgainst = zoneAnalysis(ms, 'conceded', names);
  const loads = playerLoads(d, ms);
  const { patterns, observed } = detectPatterns(ms);
  const allGoals = ms.flatMap((m) => m.goals);
  const allConceded = ms.flatMap((m) => m.conceded);
  const goalTypes = { scored: countBy(allGoals, (g) => g.gtype), conceded: countBy(allConceded, (g) => g.gtype) };
  const bodyParts = countBy(allGoals, (g) => g.body);

  const tmap: Record<string, Analysis['tactics'][number]> = {};
  for (const m of ms) {
    if (!m.tactic) continue;
    const t = (tmap[m.tactic] ??= { tactic: m.tactic, played: 0, w: 0, pts: 0, gf: 0, ga: 0 });
    const r = resultOf(m);
    t.played++;
    t.pts += pointsOf(r);
    if (r === 'V') t.w++;
    t.gf += m.gf;
    t.ga += m.ga;
  }
  const tactics = Object.values(tmap).sort((a, b) => b.pts / b.played - a.pts / a.played || b.played - a.played);

  const f: Finding[] = [];
  const add = (x: Finding) => f.push(x);

  if (total >= 3) {
    const ppg = summary.pts / total;

    // --- Resultados: tendencia ----------------------------------------------------------------
    if (total >= 6) {
      const last = series.slice(-3);
      const prev = series.slice(0, -3);
      const dp = avg(last.map((s) => s.pts)) - avg(prev.map((s) => s.pts));
      if (dp >= 1) add({ id: 'trend-up', level: 'good', area: 'Resultados', title: 'Mejora reciente en resultados', text: `En los 3 últimos partidos sumas ${round1(avg(last.map((s) => s.pts)))} puntos por partido frente a ${round1(avg(prev.map((s) => s.pts)))} antes.` });
      else if (dp <= -1) add({ id: 'trend-down', level: 'warn', area: 'Resultados', title: 'Bajón reciente en resultados', text: `En los 3 últimos partidos sumas ${round1(avg(last.map((s) => s.pts)))} puntos por partido frente a ${round1(avg(prev.map((s) => s.pts)))} antes.` });
      const dgf = avg(last.map((s) => s.gf)) - avg(prev.map((s) => s.gf));
      const dga = avg(last.map((s) => s.ga)) - avg(prev.map((s) => s.ga));
      if (dgf <= -0.8) add({ id: 'gf-down', level: 'warn', area: 'Goles', title: 'Se marcan menos goles últimamente', text: `Media de ${round1(avg(last.map((s) => s.gf)))} goles a favor en los 3 últimos partidos (${round1(avg(prev.map((s) => s.gf)))} antes).` });
      else if (dgf >= 0.8) add({ id: 'gf-up', level: 'good', area: 'Goles', title: 'Se marcan más goles últimamente', text: `Media de ${round1(avg(last.map((s) => s.gf)))} goles a favor en los 3 últimos partidos (${round1(avg(prev.map((s) => s.gf)))} antes).` });
      if (dga >= 0.8) add({ id: 'ga-up', level: 'warn', area: 'Defensa', title: 'Se encaja más últimamente', text: `Media de ${round1(avg(last.map((s) => s.ga)))} goles en contra en los 3 últimos partidos (${round1(avg(prev.map((s) => s.ga)))} antes).` });
      else if (dga <= -0.8) add({ id: 'ga-down', level: 'good', area: 'Defensa', title: 'La defensa mejora', text: `Media de ${round1(avg(last.map((s) => s.ga)))} goles en contra en los 3 últimos partidos (${round1(avg(prev.map((s) => s.ga)))} antes).` });
    }

    // --- Primera vs segunda parte -------------------------------------------------------------
    const ga = halves.gaH1 + halves.gaH2;
    if (ga >= 4) {
      if (halves.gaH2 >= halves.gaH1 * 1.7 && halves.gaH2 - halves.gaH1 >= 2)
        add({ id: 'ga-h2', level: 'warn', area: 'Defensa', title: 'Se encaja mucho más en la segunda parte', text: `${halves.gaH2} de ${ga} goles encajados (${fmtPct((halves.gaH2 / ga) * 100)}) llegan tras el descanso. Puede indicar pérdida de concentración o de físico.` });
      else if (halves.gaH1 >= halves.gaH2 * 1.7 && halves.gaH1 - halves.gaH2 >= 2)
        add({ id: 'ga-h1', level: 'warn', area: 'Defensa', title: 'Se encaja mucho más en la primera parte', text: `${halves.gaH1} de ${ga} goles encajados (${fmtPct((halves.gaH1 / ga) * 100)}) llegan antes del descanso. Revisa el inicio del partido y la organización defensiva.` });
    }
    const gf = halves.gfH1 + halves.gfH2;
    if (gf >= 4) {
      if (halves.gfH2 >= halves.gfH1 * 1.7 && halves.gfH2 - halves.gfH1 >= 2)
        add({ id: 'gf-h2', level: 'info', area: 'Goles', title: 'Marcas sobre todo en la segunda parte', text: `${halves.gfH2} de ${gf} goles (${fmtPct((halves.gfH2 / gf) * 100)}) llegan tras el descanso: el equipo crece con el partido o los cambios aportan.` });
      else if (halves.gfH1 >= halves.gfH2 * 1.7 && halves.gfH1 - halves.gfH2 >= 2)
        add({ id: 'gf-h1', level: 'info', area: 'Goles', title: 'Marcas sobre todo en la primera parte', text: `${halves.gfH1} de ${gf} goles (${fmtPct((halves.gfH1 / gf) * 100)}) llegan antes del descanso. Cuida el ritmo tras el descanso.` });
    }
    const late = ms.flatMap((m) => m.conceded.filter((g) => g.min != null && g.min > m.total_mins * 0.85));
    if (ga >= 4 && late.length >= 3 && late.length / ga >= 0.3)
      add({ id: 'ga-late', level: 'warn', area: 'Defensa', title: 'Goles encajados en el tramo final', text: `${late.length} de ${ga} goles en contra (${fmtPct((late.length / ga) * 100)}) llegan en el último 15 % del partido.` });

    // --- Zonas ----------------------------------------------------------------------------------
    if (zonesFor.enough && zonesFor.ranking[0]) {
      const z = zonesFor.ranking[0];
      if (z.pct >= 30) add({ id: 'zone-for', level: 'info', area: 'Zonas', title: `Marcas mucho desde «${z.label}»`, text: `${z.goals} de ${zonesFor.withZone} goles (${fmtPct(z.pct)}) parten de esa zona. Es tu principal fuente de gol.` });
      const top2 = zonesFor.ranking.slice(0, 2).reduce((a, x) => a + x.pct, 0);
      if (zonesFor.ranking.length >= 3 && top2 >= 65 && z.pct < 30) add({ id: 'zone-for-2', level: 'info', area: 'Zonas', title: 'Goles concentrados en pocas zonas', text: `Dos zonas («${zonesFor.ranking[0].label}» y «${zonesFor.ranking[1].label}») acumulan el ${fmtPct(top2)} de tus goles.` });
      const far = ['Z5', 'Z6', 'Z7', 'Z10'].reduce((a, id) => a + (zonesFor.zones[id]?.goals ?? 0), 0);
      if (far >= 3 && far / zonesFor.withZone >= 0.4) add({ id: 'zone-far', level: 'info', area: 'Zonas', title: 'Mucho gol desde fuera del área', text: `${far} de ${zonesFor.withZone} goles (${fmtPct((far / zonesFor.withZone) * 100)}) se marcan desde el frontal, el exterior o lejos.` });
    }
    if (zonesAgainst.enough && zonesAgainst.ranking[0]) {
      const z = zonesAgainst.ranking[0];
      if (z.pct >= 30) add({ id: 'zone-against', level: 'warn', area: 'Zonas', title: `Recibes muchos goles desde «${z.label}»`, text: `${z.goals} de ${zonesAgainst.withZone} goles en contra (${fmtPct(z.pct)}) parten de esa zona. Conviene trabajar cómo se defiende.` });
      if (z.goals >= 3 && z.recent > z.earlier + 1) add({ id: 'zone-against-trend', level: 'warn', area: 'Zonas', title: `Más goles recibidos desde «${z.label}» últimamente`, text: `${z.recent} en la segunda mitad de la temporada frente a ${z.earlier} en la primera.` });
    }

    // --- Tipos de gol ---------------------------------------------------------------------------
    const setPieces = allGoals.filter((g) => ['Penalti', 'Falta', 'Córner'].includes(g.gtype)).length;
    if (allGoals.length >= 5 && setPieces / allGoals.length >= 0.35)
      add({ id: 'set-for', level: 'info', area: 'Goles', title: 'Dependencia del balón parado', text: `${setPieces} de ${allGoals.length} goles (${fmtPct((setPieces / allGoals.length) * 100)}) llegan de penalti, falta o córner.` });
    const setAgainst = allConceded.filter((g) => ['Penalti', 'Falta', 'Córner', 'Centro'].includes(g.gtype)).length;
    if (allConceded.length >= 4 && setAgainst / allConceded.length >= 0.4)
      add({ id: 'set-against', level: 'warn', area: 'Defensa', title: 'Vulnerable en balón parado y centros', text: `${setAgainst} de ${allConceded.length} goles en contra (${fmtPct((setAgainst / allConceded.length) * 100)}) son de penalti, falta, córner o centro.` });

    // --- Plantilla: minutos y carga --------------------------------------------------------------
    const high = loads.filter((l) => l.level === 'alta');
    if (high.length)
      add({ id: 'load-high', level: 'warn', area: 'Plantilla', title: 'Carga de minutos muy alta', text: `${high.slice(0, 4).map((l) => `${l.name} (${l.pct} %)`).join(', ')} juega${high.length > 1 ? 'n' : ''} más del 80 % de los minutos posibles. Valora rotaciones.` });
    const low = loads.filter((l) => l.level === 'baja');
    if (low.length)
      add({ id: 'load-low', level: 'info', area: 'Plantilla', title: 'Jugadores con poca participación', text: `${low.slice(0, 4).map((l) => `${l.name} (${l.pct} %)`).join(', ')} ${low.length > 1 ? 'suman' : 'suma'} menos del 15 % de los minutos.` });
    if (total >= 5) {
      const risers = loads.filter((l) => l.matches >= 2 && l.recentAvg - l.earlierAvg >= 25);
      const fallers = loads.filter((l) => l.matches >= 2 && l.earlierAvg - l.recentAvg >= 25);
      if (risers.length) add({ id: 'part-up', level: 'info', area: 'Plantilla', title: 'Ganan protagonismo', text: `${risers.slice(0, 4).map((l) => `${l.name} (${l.earlierAvg}' → ${l.recentAvg}' por partido)`).join(', ')}.` });
      if (fallers.length) add({ id: 'part-down', level: 'info', area: 'Plantilla', title: 'Pierden minutos', text: `${fallers.slice(0, 4).map((l) => `${l.name} (${l.earlierAvg}' → ${l.recentAvg}' por partido)`).join(', ')}.` });
    }

    // --- Local / visitante, sistema, disciplina ---------------------------------------------------
    if (local.n >= 2 && visit.n >= 2) {
      const lp = Math.round((local.w / local.n) * 100);
      const vp = Math.round((visit.w / visit.n) * 100);
      if (lp > vp + 25) add({ id: 'home', level: 'info', area: 'Resultados', title: 'Mucho mejor como local', text: `${lp} % de victorias en casa frente a ${vp} % fuera.` });
      else if (vp > lp + 25) add({ id: 'away', level: 'info', area: 'Resultados', title: 'Mejor como visitante', text: `${vp} % de victorias fuera frente a ${lp} % en casa.` });
    }
    const bestTactic = tactics.find((t) => t.played >= 2);
    if (tactics.length >= 2 && bestTactic)
      add({ id: 'tactic', level: 'info', area: 'Sistema', title: `Mejor sistema: ${bestTactic.tactic}`, text: `${round1(bestTactic.pts / bestTactic.played)} puntos por partido en ${bestTactic.played} partidos con esa formación.` });
    const yellows = ms.reduce((a, m) => a + m.cards.filter((c) => c.type === 'Y').length, 0);
    const reds = ms.reduce((a, m) => a + m.cards.filter((c) => c.type === 'R').length, 0);
    if (yellows / total >= 2.5 || reds >= 2) add({ id: 'cards', level: 'warn', area: 'Disciplina', title: 'Disciplina a vigilar', text: `${yellows} amarillas y ${reds} rojas en ${total} partidos (${round1(yellows / total)} amarillas por partido).` });
    if (summary.cleanSheets >= 3) add({ id: 'cs', level: 'good', area: 'Defensa', title: 'Defensa sólida', text: `${summary.cleanSheets} porterías a cero en ${total} partidos (${fmtPct((summary.cleanSheets / total) * 100)}).` });
    if (summary.ga > summary.gf + total * 0.5) add({ id: 'gd-neg', level: 'warn', area: 'Goles', title: 'Se encaja más de lo que se marca', text: `${summary.gf} goles a favor y ${summary.ga} en contra en ${total} partidos.` });
    if (ppg >= 2.2) add({ id: 'ppg', level: 'good', area: 'Resultados', title: 'Gran rendimiento en puntos', text: `${round1(ppg)} puntos por partido.` });

    // --- Patrones en observaciones -----------------------------------------------------------------
    if (observed >= MIN_OBSERVED) {
      for (const p of patterns.filter((x) => x.tone !== 'positivo').slice(0, 3))
        add({ id: `obs-${p.id}`, level: p.tone === 'negativo' ? 'warn' : 'info', area: 'Observaciones', title: `${p.label}: se repite en tus observaciones`, text: `Aparece en ${p.matches} de ${observed} partidos con observaciones. Es una tendencia según lo que has escrito, no una conclusión absoluta.` });
    }
  }

  // Orden: avisos primero, luego buenas noticias, luego información.
  const order: Record<Level, number> = { warn: 0, good: 1, info: 2 };
  f.sort((a, b) => order[a.level] - order[b.level]);

  return {
    total, summary,
    winPct: total ? Math.round((summary.w / total) * 100) : 0,
    csPct: total ? Math.round((summary.cleanSheets / total) * 100) : 0,
    ppg: total ? summary.pts / total : 0,
    series, halves, local, visit, goalTypes, bodyParts, tactics, loads, zonesFor, zonesAgainst, patterns, observed, findings: f,
  };
}

export { zoneLabel, compareDateDesc };
