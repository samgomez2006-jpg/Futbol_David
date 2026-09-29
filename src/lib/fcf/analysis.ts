// Análisis de competición y rivales a partir de los datos públicos de la FCF.
// Regla: nada se estima. Si un dato no existe (p. ej. el minuto de un gol) se cuenta como «sin dato»
// y las conclusiones solo aparecen con una muestra mínima.

import type { FcfActa, FcfGroupData, FcfMatch, FcfScorer, FcfTeam } from './types';

export type Res = 'V' | 'E' | 'D';
export interface Split {
  pj: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  pts: number;
}
export interface Played {
  acta: string;
  round: number;
  date: string | null;
  home: boolean;
  oppId: string;
  opp: string;
  gf: number;
  ga: number;
  res: Res;
}
export interface TeamRecord extends Split {
  teamId: string;
  name: string;
  home: Split;
  away: Split;
  avgGf: number;
  avgGa: number;
  /** Cronológico. */
  played: Played[];
  /** Pendientes (sin resultado), cronológico. */
  upcoming: FcfMatch[];
}

const zero = (): Split => ({ pj: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 });
const add = (s: Split, gf: number, ga: number) => {
  s.pj++;
  s.gf += gf;
  s.ga += ga;
  if (gf > ga) {
    s.w++;
    s.pts += 3;
  } else if (gf === ga) {
    s.d++;
    s.pts++;
  } else s.l++;
};

export const MIN_MATCHES = 3;
export const MIN_TIMED_GOALS = 5;

const byTime = (a: FcfMatch, b: FcfMatch) => a.round - b.round || (a.date ?? '').localeCompare(b.date ?? '');

export function teamRecord(g: FcfGroupData, teamId: string): TeamRecord {
  const name = g.teams.find((t) => t.id === teamId)?.name ?? g.standings.find((s) => s.teamId === teamId)?.name ?? '';
  const r: TeamRecord = { ...zero(), teamId, name, home: zero(), away: zero(), avgGf: 0, avgGa: 0, played: [], upcoming: [] };
  for (const m of [...g.matches].sort(byTime)) {
    if (m.bye || (m.homeId !== teamId && m.awayId !== teamId)) continue;
    const home = m.homeId === teamId;
    if (!m.closed || m.hg === null || m.ag === null) {
      r.upcoming.push(m);
      continue;
    }
    const gf = home ? m.hg : m.ag;
    const ga = home ? m.ag : m.hg;
    add(r, gf, ga);
    add(home ? r.home : r.away, gf, ga);
    r.played.push({ acta: m.acta, round: m.round, date: m.date, home, oppId: home ? m.awayId : m.homeId, opp: home ? m.awayName : m.homeName, gf, ga, res: gf > ga ? 'V' : gf === ga ? 'E' : 'D' });
  }
  r.avgGf = r.pj ? r.gf / r.pj : 0;
  r.avgGa = r.pj ? r.ga / r.pj : 0;
  return r;
}

export interface RoundPoint {
  round: number;
  pos: number;
  pts: number;
}

/**
 * Clasificación jornada a jornada calculada con los resultados publicados (3-1-0; desempate por diferencia
 * y goles a favor). Puede diferir de la oficial por sanciones o por desempates particulares.
 */
export function positionHistory(g: FcfGroupData): Map<string, RoundPoint[]> {
  const ids = [...new Set(g.matches.filter((m) => !m.bye).flatMap((m) => [m.homeId, m.awayId]))];
  const acc = new Map(ids.map((id) => [id, zero()]));
  const out = new Map<string, RoundPoint[]>(ids.map((id) => [id, []]));
  const rounds = [...new Set(g.matches.filter((m) => m.closed && !m.bye).map((m) => m.round))].sort((a, b) => a - b);
  for (const round of rounds) {
    for (const m of g.matches) {
      if (m.round !== round || !m.closed || m.bye || m.hg === null || m.ag === null) continue;
      add(acc.get(m.homeId)!, m.hg, m.ag);
      add(acc.get(m.awayId)!, m.ag, m.hg);
    }
    const table = ids.map((id) => ({ id, s: acc.get(id)! })).sort((a, b) => b.s.pts - a.s.pts || (b.s.gf - b.s.ga) - (a.s.gf - a.s.ga) || b.s.gf - a.s.gf);
    table.forEach((t, i) => out.get(t.id)!.push({ round, pos: i + 1, pts: t.s.pts }));
  }
  return out;
}

export function headToHead(g: FcfGroupData, a: string, b: string): Played[] {
  return teamRecord(g, a).played.filter((p) => p.oppId === b);
}

export interface ScorerShare extends FcfScorer {
  share: number; // % de los goles del equipo
}
export function teamScorers(g: FcfGroupData, teamId: string, teamGoals: number): { list: ScorerShare[]; maybeIncomplete: boolean } {
  const list = g.scorers.filter((s) => s.teamId === teamId).sort((x, y) => y.goals - x.goals)
    .map((s) => ({ ...s, share: teamGoals ? (s.goals / teamGoals) * 100 : 0 }));
  // La FCF publica una lista limitada de máximos goleadores del grupo (normalmente 50).
  return { list, maybeIncomplete: g.scorers.length >= 50 };
}

// --- Goles por minuto (actas) ---------------------------------------------------------------------
export interface Timing {
  /** Partidos cerrados del equipo y cuántos tienen el acta cargada. */
  closed: number;
  loaded: number;
  forH1: number;
  forH2: number;
  agH1: number;
  agH2: number;
  forNoMin: number;
  agNoMin: number;
  bands: { label: string; f: number; a: number }[];
  byMatch: { acta: string; round: number; date: string | null; opp: string; home: boolean; f: number[]; a: number[] }[];
}

export function goalTiming(g: FcfGroupData, teamId: string, actas: Record<string, FcfActa>, halfMins: number): Timing {
  const rec = teamRecord(g, teamId);
  const total = halfMins * 2;
  const nb = 4;
  const size = total / nb;
  const bands = Array.from({ length: nb }, (_, i) => ({ label: `${Math.round(i * size)}-${Math.round((i + 1) * size)}'`, f: 0, a: 0 }));
  const t: Timing = { closed: rec.played.length, loaded: 0, forH1: 0, forH2: 0, agH1: 0, agH2: 0, forNoMin: 0, agNoMin: 0, bands, byMatch: [] };
  for (const p of rec.played) {
    const acta = actas[p.acta];
    if (!acta) continue;
    t.loaded++;
    const mine = p.home ? 'home' : 'away';
    const row = { acta: p.acta, round: p.round, date: p.date, opp: p.opp, home: p.home, f: [] as number[], a: [] as number[] };
    for (const goal of acta.goals) {
      const isFor = goal.side === mine;
      if (goal.min === null) {
        if (isFor) t.forNoMin++;
        else t.agNoMin++;
        continue;
      }
      const first = goal.min <= halfMins;
      const band = Math.min(nb - 1, Math.max(0, Math.floor((goal.min - 0.001) / size)));
      if (isFor) {
        row.f.push(goal.min);
        if (first) t.forH1++;
        else t.forH2++;
        bands[band].f++;
      } else {
        row.a.push(goal.min);
        if (first) t.agH1++;
        else t.agH2++;
        bands[band].a++;
      }
    }
    t.byMatch.push(row);
  }
  return t;
}

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

/** Frases de análisis; solo se generan con muestra suficiente. */
export function insights(rec: TeamRecord, t: Timing | null, name = 'El rival'): string[] {
  const out: string[] = [];
  // Solo con todas las actas leídas: con una parte de la temporada el reparto engañaría.
  if (t && t.loaded === t.closed) {
    const f = t.forH1 + t.forH2;
    const a = t.agH1 + t.agH2;
    if (f >= MIN_TIMED_GOALS) {
      const second = pct(t.forH2, f);
      out.push(second === 50 ? `${name} reparte sus goles por igual entre las dos partes.` : second > 50 ? `${name} ha marcado el ${second} % de sus goles en la segunda parte.` : `${name} ha marcado el ${100 - second} % de sus goles en la primera parte.`);
      const top = [...t.bands].sort((x, y) => y.f - x.f)[0];
      if (pct(top.f, f) >= 35) out.push(`El tramo en el que más marca es el ${top.label} (${pct(top.f, f)} % de sus goles).`);
    }
    if (a >= MIN_TIMED_GOALS) {
      const second = pct(t.agH2, a);
      out.push(second === 50 ? 'Encaja lo mismo en cada parte.' : second > 50 ? `Encaja el ${second} % de sus goles en la segunda parte.` : `Encaja el ${100 - second} % de sus goles en la primera parte.`);
      const top = [...t.bands].sort((x, y) => y.a - x.a)[0];
      if (pct(top.a, a) >= 35) out.push(`Donde más encaja es en el tramo ${top.label} (${pct(top.a, a)} % de los goles recibidos).`);
    }
  }
  if (rec.home.pj >= MIN_MATCHES && rec.away.pj >= MIN_MATCHES) {
    const h = rec.home.pts / rec.home.pj;
    const a = rec.away.pts / rec.away.pj;
    if (Math.abs(h - a) >= 0.7) out.push(h > a ? `Es mucho más fuerte en casa (${h.toFixed(1).replace('.', ',')} puntos por partido) que fuera (${a.toFixed(1).replace('.', ',')}).` : `Rinde mejor fuera (${a.toFixed(1).replace('.', ',')} puntos por partido) que en casa (${h.toFixed(1).replace('.', ',')}).`);
  }
  if (rec.pj >= 6) {
    const last = rec.played.slice(-5);
    const recent = last.reduce((s, p) => s + (p.res === 'V' ? 3 : p.res === 'E' ? 1 : 0), 0) / last.length;
    const season = rec.pts / rec.pj;
    if (recent - season >= 0.6) out.push(`Llega en buena racha: ${recent.toFixed(1).replace('.', ',')} puntos por partido en los últimos ${last.length}, por encima de su media.`);
    else if (season - recent >= 0.6) out.push(`Llega a la baja: ${recent.toFixed(1).replace('.', ',')} puntos por partido en los últimos ${last.length}, por debajo de su media.`);
  }
  if (rec.pj >= MIN_MATCHES) {
    const cs = rec.played.filter((p) => p.ga === 0).length;
    if (pct(cs, rec.pj) >= 40) out.push(`Deja la portería a cero en el ${pct(cs, rec.pj)} % de sus partidos.`);
    const noScore = rec.played.filter((p) => p.gf === 0).length;
    if (pct(noScore, rec.pj) >= 40) out.push(`No marca en el ${pct(noScore, rec.pj)} % de sus partidos.`);
  }
  return out;
}

// --- Reconocer al rival por su nombre -------------------------------------------------------------
const STOP = new Set(['cf', 'fc', 'ce', 'cd', 'ue', 'ud', 'ae', 'ad', 'aec', 'club', 'futbol', 'football', 'associacio', 'asociacion', 'esportiva', 'deportiva', 'esportiu', 'deportivo', 'de', 'del', 'la', 'el', 'les', 'els', 'i', 'y', 'sd', 'cfb', 'efb', 'escola', 'uni', 'unio', 'union', 'at', 'atletic']);
export const normName = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[.,'’"()-]/g, ' ').replace(/\s+/g, ' ').trim();
const tokens = (s: string) => normName(s).split(' ').filter((w) => w.length > 1 && !STOP.has(w));
/** Letra del equipo al final («… A», «… B»). */
const letter = (s: string) => /\s([a-h])$/.exec(normName(s))?.[1] ?? null;

/** Busca el equipo FCF que corresponde a un nombre escrito a mano. null si no hay coincidencia clara. */
export function findTeam(name: string, teams: FcfTeam[]): FcfTeam | null {
  const q = tokens(name);
  if (!q.length) return null;
  const ql = letter(name);
  let best: { t: FcfTeam; score: number } | null = null;
  for (const t of teams) {
    const tt = tokens(t.name).filter((w) => w.length > 1);
    const common = q.filter((w) => tt.includes(w)).length;
    if (!common) continue;
    let score = common / Math.max(q.length, Math.min(tt.length, q.length + 1));
    const tl = letter(t.name);
    if (ql && tl && ql !== tl) score -= 0.5;
    if (ql && tl && ql === tl) score += 0.1;
    if (!best || score > best.score) best = { t, score };
  }
  return best && best.score >= 0.6 ? best.t : null;
}

/** Nombre corto para la app: «NAVATA, C.F. A» → «Navata A». */
export function shortTeamName(n: string): string {
  const l = letter(n);
  const base = n.split(',')[0].trim();
  const nice = base.toLowerCase().replace(/(^|[\s'’-])(\p{L})/gu, (_, p, c: string) => p + c.toUpperCase());
  return l && !normName(base).endsWith(` ${l}`) ? `${nice} ${l.toUpperCase()}` : nice;
}
