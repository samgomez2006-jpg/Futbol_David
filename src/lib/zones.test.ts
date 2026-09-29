import { describe, expect, it } from 'vitest';
import { ZONES, ZONE_H, ZONE_W, normalizeZone, zoneAt } from './zones';

describe('zonas del campo', () => {
  it('las zonas cubren todo el lienzo sin solaparse (regresión: la división debe ser única)', () => {
    const area = ZONES.reduce((a, z) => a + z.w * z.h, 0);
    expect(area).toBe(ZONE_W * ZONE_H);
    for (let x = 1; x < ZONE_W; x += 7)
      for (let y = 1; y < ZONE_H; y += 7) {
        const hits = ZONES.filter((z) => x >= z.x && x < z.x + z.w && y >= z.y && y < z.y + z.h);
        expect(hits).toHaveLength(1);
      }
  });
  it('zoneAt encuentra la zona de un punto', () => {
    expect(zoneAt(170, 10)?.id).toBe('Z1');
    expect(zoneAt(170, 100)?.id).toBe('Z5');
    expect(zoneAt(10, 10)?.id).toBe('Z8');
    expect(zoneAt(170, 250)?.id).toBe('Z10');
  });
  it('convierte nombres de zona antiguos y descarta los desconocidos', () => {
    expect(normalizeZone('Dentro del área')).toBe('Z3');
    expect(normalizeZone('Z7')).toBe('Z7');
    expect(normalizeZone('nada')).toBe('');
    expect(normalizeZone(undefined)).toBe('');
  });
});
