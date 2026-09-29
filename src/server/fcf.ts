// Lectura de datos públicos de la FCF (www.fcf.cat) para /api/fcf.
//
// El portal de competiciones carga sus datos desde endpoints internos (/api/competition/...), que el
// robots.txt de la FCF excluye de rastreadores. Por decisión del propietario del proyecto se usan igualmente,
// de forma respetuosa: solo operaciones concretas (nada de proxy abierto), ids validados, un único
// identificador de cliente, caché en la CDN (catálogos 1 día, grupo 20 min, actas cerradas 30 días) y
// peticiones secuenciales. Si la FCF ofrece una API oficial, basta con cambiar este archivo.
//
// Se usa desde la función de Vercel (api/fcf.ts) y desde el servidor de Vite en desarrollo.

import type { FcfActa, FcfGoal, FcfGroupData, FcfMatch, FcfOption, FcfScorer, FcfStanding, FcfTeam } from '../lib/fcf/types';

const BASE = 'https://www.fcf.cat';
const UA = 'MiEquipoFC/1.0 (+https://futbol-david.vercel.app)';
const ID = /^\d{1,12}$/;

type Json = Record<string, unknown>;

async function get(path: string, as: 'json' | 'text' = 'json'): Promise<unknown> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12_000);
  try {
    const r = await fetch(BASE + path, { headers: { 'user-agent': UA, accept: as === 'json' ? 'application/json' : 'text/html' }, signal: ctrl.signal });
    if (!r.ok) throw new HttpError(502, `La FCF respondió ${r.status}`);
    return as === 'json' ? await r.json() : await r.text();
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(504, 'No se pudo contactar con la FCF');
  } finally {
    clearTimeout(t);
  }
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const str = (x: unknown) => (typeof x === 'string' ? x.trim() : typeof x === 'number' ? String(x) : '');
const num = (x: unknown): number | null => {
  if (x === null || x === undefined || x === '') return null;
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
};
const clean = (s: string) => s.replace(/\s+/g, ' ').trim();

export const options = (raw: unknown): FcfOption[] => {
  const seen = new Set<string>();
  const out: FcfOption[] = [];
  for (const o of Array.isArray(raw) ? raw : []) {
    const id = str((o as Json).value);
    if (ID.test(id) && !seen.has(id)) {
      seen.add(id);
      out.push({ id, label: clean(str((o as Json).label)) });
    }
  }
  return out;
};

const logo = (x: unknown) => {
  const s = str(x);
  if (!s) return null;
  return s.startsWith('http') ? s : `${BASE}/img/escuts/${s}`;
};

export function parseMatches(raw: unknown): FcfMatch[] {
  const out: FcfMatch[] = [];
  const rounds = raw && typeof raw === 'object' ? Object.values(raw as Json) : [];
  for (const list of rounds) {
    for (const m of Array.isArray(list) ? (list as Json[]) : []) {
      const acta = str(m.CODACTA);
      if (!ID.test(acta)) continue;
      const start = str(m.COMIENZO1);
      const hg = num(m.GOLES_CASA);
      const ag = num(m.GOLES_FUERA);
      const homeId = str(m.CODEQUIPO_CASA);
      const awayId = str(m.CODEQUIPO_FUERA);
      out.push({
        acta, round: num(m.JORNADA) ?? 0,
        date: /^\d{4}-\d{2}-\d{2}/.test(start) ? start.slice(0, 10) : null,
        time: /\d{2}:\d{2}/.test(start.slice(11)) && start.slice(11, 16) !== '00:00' ? start.slice(11, 16) : null,
        homeId, homeName: clean(str(m.NOMBRE_CASA)), awayId, awayName: clean(str(m.NOMBRE_FUERA)),
        hg, ag, closed: str(m.CERRADA) === '1' && hg !== null && ag !== null,
        field: clean(str(m.CAMPO)),
        bye: homeId === '-1' || awayId === '-1',
      });
    }
  }
  return out.sort((a, b) => a.round - b.round || (a.date ?? '').localeCompare(b.date ?? ''));
}

export function parseStandings(raw: unknown): FcfStanding[] {
  const rows = Array.isArray((raw as Json)?.data) ? ((raw as Json).data as Json[]) : [];
  return rows.map((r) => {
    const t = (r.team ?? {}) as Json;
    return {
      pos: num(r.position) ?? 0, teamId: str(t.teamId), name: clean(str(t.name)),
      pts: num(r.points) ?? 0, pj: num(r.played) ?? 0, w: num(r.won) ?? 0, d: num(r.drawn) ?? 0, l: num(r.lost) ?? 0,
      gf: num(r.goalsFor) ?? 0, ga: num(r.goalsAgainst) ?? 0, sanction: num(r.sanction) ?? 0,
    };
  }).filter((r) => r.teamId);
}

export function parseScorers(raw: unknown): FcfScorer[] {
  return (Array.isArray(raw) ? (raw as Json[]) : []).map((s) => ({
    playerId: str(s.codjugador), name: clean(str(s.nombre_jugador)) || 'Anónimo', teamId: str(s.codequipo), teamName: clean(str(s.nombre_equipo)),
    goals: num(s.goles) ?? 0, penalties: num(s.penalti) ?? 0, matches: num(s.total) ?? 0,
  }));
}

export function parseTeams(raw: unknown, standings: FcfStanding[], matches: FcfMatch[]): FcfTeam[] {
  const map = new Map<string, FcfTeam>();
  for (const o of options(raw)) map.set(o.id, { id: o.id, name: o.label, logo: null });
  for (const s of standings) if (!map.has(s.teamId)) map.set(s.teamId, { id: s.teamId, name: s.name, logo: null });
  for (const m of matches) {
    if (!m.bye && !map.has(m.homeId)) map.set(m.homeId, { id: m.homeId, name: m.homeName, logo: null });
    if (!m.bye && !map.has(m.awayId)) map.set(m.awayId, { id: m.awayId, name: m.awayName, logo: null });
  }
  return [...map.values()].filter((t) => t.id !== '-1').sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

/**
 * Goles de un acta a partir de la página pública del acta (/es/competicio/acta/ID).
 * La página lleva los datos en el payload de React Server Components; cada gol aparece como
 * «marcador parcial» + jugador + «(TIPO (MIN'))». El equipo se deduce de cómo cambia el marcador.
 */
export function parseActa(id: string, html: string): FcfActa {
  const chunks = [...html.matchAll(/self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g)].map((m) => {
    try {
      return JSON.parse(`"${m[1]}"`) as string;
    } catch {
      return '';
    }
  });
  const s = chunks.join('');
  const goals: FcfGoal[] = [];
  const re = /"children":"(\d+) - (\d+)"/g;
  let prev: [number, number] = [0, 0];
  const marks = [...s.matchAll(re)];
  for (let i = 0; i < marks.length; i++) {
    const m = marks[i];
    const end = marks[i + 1]?.index ?? s.length;
    const seg = s.slice(m.index!, Math.min(end, m.index! + 4000));
    const player = /"player":\{"id":"\d*","nombre":"([^"]*)"/.exec(seg);
    const kind = /\["\(","([^"]+)"," ","\((\d+)'\)"/.exec(seg) ?? /\["\(","([^"]+)"/.exec(seg);
    if (!player || !kind) continue; // marcador de cabecera u otro texto
    const h = Number(m[1]);
    const a = Number(m[2]);
    let side: 'home' | 'away' | null = null;
    if (h === prev[0] + 1 && a === prev[1]) side = 'home';
    else if (a === prev[1] + 1 && h === prev[0]) side = 'away';
    prev = [h, a];
    if (!side) continue;
    const type = kind[1].toUpperCase();
    goals.push({
      min: kind[2] ? Number(kind[2]) : null,
      kind: type.includes('PROPIA') || type.includes('PRÒPIA') ? 'own' : type.includes('PENAL') ? 'penalty' : 'goal',
      side, player: clean(player[1]),
    });
  }
  return { id, goals };
}

// ---------------------------------------------------------------------------
export interface FcfResult {
  body: unknown;
  /** Segundos de caché en la CDN. */
  maxAge: number;
}

const DAY = 86_400;

export async function handleFcf(q: URLSearchParams): Promise<FcfResult> {
  const op = q.get('op') ?? '';
  const id = (k: string) => {
    const v = q.get(k) ?? '';
    if (!ID.test(v)) throw new HttpError(400, `Parámetro ${k} no válido`);
    return v;
  };
  switch (op) {
    case 'seasons':
      return { body: options(await get('/api/competition/temporadas')), maxAge: DAY };
    case 'disciplines':
      return { body: options(await get('/api/competition/disciplines')), maxAge: DAY };
    case 'competitions':
      return { body: options(await get(`/api/competition/competicions?disciplinaId=${id('discipline')}&temporada=${id('season')}`)), maxAge: DAY };
    case 'groups':
      return { body: options(await get(`/api/competition/grupos?competicioId=${id('competition')}`)), maxAge: DAY };
    case 'group': {
      const g = id('group');
      const season = id('season');
      // Secuencial a propósito: no generar ráfagas contra la FCF.
      const rawMatches = await get(`/api/competition/partidos?grupId=${g}`);
      const rawStand = await get(`/api/competition/classificacio?grupId=${g}`);
      const rawScorers = await get(`/api/competition/goleadores?grupId=${g}&temporada=${season}`);
      const rawTeams = await get(`/api/competition/equipos?grupId=${g}`);
      const matches = parseMatches(rawMatches);
      const standings = parseStandings(rawStand);
      const body: FcfGroupData = {
        groupId: g, season, fetchedAt: new Date().toISOString(),
        teams: parseTeams(rawTeams, standings, matches), matches, standings, scorers: parseScorers(rawScorers),
      };
      for (const r of Array.isArray((rawStand as Json)?.data) ? ((rawStand as Json).data as Json[]) : []) {
        const t = (r.team ?? {}) as Json;
        const team = body.teams.find((x) => x.id === str(t.teamId));
        if (team) team.logo = logo(t.logo);
      }
      return { body, maxAge: 20 * 60 };
    }
    case 'acta': {
      const a = id('id');
      const acta = parseActa(a, (await get(`/es/competicio/acta/${a}`, 'text')) as string);
      // Solo se piden actas de partidos ya cerrados: no cambian.
      return { body: acta, maxAge: 30 * DAY };
    }
    default:
      throw new HttpError(400, 'Operación no válida');
  }
}

/** Respuesta HTTP común para Vercel y para el servidor de desarrollo. */
export async function fcfResponse(url: URL): Promise<Response> {
  try {
    const r = await handleFcf(url.searchParams);
    return new Response(JSON.stringify(r.body), {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': `public, max-age=300, s-maxage=${r.maxAge}, stale-while-revalidate=${r.maxAge}`,
        'access-control-allow-origin': '*',
      },
    });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Error' }), {
      status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'access-control-allow-origin': '*' },
    });
  }
}
