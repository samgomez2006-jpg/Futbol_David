import { describe, expect, it } from 'vitest';
import { blankMatch } from './factories';
import { detectPatterns } from './patterns';

const m = (i: number, notes: string) => blankMatch({ id: `m${i}`, date: `2026-02-0${i}`, rival: `R${i}`, notes });

describe('detectPatterns', () => {
  it('detecta un problema que se repite en varios partidos', () => {
    const r = detectPatterns([
      m(1, 'Perdemos el balón en la salida de balón. Buena presión arriba.'),
      m(2, 'Problemas en la salida de balón otra vez.'),
      m(3, 'Partido serio. Nos cuesta la salida de balón ante su presión.'),
      m(4, 'Sin novedades.'),
    ]);
    const salida = r.patterns.find((p) => p.id === 'salida')!;
    expect(salida.matches).toBe(3);
    expect(salida.tone).toBe('negativo');
    expect(salida.observed).toBe(4);
    expect(salida.examples.length).toBeGreaterThan(0);
  });
  it('un aspecto mencionado en un solo partido no es patrón', () => {
    const r = detectPatterns([m(1, 'Falló el balón parado.'), m(2, 'Buen partido.'), m(3, 'Todo bien.')]);
    expect(r.patterns.find((p) => p.id === 'abp')).toBeUndefined();
  });
  it('ignora tildes y mayúsculas y reconoce tono positivo', () => {
    const r = detectPatterns([m(1, 'BUENA PRESIÓN en todo el partido.'), m(2, 'Muy bien la presion alta.')]);
    const p = r.patterns.find((x) => x.id === 'presion')!;
    expect(p.tone).toBe('positivo');
  });
  it('sin observaciones no hay patrones', () => {
    expect(detectPatterns([blankMatch(), blankMatch()])).toEqual({ patterns: [], observed: 0 });
  });
});
