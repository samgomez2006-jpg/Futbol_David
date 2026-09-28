import { describe, expect, it } from 'vitest';
import { ageYears, currentSeason, fmtDate, todayISO } from './dates';

describe('dates', () => {
  it('todayISO usa la fecha local', () => expect(todayISO(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05'));
  it('fmtDate', () => expect(fmtDate('2026-09-28')).toBe('28/09/2026'));
  it('ageYears respeta el cumpleaños', () => {
    expect(ageYears('2014-09-29', new Date(2026, 8, 28))).toBe(11);
    expect(ageYears('2014-09-28', new Date(2026, 8, 28))).toBe(12);
    expect(ageYears(null)).toBeNull();
  });
  it('currentSeason cambia en julio', () => {
    expect(currentSeason(new Date(2026, 5, 30))).toBe('2025-26');
    expect(currentSeason(new Date(2026, 6, 1))).toBe('2026-27');
  });
});
