import { formationSlots, GOAL_ZONES, slotKey } from '../lib/constants';
import type { Player } from '../lib/types';

interface PitchProps {
  tactic: string;
  assign: Record<string, string>; // slotKey -> pid
  players: Map<string, Player>;
  onSlot: (key: string, label: string) => void;
}

export function Pitch({ tactic, assign, players, onSlot }: PitchProps) {
  const slots = formationSlots(tactic);
  const w = 320, h = 420;
  const line = { fill: 'none', stroke: 'var(--pitch-line)', strokeWidth: 2, opacity: 0.5 };
  return (
    <svg className="pitch-svg" viewBox={`0 0 ${w} ${h}`} role="group" aria-label={`Campo ${tactic}`}>
      <rect x={0} y={0} width={w} height={h} rx={10} fill="var(--pitch)" />
      <rect x={6} y={6} width={w - 12} height={h - 12} rx={6} {...line} />
      <line x1={6} y1={h / 2} x2={w - 6} y2={h / 2} {...line} />
      <circle cx={w / 2} cy={h / 2} r={36} {...line} />
      <rect x={w / 2 - 60} y={6} width={120} height={44} {...line} />
      <rect x={w / 2 - 60} y={h - 50} width={120} height={44} {...line} />
      {slots.map((s, i) => {
        const key = slotKey(s, i);
        const px = (s.x / 100) * (w - 30) + 15;
        const py = (s.y / 100) * (h - 30) + 15;
        const p = assign[key] ? players.get(assign[key]) : undefined;
        const label = p ? (p.number != null ? String(p.number) : p.name.slice(0, 2).toUpperCase()) : s.p.replace(/\d+$/, '');
        return (
          <g
            key={key}
            className="pitch-pos"
            role="button"
            tabIndex={0}
            aria-label={`${s.p}: ${p ? p.name : 'vacío'}`}
            onClick={() => onSlot(key, s.p)}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSlot(key, s.p)}
          >
            <circle cx={px} cy={py} r={18} fill={p ? 'var(--accent)' : 'var(--bg)'} stroke={p ? 'var(--accent-d)' : 'var(--text3)'} strokeWidth={2} />
            <text x={px} y={py + 4} textAnchor="middle" fontSize={11} fontWeight={700} fill={p ? 'var(--on-accent)' : 'var(--text2)'}>{label}</text>
            <text x={px} y={py + 31} textAnchor="middle" fontSize={9} fontWeight={600} fill="var(--text2)">
              {p ? p.name.split(' ')[0].slice(0, 12) : ''}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function GoalGrid({ selected, onSelect }: { selected: string; onSelect: (z: string) => void }) {
  const w = 180, h = 120;
  const cw = (w - 8) / 3, ch = (h - 8) / 3;
  return (
    <svg className="goal-svg" viewBox={`0 0 ${w} ${h}`} role="radiogroup" aria-label="Zona de portería">
      {GOAL_ZONES.map((z, i) => {
        const sel = z === selected;
        return (
          <rect
            key={z}
            className="cell"
            role="radio"
            aria-checked={sel}
            aria-label={z}
            tabIndex={0}
            x={4 + (i % 3) * cw}
            y={4 + Math.floor(i / 3) * ch}
            width={cw}
            height={ch}
            fill={sel ? 'var(--accent)' : 'var(--pitch)'}
            stroke="var(--text)"
            strokeWidth={1}
            onClick={() => onSelect(sel ? '' : z)}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect(sel ? '' : z)}
          />
        );
      })}
      <rect x={4} y={4} width={w - 8} height={h - 8} fill="none" stroke="var(--text)" strokeWidth={3} pointerEvents="none" />
    </svg>
  );
}
