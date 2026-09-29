// Modelo de datos. Los nombres de campo coinciden con las columnas de Supabase (snake_case)
// para que el sync no necesite mapeos.

export type ISODate = string; // 'YYYY-MM-DD'
export type Position = 'Portero' | 'Defensa' | 'Centrocampista' | 'Delantero';
export type Foot = 'D' | 'I' | 'A';
export type Venue = 'L' | 'V';
export type Result = 'V' | 'E' | 'D';
export type MatchStatus = 'scheduled' | 'played';

interface Row {
  id: string;
  team_id: string;
  updated_at?: string;
}

// ---------------------------------------------------------------------------
// Equipo
// ---------------------------------------------------------------------------
export interface StaffMember {
  id: string;
  name: string;
  role: string;
}

/** Información del equipo que el entrenador escribe y edita (columna teams.profile). */
export interface TeamProfile {
  info: string; // información general
  staff: StaffMember[]; // cuerpo técnico
  system: string; // sistema de juego habitual
  model: string; // modelo de juego
  principles: string; // principios de juego
  ideas: string; // ideas y conceptos tácticos
  other: string; // otros aspectos
}
export const emptyProfile = (): TeamProfile => ({ info: '', staff: [], system: '', model: '', principles: '', ideas: '', other: '' });

export interface Team {
  id: string;
  name: string;
  season: string;
  category: string;
  invite_code?: string;
  profile: TeamProfile;
}

// ---------------------------------------------------------------------------
// Jugadores
// ---------------------------------------------------------------------------
export interface Player extends Row {
  name: string;
  number: number | null;
  position: Position;
  birth: ISODate | null;
  foot: Foot;
  archived_at: string | null;
}

// ---------------------------------------------------------------------------
// Partidos
// ---------------------------------------------------------------------------
export interface GoalEvent {
  id: string;
  min: number | null;
  gtype: string; // ver GOAL_TYPES
  /** Id de zona de finalización (ver lib/zones.ts). Misma división para goles a favor y en contra. */
  field_zone: string;
  /** Zona de la portería (3x3), opcional. */
  goal_zone: string;
}
export interface ScoredGoal extends GoalEvent {
  pid: string | null; // null = gol en propia puerta del rival / sin asignar
  apid: string | null;
  body: string;
}
export type ConcededGoal = GoalEvent;

export interface CardEvent {
  id: string;
  pid: string;
  type: 'Y' | 'R';
  min: number | null;
}

export interface LineupEntry {
  pid: string;
  role: 'TIT' | 'SUP';
  slot: string | null; // hueco de la formación (clave `POS#i`)
  mins: number;
  /** true si el entrenador ha fijado los minutos a mano (no se recalculan con los cambios). */
  mins_manual?: boolean;
}

export interface Substitution {
  id: string;
  min: number | null;
  out_pid: string;
  in_pid: string;
}

export interface Incident {
  id: string;
  min: number | null;
  text: string;
}

export interface RivalInfo {
  general: string; // observaciones generales
  traits: string; // características
  strengths: string;
  weaknesses: string;
  system: string; // sistema utilizado
  key_players: string;
  other: string;
}
export const emptyRival = (): RivalInfo => ({ general: '', traits: '', strengths: '', weaknesses: '', system: '', key_players: '', other: '' });

export interface AttackPlan {
  objectives: string;
  buildup: string; // salida de balón
  progression: string;
  attack: string;
  spaces: string; // ocupación de espacios
  principles: string;
  specific: string; // indicaciones para este rival
}
export interface DefensePlan {
  organization: string;
  press: string;
  block: string;
  marking: string;
  vigilance: string;
  objectives: string;
  specific: string;
}
export interface MatchPlan {
  attack: AttackPlan;
  defense: DefensePlan;
}
export const emptyPlan = (): MatchPlan => ({
  attack: { objectives: '', buildup: '', progression: '', attack: '', spaces: '', principles: '', specific: '' },
  defense: { organization: '', press: '', block: '', marking: '', vigilance: '', objectives: '', specific: '' },
});

export interface Match extends Row {
  rival: string;
  date: ISODate;
  venue: Venue;
  competition: string;
  /** 'scheduled' = programado (p. ej. creado desde una convocatoria); solo 'played' cuenta en estadísticas. */
  status: MatchStatus;
  callup_id: string | null;
  gf: number;
  ga: number;
  total_mins: number;
  tactic: string;
  notes: string; // observaciones
  motm: string | null;
  goals: ScoredGoal[];
  conceded: ConcededGoal[];
  cards: CardEvent[];
  lineup: LineupEntry[];
  subs: Substitution[];
  incidents: Incident[];
  rival_info: RivalInfo;
  plan: MatchPlan;
  deleted_at: string | null;
}

// ---------------------------------------------------------------------------
// Resto de registros
// ---------------------------------------------------------------------------
/** Llegada de un jugador a un entreno o partido. */
export type Punctuality = 'punctual' | 'late' | 'absent';
export interface Arrival {
  status: Punctuality;
  /** Solo con retraso; opcionales. */
  minutes_late?: number | null;
  arrival_time?: string;
  note?: string;
}
export interface TrainingAttendance extends Arrival {
  pid: string;
}

export interface Training extends Row {
  date: ISODate;
  notes: string;
  /** Jugadores que asistieron (puntuales o con retraso). Derivado de `attendance`; se mantiene por compatibilidad. */
  present: string[];
  /** Estado de cada jugador; los no listados cuentan como ausentes. */
  attendance: TrainingAttendance[];
}

export interface Evaluation extends Row {
  player_id: string;
  date: ISODate;
  skills: Record<string, number>;
  notes: string;
}

export type ObjectiveCategory = 'wins' | 'goals' | 'assists' | 'matches' | 'attendance' | 'cleansheets' | 'custom';

export interface Objective extends Row {
  title: string;
  scope: 'team' | 'player';
  player_id: string | null;
  category: ObjectiveCategory;
  target: number;
  current: number;
}

export type CallupStatus = 'pending' | 'confirmed' | 'declined';
/**
 * Convocatoria. El partido asociado es `matches.callup_id === callup.id` (una única dirección de la relación).
 * `rival` y `date` se mantienen sincronizados con ese partido.
 */
export interface Callup extends Row {
  rival: string;
  date: ISODate;
  meet_time: string;
  place: string;
  players: CallupEntry[];
}
/** `status` = convocado/baja; `arrival` = puntualidad el día del partido (opcional, se rellena después). */
export interface CallupEntry {
  pid: string;
  status: CallupStatus;
  arrival?: Arrival | null;
}

// ---------------------------------------------------------------------------
// Pizarra táctica
// ---------------------------------------------------------------------------
export type PlayKind = 'jugada' | 'ejercicio' | 'situacion';
export type BoardPitch = 'full' | 'half' | 'blank';
export type BoardItemType = 'player' | 'rival' | 'gk' | 'ball' | 'cone' | 'goal' | 'text' | 'area';
export interface BoardItem {
  id: string;
  type: BoardItemType;
  x: number;
  y: number;
  label?: string; // dorsal / texto
  size?: number; // áreas
}
export type BoardLineKind = 'move' | 'pass' | 'dribble';
export interface BoardLine {
  id: string;
  kind: BoardLineKind;
  points: [number, number][];
  /** Elemento que se desplaza a lo largo de la línea al reproducir la jugada. */
  from?: string;
}
export interface BoardData {
  pitch: BoardPitch;
  items: BoardItem[];
  lines: BoardLine[];
}
export const emptyBoard = (): BoardData => ({ pitch: 'full', items: [], lines: [] });

export interface Play extends Row {
  title: string;
  kind: PlayKind;
  description: string;
  data: BoardData;
}

// ---------------------------------------------------------------------------
export interface Dataset {
  players: Player[];
  callups: Callup[];
  matches: Match[];
  trainings: Training[];
  evaluations: Evaluation[];
  objectives: Objective[];
  plays: Play[];
}

export type TableName = keyof Dataset;
/** Orden seguro para las claves foráneas (callups antes que matches). */
export const TABLES: TableName[] = ['players', 'callups', 'matches', 'trainings', 'evaluations', 'objectives', 'plays'];

export const emptyDataset = (): Dataset => ({
  players: [],
  callups: [],
  matches: [],
  trainings: [],
  evaluations: [],
  objectives: [],
  plays: [],
});
