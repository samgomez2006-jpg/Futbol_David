import type { ObjectiveCategory, Position } from './types';

export const POSITIONS: Position[] = ['Portero', 'Defensa', 'Centrocampista', 'Delantero'];
export const SKILLS = ['Técnica', 'Pase', 'Defensa', 'Velocidad', 'Posicionamiento', 'Actitud', 'Esfuerzo'];
export const GOAL_TYPES = [
  'Jugada elaborada', 'Contraataque', 'Córner', 'Falta directa', 'Penalti',
  'Saque de banda', 'Error defensivo', 'Pérdida en salida', 'Segunda jugada', 'Otro',
];
export const BODY_PARTS = ['Pie derecho', 'Pie izquierdo', 'Cabeza', 'Otro'];
export const FIELD_ZONES = ['Área pequeña', 'Dentro del área', 'Fuera del área', 'Banda izquierda', 'Banda derecha', 'Centro'];
export const GOAL_ZONES = [
  'Arriba izq.', 'Arriba centro', 'Arriba der.',
  'Medio izq.', 'Centro', 'Medio der.',
  'Abajo izq.', 'Abajo centro', 'Abajo der.',
];
export const TRASH_DAYS = 30;

export interface Slot { p: string; x: number; y: number }
export const FORMATIONS: Record<string, Slot[]> = {
  '4-3-3': [{p:'POR',x:50,y:92},{p:'DFI',x:15,y:72},{p:'DCI',x:38,y:78},{p:'DCD',x:62,y:78},{p:'DFD',x:85,y:72},{p:'MCI',x:28,y:50},{p:'MC',x:50,y:46},{p:'MCD',x:72,y:50},{p:'EXI',x:18,y:22},{p:'DEL',x:50,y:14},{p:'EXD',x:82,y:22}],
  '4-4-2': [{p:'POR',x:50,y:92},{p:'DFI',x:15,y:72},{p:'DCI',x:38,y:78},{p:'DCD',x:62,y:78},{p:'DFD',x:85,y:72},{p:'MI',x:14,y:46},{p:'MCI',x:38,y:50},{p:'MCD',x:62,y:50},{p:'MD',x:86,y:46},{p:'DEL1',x:38,y:16},{p:'DEL2',x:62,y:16}],
  '3-5-2': [{p:'POR',x:50,y:92},{p:'DCI',x:25,y:76},{p:'DC',x:50,y:80},{p:'DCD',x:75,y:76},{p:'MI',x:10,y:50},{p:'MCI',x:32,y:48},{p:'MC',x:50,y:44},{p:'MCD',x:68,y:48},{p:'MD',x:90,y:50},{p:'DEL1',x:38,y:16},{p:'DEL2',x:62,y:16}],
  '4-2-3-1': [{p:'POR',x:50,y:92},{p:'DFI',x:15,y:72},{p:'DCI',x:38,y:78},{p:'DCD',x:62,y:78},{p:'DFD',x:85,y:72},{p:'MCD1',x:38,y:58},{p:'MCD2',x:62,y:58},{p:'MI',x:18,y:34},{p:'MO',x:50,y:32},{p:'MD',x:82,y:34},{p:'DEL',x:50,y:12}],
  '3-4-3': [{p:'POR',x:50,y:92},{p:'DCI',x:25,y:76},{p:'DC',x:50,y:80},{p:'DCD',x:75,y:76},{p:'MI',x:12,y:48},{p:'MCI',x:36,y:50},{p:'MCD',x:64,y:50},{p:'MD',x:88,y:48},{p:'EXI',x:20,y:18},{p:'DEL',x:50,y:12},{p:'EXD',x:80,y:18}],
  // Fútbol 7 (categorías base)
  'F7 2-3-1': [{p:'POR',x:50,y:92},{p:'DCI',x:30,y:72},{p:'DCD',x:70,y:72},{p:'MI',x:16,y:46},{p:'MC',x:50,y:50},{p:'MD',x:84,y:46},{p:'DEL',x:50,y:16}],
  'F7 3-2-1': [{p:'POR',x:50,y:92},{p:'DI',x:20,y:72},{p:'DC',x:50,y:76},{p:'DD',x:80,y:72},{p:'MCI',x:34,y:46},{p:'MCD',x:66,y:46},{p:'DEL',x:50,y:16}],
  // Fútbol 8
  'F8 3-3-1': [{p:'POR',x:50,y:92},{p:'DI',x:20,y:72},{p:'DC',x:50,y:76},{p:'DD',x:80,y:72},{p:'MI',x:18,y:46},{p:'MC',x:50,y:50},{p:'MD',x:82,y:46},{p:'DEL',x:50,y:16}],
};

/**
 * Hueco = etiqueta + índice. Se guarda en lineup[].slot para poder reconstruir la alineación.
 * Las formaciones personalizadas usan los huecos de 4-3-3.
 */
export const slotKey = (s: Slot, i: number) => `${s.p}#${i}`;
export const slotLabel = (key: string | null) => (key ? key.split('#')[0].replace(/\d+$/, '') : '');
export const formationSlots = (tactic: string): Slot[] => FORMATIONS[tactic] ?? FORMATIONS['4-3-3'];

export const OBJECTIVE_LABELS: Record<ObjectiveCategory, string> = {
  wins: 'Victorias',
  goals: 'Goles',
  assists: 'Asistencias',
  matches: 'Partidos jugados',
  attendance: 'Entrenamientos',
  cleansheets: 'Porterías a cero',
  custom: 'Personalizado (manual)',
};
export const TEAM_OBJECTIVES: ObjectiveCategory[] = ['wins', 'goals', 'cleansheets', 'attendance', 'custom'];
export const PLAYER_OBJECTIVES: ObjectiveCategory[] = ['goals', 'assists', 'matches', 'attendance', 'cleansheets', 'custom'];
