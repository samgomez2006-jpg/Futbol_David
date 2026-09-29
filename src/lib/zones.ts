// División del campo para registrar desde dónde se produce cada gol.
//
// UNA sola definición para el registro (selector interactivo) y para las analíticas (mapas de burbujas):
// cambiar una zona aquí cambia las dos pantallas. Se usa media pista con la portería atacada arriba:
//  - goles a favor: zona desde la que marcamos, mirando la portería rival;
//  - goles en contra: zona desde la que nos marcan, mirando NUESTRA portería.
// Izquierda / derecha son las del jugador que ataca esa portería (como se ve en pantalla).
//
// Coordenadas en un lienzo de 340 × 300 (5 unidades ≈ 1 metro: ancho del campo 68 m).

export const ZONE_W = 340;
export const ZONE_H = 300;

export interface Zone {
  id: string;
  label: string;
  short: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

// Columnas: [0-69] banda · [69-124] lateral del área · [124-216] centro · [216-271] lateral del área · [271-340] banda
// Filas:    [0-28] área pequeña · [28-83] resto del área · [83-150] exterior del área · [150-300] lejos
export const ZONES: Zone[] = [
  { id: 'Z1', label: 'Área pequeña', short: 'Á. pequeña', x: 124, y: 0, w: 92, h: 28 },
  { id: 'Z2', label: 'Área · lado izquierdo', short: 'Área izq.', x: 69, y: 0, w: 55, h: 83 },
  { id: 'Z3', label: 'Área · centro', short: 'Área centro', x: 124, y: 28, w: 92, h: 55 },
  { id: 'Z4', label: 'Área · lado derecho', short: 'Área der.', x: 216, y: 0, w: 55, h: 83 },
  { id: 'Z5', label: 'Frontal del área', short: 'Frontal', x: 124, y: 83, w: 92, h: 67 },
  { id: 'Z6', label: 'Exterior izquierdo', short: 'Ext. izq.', x: 0, y: 83, w: 124, h: 67 },
  { id: 'Z7', label: 'Exterior derecho', short: 'Ext. der.', x: 216, y: 83, w: 124, h: 67 },
  { id: 'Z8', label: 'Banda izquierda', short: 'Banda izq.', x: 0, y: 0, w: 69, h: 83 },
  { id: 'Z9', label: 'Banda derecha', short: 'Banda der.', x: 271, y: 0, w: 69, h: 83 },
  { id: 'Z10', label: 'Larga distancia', short: 'Lejos', x: 0, y: 150, w: 340, h: 150 },
];

export const zoneById = (id: string): Zone | undefined => ZONES.find((z) => z.id === id);
export const zoneLabel = (id: string): string => zoneById(id)?.label ?? '';
export const zoneCenter = (z: Zone): [number, number] => [z.x + z.w / 2, z.y + z.h / 2];

/** Nombres de zona de versiones anteriores → id de zona actual. */
const LEGACY: Record<string, string> = {
  'Área pequeña': 'Z1',
  'Dentro del área': 'Z3',
  'Fuera del área': 'Z5',
  'Banda izquierda': 'Z8',
  'Banda derecha': 'Z9',
  Centro: 'Z5',
};

/** Devuelve un id de zona válido o '' (sin zona). Acepta ids actuales y nombres antiguos. */
export function normalizeZone(v: unknown): string {
  if (typeof v !== 'string') return '';
  if (zoneById(v)) return v;
  return LEGACY[v] ?? '';
}

/** Zona a partir de un punto del lienzo (para el selector táctil). */
export function zoneAt(x: number, y: number): Zone | undefined {
  return ZONES.find((z) => x >= z.x && x < z.x + z.w && y >= z.y && y < z.y + z.h);
}

/** Mínimo de goles con zona para sacar conclusiones en analíticas. */
export const MIN_ZONE_GOALS = 5;
