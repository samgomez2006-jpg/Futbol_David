// Datos públicos de la Federació Catalana de Futbol, ya normalizados por /api/fcf.
// Todos los ids son los de la FCF (texto numérico).

export interface FcfOption {
  id: string;
  label: string;
}

export interface FcfTeam {
  id: string;
  name: string;
  logo: string | null;
}

export interface FcfMatch {
  acta: string;
  round: number;
  /** AAAA-MM-DD o null si aún no tiene fecha. */
  date: string | null;
  /** HH:MM o null. */
  time: string | null;
  homeId: string;
  homeName: string;
  awayId: string;
  awayName: string;
  /** null = sin resultado. */
  hg: number | null;
  ag: number | null;
  /** Acta cerrada (resultado oficial). */
  closed: boolean;
  field: string;
  /** Jornada de descanso de un equipo. */
  bye: boolean;
}

export interface FcfStanding {
  pos: number;
  teamId: string;
  name: string;
  pts: number;
  pj: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  sanction: number;
}

export interface FcfScorer {
  playerId: string;
  name: string;
  teamId: string;
  teamName: string;
  goals: number;
  penalties: number;
  matches: number;
}

export interface FcfGroupData {
  groupId: string;
  season: string;
  fetchedAt: string;
  teams: FcfTeam[];
  matches: FcfMatch[];
  standings: FcfStanding[];
  scorers: FcfScorer[];
}

export type FcfGoalKind = 'goal' | 'penalty' | 'own';
export interface FcfGoal {
  min: number | null;
  kind: FcfGoalKind;
  /** Equipo al que sube el gol al marcador. */
  side: 'home' | 'away';
  player: string;
}
export interface FcfActa {
  id: string;
  goals: FcfGoal[];
}

/** Vinculación de un equipo de la app con su competición FCF (se guarda en teams.profile.fcf). */
export interface FcfLink {
  season: FcfOption;
  discipline: FcfOption;
  competition: FcfOption;
  group: FcfOption;
  team: FcfOption;
  /** Duración de cada parte en minutos (para repartir goles por partes). La elige el entrenador. */
  halfMins: number;
  /** acta FCF → id de partido de la app (evita duplicados al importar el calendario). */
  links: Record<string, string>;
  linkedAt: string;
}

export const FCF_WEB = 'https://www.fcf.cat/es/competicio';
export const actaUrl = (acta: string) => `https://www.fcf.cat/es/competicio/acta/${acta}`;
