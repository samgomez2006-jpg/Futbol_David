import { describe, expect, it } from 'vitest';
import { applyAutoMinutes, autoMinutes } from './minutes';
import type { CardEvent, LineupEntry, Substitution } from './types';

const sub = (min: number, out: string, inn: string): Substitution => ({ id: `${out}${inn}`, min, out_pid: out, in_pid: inn });

describe('autoMinutes', () => {
  it('el titular juega todo el partido si no sale', () => expect(autoMinutes({ pid: 'a', role: 'TIT' }, [], [], 70)).toBe(70));
  it('titular sustituido: juega hasta el cambio; el suplente, desde que entra', () => {
    const subs = [sub(40, 'a', 'b')];
    expect(autoMinutes({ pid: 'a', role: 'TIT' }, subs, [], 70)).toBe(40);
    expect(autoMinutes({ pid: 'b', role: 'SUP' }, subs, [], 70)).toBe(30);
  });
  it('un suplente que no entra suma 0', () => expect(autoMinutes({ pid: 'c', role: 'SUP' }, [sub(40, 'a', 'b')], [], 70)).toBe(0));
  it('una roja corta los minutos', () => {
    const red: CardEvent[] = [{ id: 'r', pid: 'a', type: 'R', min: 55 }];
    expect(autoMinutes({ pid: 'a', role: 'TIT' }, [], red, 70)).toBe(55);
  });
  it('encadena cambios (entra y vuelve a salir)', () => {
    const subs = [sub(20, 'a', 'b'), sub(50, 'b', 'c')];
    expect(autoMinutes({ pid: 'b', role: 'SUP' }, subs, [], 70)).toBe(30);
    expect(autoMinutes({ pid: 'c', role: 'SUP' }, subs, [], 70)).toBe(20);
  });
});

describe('applyAutoMinutes', () => {
  it('respeta los minutos fijados a mano', () => {
    const lineup: LineupEntry[] = [
      { pid: 'a', role: 'TIT', slot: 'POR#0', mins: 70 },
      { pid: 'b', role: 'SUP', slot: null, mins: 99, mins_manual: true },
    ];
    const out = applyAutoMinutes(lineup, [sub(30, 'a', 'b')], [], 70);
    expect(out[0].mins).toBe(30);
    expect(out[1].mins).toBe(99);
  });
});
