import type { ISODate } from './types';

const pad = (n: number) => String(n).padStart(2, '0');

/** Fecha local de hoy (el original usaba toISOString → UTC, que da el día anterior de madrugada). */
export function todayISO(d = new Date()): ISODate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fmtDate(d: ISODate | null | undefined): string {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export function fmtDateLong(d: ISODate): string {
  const [y, m, day] = d.split('-').map(Number);
  return `${day} ${MONTHS[m - 1]} ${y}`;
}

/** Edad en años sin pasar por UTC. */
export function ageYears(birth: ISODate | null, now = new Date()): number | null {
  if (!birth) return null;
  const [y, m, d] = birth.split('-').map(Number);
  if (!y || !m || !d) return null;
  let a = now.getFullYear() - y;
  const mo = now.getMonth() + 1;
  if (mo < m || (mo === m && now.getDate() < d)) a--;
  return a;
}

/** Temporada deportiva actual (julio → junio), p. ej. "2026-27". */
export function currentSeason(now = new Date()): string {
  const y = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  return `${y}-${String((y + 1) % 100).padStart(2, '0')}`;
}

export const compareDateDesc = (a: { date: ISODate }, b: { date: ISODate }) =>
  a.date < b.date ? 1 : a.date > b.date ? -1 : 0;
