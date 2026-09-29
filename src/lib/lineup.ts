import { formationSlots, slotKey, slotLabel } from './constants';
import type { LineupEntry } from './types';

/**
 * Coloca a los titulares en los huecos de la formación. Admite datos antiguos cuyo hueco no coincide
 * con la formación actual (se recolocan por nombre de posición); los que no caben van a `extras`.
 */
export function resolveAssign(tactic: string, lineup: LineupEntry[]): { assign: Record<string, string>; extras: LineupEntry[] } {
  const slots = formationSlots(tactic);
  const keys = slots.map(slotKey);
  const assign: Record<string, string> = {};
  const rest: LineupEntry[] = [];
  for (const e of lineup.filter((x) => x.role === 'TIT')) {
    if (e.slot && keys.includes(e.slot) && !assign[e.slot]) assign[e.slot] = e.pid;
    else rest.push(e);
  }
  const extras: LineupEntry[] = [];
  for (const e of rest) {
    const label = slotLabel(e.slot);
    const idx = slots.findIndex((s, i) => !assign[keys[i]] && (s.p === label || s.p.replace(/\d+$/, '') === label));
    if (idx >= 0) assign[keys[idx]] = e.pid;
    else extras.push(e);
  }
  return { assign, extras };
}
