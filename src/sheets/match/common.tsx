import { useEffect, useState } from 'react';
import type { Match, Player } from '../../lib/types';

export interface TabProps {
  draft: Match;
  /** Aplica un cambio al borrador (recalcula minutos si toca alineación, cambios, tarjetas o duración). */
  set: (patch: Partial<Match>) => void;
  roster: Player[];
  byId: Map<string, Player>;
  /** Ids de convocados (null si el partido no tiene convocatoria). */
  squad: string[] | null;
}

/** Input numérico que admite vacío (null). */
export function NumInput({ value, onChange, placeholder, label, className, min = 0, max = 999 }: {
  value: number | null; onChange: (v: number | null) => void; placeholder?: string; label: string; className?: string; min?: number; max?: number;
}) {
  const [text, setText] = useState(value == null ? '' : String(value));
  useEffect(() => setText(value == null ? '' : String(value)), [value]);
  return (
    <input
      className={className} type="number" inputMode="numeric" min={min} max={max} placeholder={placeholder} aria-label={label} value={text}
      onChange={(e) => {
        setText(e.target.value);
        const n = e.target.value.trim() === '' ? null : Math.max(min, Math.min(max, Math.round(Number(e.target.value)) || 0));
        onChange(n);
      }}
    />
  );
}

export const playerLabel = (p: Player) => `${p.number != null ? `${p.number}. ` : ''}${p.name}`;
