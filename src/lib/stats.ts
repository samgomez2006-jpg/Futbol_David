import { SKILLS } from './constants';
import { compareDateDesc, todayISO } from './dates';
import type { Callup, Dataset, Evaluation, Match, Objective, Player, Result } from './types';

export const resultOf = (m: Pick<Match, 'gf' | 'ga'>): Result => (m.gf > m.ga ? 'V' : m.gf === m.ga ? 'E' : 'D');
export const pointsOf = (r: Result) => (r === 'V' ? 3 : r === 'E' ? 1 : 0);

export const activeMatches = (d: Pick<Dataset, 'matches'>) => d.matches.filter((m) => !m.deleted_at);
export const trashedMatches = (d: Pick<Dataset, 'matches'>) => d.matches.filter((m) => m.deleted_at);
/** Partidos que cuentan en estadísticas y analíticas: jugados y fuera de la papelera. */
export const playedMatches = (d: Pick<Dataset, 'matches'>) => d.matches.filter((m) => !m.deleted_at && m.status === 'played');
export const upcomingMatches = (d: Pick<Dataset, 'matches'>) =>
  d.matches.filter((m) => !m.deleted_at && m.status === 'scheduled').sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
export const activePlayers = (d: Pick<Dataset, 'players'>) => d.players.filter((p) => !p.archived_at);

export function sortPlayers(players: Player[]) {
  return [...players].sort((a, b) => (a.number ?? 999) - (b.number ?? 999) || a.name.localeCompare(b.name, 'es'));
}

/** Próximo partido: el programado más cercano a hoy (o el más reciente si todos son pasados). */
export function nextMatch(d: Pick<Dataset, 'matches'>): Match | undefined {
  const up = upcomingMatches(d);
  const today = todayISO();
  return up.find((m) => m.date >= today) ?? up[up.length - 1];
}
export function lastPlayed(d: Pick<Dataset, 'matches'>): Match | undefined {
  return [...playedMatches(d)].sort(compareDateDesc)[0];
}

// --- relación convocatoria ↔ partido ---------------------------------------------------------
export const matchOfCallup = (d: Pick<Dataset, 'matches'>, callupId: string): Match | undefined =>
  d.matches.find((m) => m.callup_id === callupId && !m.deleted_at) ?? d.matches.find((m) => m.callup_id === callupId);
export const callupOfMatch = (d: Pick<Dataset, 'callups'>, m: Pick<Match, 'callup_id'>): Callup | undefined =>
  m.callup_id ? d.callups.find((c) => c.id === m.callup_id) : undefined;
/** Ids de los jugadores convocados a un partido (null si el partido no tiene convocatoria). */
export function squadOf(d: Pick<Dataset, 'callups'>, m: Pick<Match, 'callup_id'>): string[] | null {
  const c = callupOfMatch(d, m);
  return c ? c.players.filter((p) => p.status === 'confirmed').map((p) => p.pid) : null;
}

// --- estadísticas de jugador -----------------------------------------------------------------
export interface PlayerStats {
  goals: number;
  assists: number;
  matches: number; // partidos en los que ha jugado
  starts: number;
  subApps: number;
  mins: number;
  minsPct: number; // % de los minutos posibles del equipo
  avgMins: number;
  yellows: number;
  reds: number;
  cleanSheets: number;
  motm: number;
  trains: number;
  totalTrains: number;
  attPct: number;
  called: number; // veces convocado
  totalCallups: number;
}

export function playerStats(d: Dataset, pid: string): PlayerStats {
  const s: PlayerStats = {
    goals: 0, assists: 0, matches: 0, starts: 0, subApps: 0, mins: 0, minsPct: 0, avgMins: 0,
    yellows: 0, reds: 0, cleanSheets: 0, motm: 0, trains: 0, totalTrains: d.trainings.length, attPct: 0,
    called: 0, totalCallups: d.callups.length,
  };
  let possible = 0;
  for (const m of playedMatches(d)) {
    possible += m.total_mins;
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
  s.avgMins = s.matches ? Math.round(s.mins / s.matches) : 0;
  s.minsPct = possible ? Math.round((s.mins / possible) * 100) : 0;
  s.trains = d.trainings.filter((t) => t.present.includes(pid)).length;
  s.attPct = s.totalTrains ? Math.round((s.trains / s.totalTrains) * 100) : 0;
  s.called = d.callups.filter((c) => c.players.some((p) => p.pid === pid && p.status === 'confirmed')).length;
  return s;
}

// --- resumen de equipo -----------------------------------------------------------------------
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
  form: Result[]; // últimos resultados, del más reciente al más antiguo
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
    form: res.slice(0, 6),
  };
}

// --- evaluaciones y objetivos ----------------------------------------------------------------
export function evalAverage(e: Pick<Evaluation, 'skills'>): number {
  const vals = SKILLS.map((k) => e.skills[k]).filter((v): v is number => typeof v === 'number');
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
}

export function latestEvaluations(d: Dataset, pid: string): Evaluation[] {
  return d.evaluations.filter((e) => e.player_id === pid).sort(compareDateDesc);
}

export function objectiveProgress(d: Dataset, o: Objective): { current: number; pct: number; done: boolean } {
  let current = o.current;
  const ms = playedMatches(d);
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

// --- validación del formulario de partido ----------------------------------------------------
export function validateMatch(m: Match): string | null {
  if (!m.rival.trim()) return 'Escribe el nombre del rival';
  if (m.status === 'played') {
    if (m.goals.length > m.gf) return `Hay ${m.goals.length} goles detallados pero el marcador dice ${m.gf}`;
    if (m.conceded.length > m.ga) return `Hay ${m.conceded.length} goles encajados detallados pero el marcador dice ${m.ga}`;
  }
  const limit = m.total_mins + 15;
  const badMin = [...m.goals, ...m.conceded, ...m.cards, ...m.subs, ...m.incidents].find((e) => e.min != null && (e.min < 1 || e.min > limit));
  if (badMin) return `Minuto ${badMin.min} fuera del partido (${m.total_mins}')`;
  if (m.lineup.some((e) => e.mins < 0 || e.mins > limit)) return 'Revisa los minutos jugados de la alineación';
  if (m.goals.some((g) => g.pid && g.pid === g.apid)) return 'El goleador no puede ser su propio asistente';
  const starters = new Set(m.lineup.filter((e) => e.role === 'TIT').map((e) => e.pid));
  if (m.subs.some((s) => starters.has(s.in_pid))) return 'Un cambio incluye como suplente a un titular';
  return null;
}
