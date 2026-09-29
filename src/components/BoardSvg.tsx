import type { PointerEvent as RPointerEvent, Ref } from 'react';
import { PITCH_SIZE, toPath, wavy, type Pt } from '../lib/board';
import type { BoardData, BoardItem, BoardLine } from '../lib/types';

// Colores fijos (no variables CSS): la pizarra se exporta a imagen/PDF y debe verse igual en cualquier tema.
export const BOARD = { grass: '#e8f0e4', line: '#8fa88b', navy: '#1b3a6b', rival: '#c2410c', gk: '#e2a800', cone: '#f97316', ink: '#0f1a2e' };

function Field({ pitch }: { pitch: BoardData['pitch'] }) {
  const { w, h } = PITCH_SIZE[pitch];
  const ln = { fill: 'none', stroke: BOARD.line, strokeWidth: 3 };
  if (pitch === 'blank') {
    return (
      <>
        <rect x={0} y={0} width={w} height={h} fill={BOARD.grass} />
        {Array.from({ length: 9 }, (_, i) => (
          <g key={i} stroke={BOARD.line} strokeWidth={1} opacity={0.4}>
            <line x1={(i + 1) * 68} y1={0} x2={(i + 1) * 68} y2={h} />
            <line x1={0} y1={(i + 1) * 68} x2={w} y2={(i + 1) * 68} />
          </g>
        ))}
        <rect x={12} y={12} width={w - 24} height={h - 24} {...ln} />
      </>
    );
  }
  const bottom = pitch === 'full' ? 1030 : 545;
  return (
    <>
      <rect x={0} y={0} width={w} height={h} fill={BOARD.grass} />
      <rect x={20} y={20} width={640} height={bottom - 20} {...ln} />
      <rect x={150.5} y={20} width={379} height={159} {...ln} />
      <rect x={254} y={20} width={172} height={53} {...ln} />
      <circle cx={340} cy={126} r={3.5} fill={BOARD.line} />
      <path d="M272.3 179 A86 86 0 0 0 407.7 179" {...ln} />
      <rect x={300} y={6} width={80} height={14} {...ln} strokeWidth={4} />
      {pitch === 'full' ? (
        <>
          <line x1={20} y1={525} x2={660} y2={525} {...ln} />
          <circle cx={340} cy={525} r={86} {...ln} />
          <circle cx={340} cy={525} r={3.5} fill={BOARD.line} />
          <rect x={150.5} y={871} width={379} height={159} {...ln} />
          <rect x={254} y={977} width={172} height={53} {...ln} />
          <circle cx={340} cy={924} r={3.5} fill={BOARD.line} />
          <path d="M272.3 871 A86 86 0 0 1 407.7 871" {...ln} />
          <rect x={300} y={1030} width={80} height={14} {...ln} strokeWidth={4} />
        </>
      ) : (
        <path d="M254 545 A86 86 0 0 1 426 545" {...ln} />
      )}
    </>
  );
}

function Item({ it, pos, selected }: { it: BoardItem; pos: Pt; selected: boolean }) {
  const [x, y] = pos;
  const ring = selected && <circle data-ui="1" cx={x} cy={y} r={it.type === 'area' ? (it.size ?? 110) + 6 : 34} fill="none" stroke="#2563eb" strokeWidth={3} strokeDasharray="7 5" />;
  switch (it.type) {
    case 'player':
    case 'rival':
    case 'gk': {
      const fill = it.type === 'player' ? BOARD.navy : it.type === 'rival' ? BOARD.rival : BOARD.gk;
      return (
        <g>
          {ring}
          <circle cx={x} cy={y} r={23} fill={fill} stroke="#fff" strokeWidth={3} />
          <text x={x} y={y + 6.5} textAnchor="middle" fontSize={(it.label ?? '').length > 2 ? 15 : 20} fontWeight={800} fill={it.type === 'gk' ? BOARD.ink : '#fff'} style={{ pointerEvents: 'none' }}>{it.label}</text>
        </g>
      );
    }
    case 'ball':
      return (
        <g>
          {ring}
          <circle cx={x} cy={y} r={11} fill="#fff" stroke={BOARD.ink} strokeWidth={2.5} />
          <circle cx={x} cy={y} r={4} fill={BOARD.ink} />
        </g>
      );
    case 'cone':
      return (
        <g>
          {ring}
          <path d={`M${x} ${y - 16} L${x + 14} ${y + 12} L${x - 14} ${y + 12} Z`} fill={BOARD.cone} stroke="#fff" strokeWidth={2} />
        </g>
      );
    case 'goal':
      return (
        <g>
          {ring}
          <rect x={x - 45} y={y - 14} width={90} height={28} fill="#fff" fillOpacity={0.6} stroke={BOARD.ink} strokeWidth={4} />
          <path d={`M${x - 30} ${y - 14} v28 M${x - 15} ${y - 14} v28 M${x} ${y - 14} v28 M${x + 15} ${y - 14} v28 M${x + 30} ${y - 14} v28`} stroke={BOARD.ink} strokeWidth={1} opacity={0.5} />
        </g>
      );
    case 'area':
      return (
        <g>
          {ring}
          <ellipse cx={x} cy={y} rx={it.size ?? 110} ry={(it.size ?? 110) * 0.7} fill={BOARD.navy} fillOpacity={0.16} stroke={BOARD.navy} strokeWidth={2.5} strokeDasharray="9 7" />
        </g>
      );
    case 'text': {
      const label = it.label || 'Texto';
      const wd = Math.max(40, label.length * 12 + 20);
      return (
        <g>
          {ring}
          <rect x={x - wd / 2} y={y - 18} width={wd} height={36} rx={8} fill="#fff" fillOpacity={0.92} stroke={BOARD.navy} strokeWidth={2} />
          <text x={x} y={y + 6} textAnchor="middle" fontSize={18} fontWeight={700} fill={BOARD.ink} style={{ pointerEvents: 'none' }}>{label}</text>
        </g>
      );
    }
  }
}

interface Props {
  data: BoardData;
  svgRef?: Ref<SVGSVGElement>;
  id?: string;
  selected?: { kind: 'item' | 'line'; id: string } | null;
  /** Posiciones temporales (reproducción de la jugada). */
  overrides?: Record<string, Pt>;
  draft?: BoardLine | null;
  onItemDown?: (e: RPointerEvent, it: BoardItem) => void;
  onLineDown?: (e: RPointerEvent, l: BoardLine) => void;
  onBackgroundDown?: (e: RPointerEvent) => void;
  onMove?: (e: RPointerEvent) => void;
  onUp?: (e: RPointerEvent) => void;
  className?: string;
  label?: string;
}

const STROKE = { move: { dash: undefined, w: 5 }, pass: { dash: '14 10', w: 5 }, dribble: { dash: undefined, w: 4 } } as const;

export function BoardSvg({ data, svgRef, id, selected, overrides, draft, onItemDown, onLineDown, onBackgroundDown, onMove, onUp, className, label }: Props) {
  const { w, h } = PITCH_SIZE[data.pitch];
  const posOf = (it: BoardItem): Pt => overrides?.[it.id] ?? [it.x, it.y];
  const order: Record<string, number> = { area: 0, cone: 1, goal: 1, ball: 3, text: 4 };
  const items = [...data.items].sort((a, b) => (order[a.type] ?? 2) - (order[b.type] ?? 2));
  const drawLine = (l: BoardLine, isDraft = false) => {
    const pts = l.kind === 'dribble' ? wavy(l.points) : l.points;
    const sel = selected?.kind === 'line' && selected.id === l.id;
    return (
      <g key={l.id}>
        {sel && <path data-ui="1" d={toPath(pts)} fill="none" stroke="#2563eb" strokeWidth={STROKE[l.kind].w + 8} strokeOpacity={0.35} strokeLinecap="round" strokeLinejoin="round" />}
        <path d={toPath(pts)} fill="none" stroke={BOARD.navy} strokeWidth={STROKE[l.kind].w} strokeDasharray={STROKE[l.kind].dash} strokeLinecap="round" strokeLinejoin="round" opacity={isDraft ? 0.6 : 1} markerEnd={isDraft ? undefined : 'url(#mef-arrow)'} />
        {onLineDown && !isDraft && <path data-ui="1" d={toPath(l.points)} fill="none" stroke="transparent" strokeWidth={28} strokeLinecap="round" style={{ cursor: 'pointer' }} onPointerDown={(e) => onLineDown(e, l)} />}
      </g>
    );
  };
  return (
    <svg
      ref={svgRef} id={id} className={className} viewBox={`0 0 ${w} ${h}`} xmlns="http://www.w3.org/2000/svg" role="img" aria-label={label ?? 'Pizarra táctica'}
      onPointerDown={onBackgroundDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
    >
      <defs>
        <marker id="mef-arrow" markerUnits="userSpaceOnUse" markerWidth={26} markerHeight={26} refX={20} refY={13} orient="auto">
          <path d="M2 3 L22 13 L2 23 L8 13 Z" fill={BOARD.navy} />
        </marker>
      </defs>
      <Field pitch={data.pitch} />
      {data.lines.map((l) => drawLine(l))}
      {items.map((it) => (
        <g key={it.id} data-item={it.id} style={onItemDown ? { cursor: 'grab' } : undefined} onPointerDown={onItemDown ? (e) => onItemDown(e, it) : undefined}>
          <Item it={it} pos={posOf(it)} selected={selected?.kind === 'item' && selected.id === it.id} />
          {onItemDown && <circle data-ui="1" cx={posOf(it)[0]} cy={posOf(it)[1]} r={it.type === 'area' ? 30 : it.type === 'text' ? 28 : 34} fill="transparent" />}
        </g>
      ))}
      {draft && <g data-ui="1">{drawLine(draft, true)}</g>}
    </svg>
  );
}
