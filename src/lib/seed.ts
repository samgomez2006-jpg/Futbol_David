// Equipo de partida: la copia SAGRAT_COR_backup.json de la raíz del repositorio.
// Se ofrece en la bienvenida ("Cargar SAGRAT COR"); nunca se aplica solo ni encima de datos existentes.
// (Aviso: al ir dentro de la app cualquiera puede leerlo; pendiente de la fase de seguridad.)
import seedJson from '../../SAGRAT_COR_backup.json';
import { parseBackup } from './backup';
import type { Dataset, Team } from './types';

export const SEED_LABEL = { name: 'SAGRAT COR', detail: 'Cadete Sub15 · 2026-27' };

export function seedFor(teamId: string): { team: Omit<Team, 'id'>; data: Dataset } {
  return parseBackup(seedJson, teamId);
}
