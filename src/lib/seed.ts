// Datos iniciales del equipo: la copia SAGRAT_COR_backup.json que está en la raíz del repositorio.
// Se cargan solo en un dispositivo vacío (primera vez, sin cuenta), nunca encima de datos existentes.
import seedJson from '../../SAGRAT_COR_backup.json';
import { parseBackup } from './backup';
import type { Dataset, Team } from './types';

export function seedFor(teamId: string): { team: Omit<Team, 'id'>; data: Dataset } {
  return parseBackup(seedJson, teamId);
}
