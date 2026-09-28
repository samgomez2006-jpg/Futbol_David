import { SKILLS, slotLabel } from './constants';
import { compareDateDesc } from './dates';
import type { Dataset, Evaluation, Match, Objective, Player, Result } from './types';

export const resultOf = (m: Pick<Match, 'gf' | 'ga'>): Result => (m.gf > m.ga ? 'V' : m.gf === m.ga ? 'E' : 'D');
export const pointsOf = (r: Result) => (r === 'V' ? 3 : r === 'E' ? 1 : 0);

export const activeMatches = (d: Pick<Dataset, 'matches'>) => d.matches.filter((m) => !m.deleted_at);
export const trashedMatches = (d: Pick<Dataset, 'matches'>) => d.matches.filter((m) => m.deleted_at);
export const activePlayers = (d: Pick<Dataset, 'players'>) => d.players.filter((p) => !p.archived_at);

export function sortPlayers(players: Player[]) {
  return [...players].sort((a, b) => (a.number ?? 999) - (b.number ?? 999) || a.name.localeCompare(b.name, 'es'));
}

export interface PlayerStats {
  goals: number;
  assists: number;
  matches: number;
  starts: number;
  subApps: number;
  mins: number;
  yellows: number;
  reds: number;
  cleanSheets: number;
  motm: number;
  trains: number;
  totalTrains: number;
  attPct: number;
}

export function playerStats(d: Dataset, pid: string): PlayerStats {
  const s: PlayerStats = {
    goals: 0, assists: 0, matches: 0, starts: 0, subApps: 0, mins: 0,
    yellows: 0, reds: 0, cleanSheets: 0, motm: 0, trains: 0, totalTrains: d.trainings.length, attPct: 0,
  };
  for (const m of activeMatches(d)) {
    for (const g of m.goals) {
      if (g.pid === pid) s.goals++;
      if (g.apid === pid) s.assists++;
    }
    for (const c of m.cards) {
      if (c.pid !== pid) continue;
      if (c.type === 'Y') s.yellows++;
      else s.reds++;
    }
    const e = m.lineup.find((x) => x.pid === pid);
    if (e && e.mins > 0) {
      s.matches++;
      s.mins += e.mins;
      if (e.role === 'TIT') s.starts++;
      else s.subApps++;
      if (m.ga === 0) s.cleanSheets++;
    }
    if (m.motm === pid) s.motm++;
  }
  s.trains = d.trainings.filter((t) => t.present.includes(pid)).length;
  s.attPct = s.totalTrains ? Math.round((s.trains / s.totalTrains) * 100) : 0;
  return s;
}

export interface TeamSummary {
  played: number;
  w: number;
  dr: number;
  l: number;
  pts: number;
  gf: number;
  ga: number;
  cleanSheets: number;
  streak: { type: Result; count: number } | null;
}

export function teamSummary(matches: Match[]): TeamSummary {
  const sorted = [...matches].sort(compareDateDesc);
  const res = sorted.map(resultOf);
  const w = res.filter((r) => r === 'V').length;
  const dr = res.filter((r) => r === 'E').length;
  const l = res.filter((r) => r === 'D').length;
  let streak: TeamSummary['streak'] = null;
  if (res.length) {
    let count = 0;
    for (const r of res) {
      if (r === res[0]) count++;
      else break;
    }
    streak = { type: res[0], count };
  }
  return {
    played: matches.length, w, dr, l, pts: w * 3 + dr,
    gf: matches.reduce((a, m) => a + m.gf, 0),
    ga: matches.reduce((a, m) => a + m.ga, 0),
    cleanSheets: matches.filter((m) => m.ga === 0).length,
    streak,
  };
}

export function evalAverage(e: Pick<Evaluation, 'skills'>): number {
  const vals = SKILLS.map((k) => e.skills[k]).filter((v): v is number => typeof v === 'number');
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
}

export function latestEvaluations(d: Dataset, pid: string): Evaluation[] {
  return d.evaluations.filter((e) => e.player_id === pid).sort(compareDateDesc);
}

export function objectiveProgress(d: Dataset, o: Objective): { current: number; pct: number; done: boolean } {
  let current = o.current;
  const ms = activeMatches(d);
  if (o.category !== 'custom') {
    if (o.scope === 'team') {
      if (o.category === 'wins') current = ms.filter((m) => resultOf(m) === 'V').length;
      else if (o.category === 'goals') current = ms.reduce((a, m) => a + m.gf, 0);
      else if (o.category === 'cleansheets') current = ms.filter((m) => m.ga === 0).length;
      else if (o.category === 'attendance') current = d.trainings.length;
      else if (o.category === 'matches') current = ms.length;
    } else if (o.player_id) {
      const s = playerStats(d, o.player_id);
      const map: Partial<Record<Objective['category'], number>> = {
        goals: s.goals, assists: s.assists, matches: s.matches, attendance: s.trains, cleansheets: s.cleanSheets,
      };
      current = map[o.category] ?? 0;
    }
  }
  const target = Math.max(o.target, 1);
  const pct = Math.min(Math.round((current / target) * 100), 100);
  return { current, pct, done: current >= target };
}

// ---------------------------------------------------------------------------
// Análisis
// ---------------------------------------------------------------------------

const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

/**
 * Reparte los goles en 6 franjas proporcionales a la duración de cada partido.
 * (El original usaba franjas fijas de 10' con "51+", inútil para partidos de 70 o 90 minutos.)
 */
export function timeSlots(matches: Match[]) {
  const scored = [0, 0, 0, 0, 0, 0];
  const conceded = [0, 0, 0, 0, 0, 0];
  const slotOf = (min: number, total: number) => Math.min(Math.max(Math.floor(((min - 1) / Math.max(total, 1)) * 6), 0), 5);
  for (const m of matches) {
    m.goals.forEach((g) => g.min != null && scored[slotOf(g.min, m.total_mins)]++);
    m.conceded.forEach((g) => g.min != null && conceded[slotOf(g.min, m.total_mins)]++);
  }
  const typical = median(matches.map((m) => m.total_mins)) || 60;
  const step = typical / 6;
  const labels = scored.map((_, i) => `${Math.round(i * step) + 1}-${Math.round((i + 1) * step)}'`);
  return { scored, conceded, labels, typical };
}

const countBy = <T,>(xs: T[], key: (x: T) => string | null | undefined) => {
  const out: Record<string, number> = {};
  for (const x of xs) {
    const k = key(x);
    if (k) out[k] = (out[k] ?? 0) + 1;
  }
  return out;
};
const topEntries = (o: Record<string, number>) => Object.entries(o).sort((a, b) => b[1] - a[1]);

export interface Analysis {
  total: number;
  summary: TeamSummary;
  winPct: number;
  csPct: number;
  local: { n: number; w: number; e: number; d: number };
  visit: { n: number; w: number; e: number; d: number };
  slots: ReturnType<typeof timeSlots>;
  goalTypes: [string, number][];
  bodyParts: [string, number][];
  fzScored: Record<string, number>;
  fzConceded: Record<string, number>;
  concededTypes: [string, number][];
  tactics: { tactic: string; played: number; w: number; pts: number; gf: number; ga: number }[];
  insights: string[];
}

export function analyse(d: Dataset): Analysis {
  const ms = activeMatches(d);
  const summary = teamSummary(ms);
  const total = ms.length;
  const rec = (xs: Match[]) => ({
    n: xs.length,
    w: xs.filter((m) => resultOf(m) === 'V').length,
    e: xs.filter((m) => resultOf(m) === 'E').length,
    d: xs.filter((m) => resultOf(m) === 'D').length,
  });
  const local = rec(ms.filter((m) => m.venue === 'L'));
  const visit = rec(ms.filter((m) => m.venue === 'V'));
  const slots = timeSlots(ms);
  const allGoals = ms.flatMap((m) => m.goals);
  const allConceded = ms.flatMap((m) => m.conceded);
  const goalTypes = topEntries(countBy(allGoals, (g) => g.gtype));
  const bodyParts = topEntries(countBy(allGoals, (g) => g.body));
  const fzScored = countBy(allGoals, (g) => g.field_zone);
  const fzConceded = countBy(allConceded, (g) => g.field_zone);
  const concededTypes = topEntries(countBy(allConceded, (g) => g.gtype));

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

  const insights: string[] = [];
  if (total >= 3) {
    const { scored, conceded, labels } = slots;
    const maxS = Math.max(...scored);
    if (maxS > 0) insights.push(`⚽ El equipo marca más en la franja **${labels[scored.indexOf(maxS)]}** (${maxS} goles).`);
    const maxC = Math.max(...conceded);
    if (maxC > 0) insights.push(`⚠️ El equipo encaja más en la franja **${labels[conceded.indexOf(maxC)]}**. Revisar la concentración en ese tramo.`);
    if (conceded[5] > 0 && conceded[5] >= Math.max(...conceded.slice(0, 5)))
      insights.push('🚨 Los goles recibidos aumentan en el **tramo final** del partido. Trabajar condición física y concentración.');
    if (local.n && visit.n) {
      const lp = Math.round((local.w / local.n) * 100);
      const vp = Math.round((visit.w / visit.n) * 100);
      if (lp > vp + 20) insights.push(`🏠 Rinde mucho mejor como **local** (${lp}% de victorias frente a ${vp}% fuera).`);
      else if (vp > lp + 20) insights.push(`✈️ Rinde mejor como **visitante** (${vp}% frente a ${lp}% en casa).`);
    }
    if (goalTypes.length) insights.push(`🎯 La acción más frecuente en los goles a favor es **${goalTypes[0][0]}** (${goalTypes[0][1]}).`);
    if (concededTypes.length && concededTypes[0][1] >= 2)
      insights.push(`🧱 El origen más repetido de los goles en contra es **${concededTypes[0][0]}** (${concededTypes[0][1]}).`);
    const bestTactic = tactics.find((t) => t.played >= 2);
    if (tactics.length >= 2 && bestTactic)
      insights.push(`📋 La formación **${bestTactic.tactic}** es la más efectiva: ${(bestTactic.pts / bestTactic.played).toFixed(1)} puntos por partido en ${bestTactic.played} partidos.`);
    const fzc = topEntries(fzConceded);
    if (fzc.length) {
      const tot = fzc.reduce((a, [, n]) => a + n, 0);
      const pct = Math.round((fzc[0][1] / tot) * 100);
      if (pct >= 40) insights.push(`🛡️ El ${pct}% de los goles encajados llegan desde **${fzc[0][0].toLowerCase()}**. Foco defensivo en esa zona.`);
    }
    const fzs = Object.values(fzScored).reduce((a, b) => a + b, 0);
    if (fzs >= 3 && ((fzScored['Área pequeña'] ?? 0) + (fzScored['Dentro del área'] ?? 0)) / fzs >= 0.6)
      insights.push('🥅 La mayoría de goles se marcan **dentro del área**: el equipo aprovecha bien las ocasiones claras.');
    const chrono = [...ms].sort((a, b) => (a.date < b.date ? -1 : 1));
    if (chrono.length >= 4) {
      const half = Math.floor(chrono.length / 2);
      const avg = (xs: Match[]) => xs.reduce((a, m) => a + m.gf, 0) / xs.length;
      const a = avg(chrono.slice(0, half));
      const b = avg(chrono.slice(half));
      if (b > a + 0.5) insights.push(`📈 El rendimiento ofensivo **mejora** en la segunda mitad de la temporada (+${(b - a).toFixed(1)} goles/partido).`);
      else if (a > b + 0.5) insights.push('📉 El rendimiento ofensivo **baja** en la segunda mitad de la temporada.');
    }
    if (summary.cleanSheets >= 3) insights.push(`🔐 ${summary.cleanSheets} porterías a cero (${Math.round((summary.cleanSheets / total) * 100)}%). La defensa es sólida.`);
    if (summary.ga > summary.gf + total * 0.5) insights.push('🚨 El equipo encaja bastante más de lo que marca. Conviene reforzar el trabajo defensivo.');

    const perf: Record<string, { name: string; pos: string; played: number; pts: number }> = {};
    const names = new Map(d.players.map((p) => [p.id, p.name]));
    for (const m of ms) {
      for (const e of m.lineup) {
        if (e.role !== 'TIT' || !e.slot || !names.has(e.pid)) continue;
        const pos = slotLabel(e.slot);
        const k = `${e.pid}|${pos}`;
        const x = (perf[k] ??= { name: names.get(e.pid)!, pos, played: 0, pts: 0 });
        x.played++;
        x.pts += pointsOf(resultOf(m));
      }
    }
    const best = Object.values(perf).filter((x) => x.played >= 3).sort((a, b) => b.pts / b.played - a.pts / a.played)[0];
    if (best && best.pts / best.played >= 2)
      insights.push(`⭐ Con **${best.name}** de **${best.pos}** el equipo suma ${(best.pts / best.played).toFixed(1)} puntos por partido (${best.played} partidos).`);
  }

  return {
    total, summary,
    winPct: total ? Math.round((summary.w / total) * 100) : 0,
    csPct: total ? Math.round((summary.cleanSheets / total) * 100) : 0,
    local, visit, slots, goalTypes, bodyParts, fzScored, fzConceded, concededTypes, tactics, insights,
  };
}


/** Validación del formulario de partido. Devuelve el primer error o null. */
export function validateMatch(m: Pick<Match, 'rival' | 'gf' | 'ga' | 'total_mins' | 'goals' | 'conceded' | 'lineup' | 'cards'>): string | null {
  if (!m.rival.trim()) return 'Escribe el nombre del rival';
  if (m.goals.length > m.gf) return `Hay ${m.goals.length} goles detallados pero el marcador dice ${m.gf}`;
  if (m.conceded.length > m.ga) return `Hay ${m.conceded.length} goles encajados detallados pero el marcador dice ${m.ga}`;
  const badMin = [...m.goals, ...m.conceded, ...m.cards].find((e) => e.min != null && (e.min < 1 || e.min > m.total_mins + 15));
  if (badMin) return `Minuto ${badMin.min} fuera del partido (${m.total_mins}')`;
  const badLineup = m.lineup.find((e) => e.mins < 0 || e.mins > m.total_mins + 15);
  if (badLineup) return 'Revisa los minutos jugados de la alineación';
  if (m.goals.some((g) => g.pid && g.pid === g.apid)) return 'El goleador no puede ser su propio asistente';
  return null;
}
