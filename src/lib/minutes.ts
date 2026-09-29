import type { CardEvent, LineupEntry, Substitution } from './types';

/**
 * Minutos jugados de un jugador a partir de la alineación, los cambios y las expulsiones.
 * Titular: desde el 0 hasta que sale (o es expulsado). Suplente: desde que entra hasta el final.
 * Un suplente que no entra en ningún cambio suma 0.
 */
export function autoMinutes(
  entry: Pick<LineupEntry, 'pid' | 'role'>,
  subs: Substitution[],
  cards: CardEvent[],
  total: number,
): number {
  const out = subs.find((s) => s.out_pid === entry.pid)?.min ?? null;
  const inn = subs.find((s) => s.in_pid === entry.pid)?.min ?? null;
  const red = cards.find((c) => c.pid === entry.pid && c.type === 'R')?.min ?? null;
  const start = entry.role === 'TIT' ? 0 : inn;
  if (start == null) return 0;
  const end = Math.min(total, out ?? total, red ?? total);
  return Math.max(0, end - start);
}

/** Recalcula los minutos de toda la alineación respetando los que el entrenador fijó a mano. */
export function applyAutoMinutes(lineup: LineupEntry[], subs: Substitution[], cards: CardEvent[], total: number): LineupEntry[] {
  return lineup.map((e) => (e.mins_manual ? e : { ...e, mins: autoMinutes(e, subs, cards, total) }));
}

/**
 * Deja la alineación coherente con los cambios: quien entra figura como suplente,
 * y los cambios con datos incompletos se ignoran.
 */
export function validSubs(subs: Substitution[]): Substitution[] {
  return subs.filter((s) => s.out_pid && s.in_pid && s.out_pid !== s.in_pid);
}
