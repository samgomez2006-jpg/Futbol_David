// Modelo de datos. Los nombres de campo coinciden con las columnas de Supabase (snake_case)
// para que el sync no necesite mapeos.

export type ISODate = string; // 'YYYY-MM-DD'
export type Position = 'Portero' | 'Defensa' | 'Centrocampista' | 'Delantero';
export type Foot = 'D' | 'I' | 'A';
export type Venue = 'L' | 'V';
export type Result = 'V' | 'E' | 'D';

interface Row {
  id: string;
  team_id: string;
  updated_at?: string;
}

export interface Team {
  id: string;
  name: string;
  season: string;
  category: string;
  invite_code?: string;
}

export interface Player extends Row {
  name: string;
  number: number | null;
  position: Position;
  birth: ISODate | null;
  foot: Foot;
  archived_at: string | null;
}

export interface GoalEvent {
  id: string;
  min: number | null;
  gtype: string;
  field_zone: string;
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
  slot: string | null; // posición en el campo (clave del hueco de la formación)
  mins: number;
}

export interface Match extends Row {
  rival: string;
  date: ISODate;
  venue: Venue;
  gf: number;
  ga: number;
  total_mins: number;
  tactic: string;
  notes: string;
  motm: string | null;
  goals: ScoredGoal[];
  conceded: ConcededGoal[];
  cards: CardEvent[];
  lineup: LineupEntry[];
  deleted_at: string | null;
}

export interface Training extends Row {
  date: ISODate;
  notes: string;
  present: string[];
}

export interface Evaluation extends Row {
  player_id: string;
  date: ISODate;
  skills: Record<string, number>;
  notes: string;
}

export type ObjectiveCategory =
  | 'wins'
  | 'goals'
  | 'assists'
  | 'matches'
  | 'attendance'
  | 'cleansheets'
  | 'custom';

export interface Objective extends Row {
  title: string;
  scope: 'team' | 'player';
  player_id: string | null;
  category: ObjectiveCategory;
  target: number;
  current: number;
}

export type CallupStatus = 'pending' | 'confirmed' | 'declined';
export interface Callup extends Row {
  rival: string;
  date: ISODate;
  meet_time: string;
  place: string;
  players: { pid: string; status: CallupStatus }[];
}

export interface Dataset {
  players: Player[];
  matches: Match[];
  trainings: Training[];
  evaluations: Evaluation[];
  objectives: Objective[];
  callups: Callup[];
}

export type TableName = keyof Dataset;
export const TABLES: TableName[] = ['players', 'matches', 'trainings', 'evaluations', 'objectives', 'callups'];

export const emptyDataset = (): Dataset => ({
  players: [],
  matches: [],
  trainings: [],
  evaluations: [],
  objectives: [],
  callups: [],
});
