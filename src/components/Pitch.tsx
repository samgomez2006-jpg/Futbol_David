import { formationSlots, GOAL_ZONES, slotKey } from '../lib/constants';
import type { Player } from '../lib/types';

export interface PitchMark {
  /** Minuto en el que este jugador sale (cambio). */
  out?: number | null;
  /** Minuto en el que entró (para suplentes que aparecen en el campo). */
  in?: number | null;
}

interface PitchProps {
  tactic: string;
  /** hueco → id de jugador */
  assign: Record<string, string>;
  players: Map<string, Player>;
  /** Si no se pasa, el campo es de solo lectura. */
  onSlot?: (key: string, label: string) => void;
  marks?: Record<string, PitchMark>;
  compact?: boolean;
}

const W = 320;
const H = 420;

export function PitchLines() {
  const line = { fill: 'none', stroke: 'var(--pitch-line)', strokeWidth: 2 };
  return (
    <>
      <rect x={0} y={0} width={W} height={H} rx={12} fill="var(--pitch)" />
      <rect x={8} y={8} width={W - 16} height={H - 16} rx={4} {...line} />
      <line x1={8} y1={H / 2} x2={W - 8} y2={H / 2} {...line} />
      <circle cx={W / 2} cy={H / 2} r={36} {...line} />
      <circle cx={W / 2} cy={H / 2} r={2.5} fill="var(--pitch-line)" />
      <rect x={W / 2 - 62} y={8} width={124} height={50} {...line} />
      <rect x={W / 2 - 28} y={8} width={56} height={20} {...line} />
      <rect x={W / 2 - 62} y={H - 58} width={124} height={50} {...line} />
      <rect x={W / 2 - 28} y={H - 28} width={56} height={20} {...line} />
    </>
  );
}

export function Pitch({ tactic, assign, players, onSlot, marks, compact }: PitchProps) {
  const slots = formationSlots(tactic);
  return (
    <svg className={`pitch-svg ${compact ? 'mini' : ''}`} viewBox={`0 0 ${W} ${H}`} role={onSlot ? 'group' : 'img'} aria-label={`Campo ${tactic}`}>
      <PitchLines />
      {slots.map((s, i) => {
        const key = slotKey(s, i);
        const px = (s.x / 100) * (W - 44) + 22;
        const py = (s.y / 100) * (H - 50) + 25;
        const p = assign[key] ? players.get(assign[key]) : undefined;
        const mk = p ? marks?.[p.id] : undefined;
        const label = p ? (p.number != null ? String(p.number) : p.name.slice(0, 2).toUpperCase()) : s.p.replace(/\d+$/, '');
        const body = (
          <>
            <circle cx={px} cy={py} r={19} fill={p ? 'var(--accent)' : 'var(--bg)'} stroke={p ? 'var(--accent-d)' : 'var(--text3)'} strokeWidth={p ? 0 : 1.5} strokeDasharray={p ? undefined : '3 3'} />
            <text x={px} y={py + 4.5} textAnchor="middle" fontSize={p ? 13 : 10} fontWeight={750} fill={p ? 'var(--on-accent)' : 'var(--text3)'}>{label}</text>
            {!compact && p && (
              <text x={px} y={py + 34} textAnchor="middle" fontSize={10.5} fontWeight={650} fill="var(--text)" paintOrder="stroke" stroke="var(--pitch)" strokeWidth={3}>
                {p.name.split(' ')[0].slice(0, 11)}
              </text>
            )}
            {mk?.out != null && (
              <g>
                <circle cx={px + 15} cy={py - 15} r={9.5} fill="var(--loss)" stroke="var(--pitch)" strokeWidth={1.5} />
                <text x={px + 15} y={py - 11.6} textAnchor="middle" fontSize={8.5} fontWeight={800} fill="#fff">{mk.out}'</text>
              </g>
            )}
          </>
        );
        return onSlot ? (
          <g
            key={key} className="pitch-pos" role="button" tabIndex={0} aria-label={`${s.p}: ${p ? p.name : 'vacío'}`}
            onClick={() => onSlot(key, s.p)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSlot(key, s.p)}
          >
            {body}
          </g>
        ) : (
          <g key={key}>{body}</g>
        );
      })}
    </svg>
  );
}

export function GoalGrid({ selected, onSelect }: { selected: string; onSelect: (z: string) => void }) {
  const w = 180, h = 120;
  const cw = (w - 8) / 3, ch = (h - 8) / 3;
  return (
    <svg className="goal-svg" viewBox={`0 0 ${w} ${h}`} role="radiogroup" aria-label="Zona de la portería">
      {GOAL_ZONES.map((z, i) => {
        const sel = z === selected;
        return (
          <rect
            key={z} className="cell" role="radio" aria-checked={sel} aria-label={z} tabIndex={0}
            x={4 + (i % 3) * cw} y={4 + Math.floor(i / 3) * ch} width={cw} height={ch}
            fill={sel ? 'var(--accent)' : 'var(--bg2)'} stroke="var(--text2)" strokeWidth={1}
            onClick={() => onSelect(sel ? '' : z)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect(sel ? '' : z)}
          />
        );
      })}
      <rect x={4} y={4} width={w - 8} height={h - 8} fill="none" stroke="var(--text)" strokeWidth={3} pointerEvents="none" />
    </svg>
  );
}
