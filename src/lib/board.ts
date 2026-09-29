import { uid } from './id';
import type { BoardData, BoardItem, BoardItemType, BoardPitch } from './types';

export type Pt = [number, number];

/** Tamaño del lienzo de cada tipo de campo (≈10 unidades por metro). */
export const PITCH_SIZE: Record<BoardPitch, { w: number; h: number }> = {
  full: { w: 680, h: 1050 },
  half: { w: 680, h: 570 },
  blank: { w: 680, h: 680 },
};
export const PITCH_LABEL: Record<BoardPitch, string> = { full: 'Campo completo', half: 'Medio campo', blank: 'Zona libre' };

export const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);
export const clampToPitch = (pitch: BoardPitch, x: number, y: number): Pt => [clamp(x, 8, PITCH_SIZE[pitch].w - 8), clamp(y, 8, PITCH_SIZE[pitch].h - 8)];

const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** Ramer–Douglas–Peucker: reduce un trazo a mano alzada a pocos puntos. */
export function simplify(points: Pt[], eps = 7): Pt[] {
  if (points.length < 3) return points;
  const [a, b] = [points[0], points[points.length - 1]];
  let maxD = 0;
  let idx = 0;
  const len = dist(a, b) || 1;
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i];
    const d = Math.abs((b[0] - a[0]) * (a[1] - p[1]) - (a[0] - p[0]) * (b[1] - a[1])) / len;
    if (d > maxD) {
      maxD = d;
      idx = i;
    }
  }
  if (maxD <= eps) return [a, b];
  return [...simplify(points.slice(0, idx + 1), eps).slice(0, -1), ...simplify(points.slice(idx), eps)];
}

export function pathLength(points: Pt[]): number {
  let l = 0;
  for (let i = 1; i < points.length; i++) l += dist(points[i - 1], points[i]);
  return l;
}

/** Punto situado a la fracción `t` (0–1) del recorrido. */
export function pointAlong(points: Pt[], t: number): Pt {
  if (points.length === 1) return points[0];
  const total = pathLength(points);
  let target = clamp(t, 0, 1) * total;
  for (let i = 1; i < points.length; i++) {
    const seg = dist(points[i - 1], points[i]);
    if (target <= seg || i === points.length - 1) {
      const k = seg ? Math.min(target / seg, 1) : 0;
      return [points[i - 1][0] + (points[i][0] - points[i - 1][0]) * k, points[i - 1][1] + (points[i][1] - points[i - 1][1]) * k];
    }
    target -= seg;
  }
  return points[points.length - 1];
}

/** Trazo ondulado (conducción): oscila a ambos lados de la trayectoria original y termina en su último punto. */
export function wavy(points: Pt[], amp = 6, step = 16): Pt[] {
  const total = pathLength(points);
  if (total < step * 2) return points;
  const n = Math.floor(total / step);
  const out: Pt[] = [points[0]];
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const p = pointAlong(points, t);
    const q = pointAlong(points, Math.min(t + 0.01, 1));
    const p0 = pointAlong(points, Math.max(t - 0.01, 0));
    const dx = q[0] - p0[0];
    const dy = q[1] - p0[1];
    const l = Math.hypot(dx, dy) || 1;
    const s = i % 2 ? amp : -amp;
    out.push([p[0] + (-dy / l) * s, p[1] + (dx / l) * s]);
  }
  out.push(points[points.length - 1]);
  return out;
}

export const toPath = (pts: Pt[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');

/** Elemento que arrastrar/animar más cercano a un punto (jugadores y balón). */
export function snapItem(items: BoardItem[], p: Pt, radius = 34): BoardItem | undefined {
  let best: BoardItem | undefined;
  let bd = radius;
  for (const it of items) {
    if (!['player', 'rival', 'gk', 'ball'].includes(it.type)) continue;
    const d = dist([it.x, it.y], p);
    if (d < bd) {
      bd = d;
      best = it;
    }
  }
  return best;
}

export function newItem(type: BoardItemType, board: BoardData): BoardItem {
  const { w, h } = PITCH_SIZE[board.pitch];
  const n = board.items.length; // se van repartiendo en cascada para no apilarse sobre lo anterior
  const jitter = (n % 7) * 34;
  const base: BoardItem = { id: uid(), type, x: w / 2 + (n % 2 ? jitter : -jitter), y: h / 2 + jitter };
  if (type === 'player') {
    const used = board.items.filter((i) => i.type === 'player').map((i) => Number(i.label)).filter(Number.isFinite);
    return { ...base, label: String((used.length ? Math.max(...used) : 0) + 1) };
  }
  if (type === 'rival') {
    const used = board.items.filter((i) => i.type === 'rival').map((i) => Number(i.label)).filter(Number.isFinite);
    return { ...base, label: String((used.length ? Math.max(...used) : 0) + 1) };
  }
  if (type === 'gk') return { ...base, label: '1' };
  if (type === 'text') return { ...base, label: 'Texto' };
  if (type === 'area') return { ...base, size: 110 };
  return base;
}
