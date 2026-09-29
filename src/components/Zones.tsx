import type { ZoneAnalysis } from '../lib/analytics';
import { ZONES, ZONE_H, ZONE_W, zoneCenter, zoneLabel } from '../lib/zones';

// Media pista con la portería atacada arriba. Se dibuja igual en el selector de goles y en los mapas
// de analíticas, y las zonas vienen de lib/zones.ts: la división es exactamente la misma en los dos sitios.

const PAD = 14; // margen superior para dibujar la portería

function HalfPitch() {
  const line = { fill: 'none', stroke: 'var(--pitch-line)', strokeWidth: 1.6 };
  return (
    <>
      <rect x={0} y={-PAD} width={ZONE_W} height={ZONE_H + PAD} rx={10} fill="var(--pitch)" />
      <rect x={152} y={-9} width={36} height={9} {...line} strokeWidth={2.2} />
      <line x1={0} y1={0} x2={ZONE_W} y2={0} {...line} />
      <rect x={69} y={0} width={202} height={83} {...line} />
      <rect x={124} y={0} width={92} height={28} {...line} />
      <circle cx={170} cy={55} r={2.4} fill="var(--pitch-line)" />
      <path d="M133.8 83 A45.75 45.75 0 0 0 206.2 83" {...line} />
      <line x1={0} y1={ZONE_H - 0.8} x2={ZONE_W} y2={ZONE_H - 0.8} {...line} strokeDasharray="5 5" />
    </>
  );
}

/** Selector táctil: toca la zona desde la que se produjo el gol. */
export function ZonePicker({ value, onChange, tone }: { value: string; onChange: (id: string) => void; tone: 'for' | 'against' }) {
  const color = tone === 'for' ? 'var(--series-for)' : 'var(--series-against)';
  return (
    <svg className="zone-map" viewBox={`0 ${-PAD} ${ZONE_W} ${ZONE_H + PAD}`} role="radiogroup" aria-label="Zona del campo desde la que se produjo el gol">
      <HalfPitch />
      {ZONES.map((z) => {
        const sel = z.id === value;
        const [cx, cy] = zoneCenter(z);
        return (
          <g
            key={z.id} role="radio" aria-checked={sel} aria-label={z.label} tabIndex={0} className="zcell"
            onClick={() => onChange(sel ? '' : z.id)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onChange(sel ? '' : z.id)}
          >
            <rect x={z.x + 1} y={z.y + 1} width={z.w - 2} height={z.h - 2} rx={6} fill={sel ? color : 'transparent'} fillOpacity={sel ? 0.85 : 1} stroke={sel ? color : 'var(--pitch-line)'} strokeWidth={sel ? 2.5 : 0.8} strokeDasharray={sel ? undefined : '3 3'} />
            <text x={cx} y={cy + 3.5} textAnchor="middle" fontSize={z.h < 40 ? 9 : 10.5} fontWeight={sel ? 800 : 600} fill={sel ? '#fff' : 'var(--text2)'} pointerEvents="none">{z.short}</text>
          </g>
        );
      })}
    </svg>
  );
}

/** Mapa de burbujas: el área de cada burbuja es proporcional al % de goles de la zona. */
export function ZoneBubbleMap({ analysis, tone, selected, onSelect }: { analysis: ZoneAnalysis; tone: 'for' | 'against'; selected: string | null; onSelect: (id: string | null) => void }) {
  const color = tone === 'for' ? 'var(--series-for)' : 'var(--series-against)';
  const K = 5.6; // radio = K·√%  → área proporcional al %: 40 % ≈ 35 px, 10 % ≈ 18 px
  const bubbles = ZONES.map((z) => ({ z, s: analysis.zones[z.id] }))
    .filter((x) => x.s.goals > 0)
    .map((x) => ({ ...x, r: Math.max(7, K * Math.sqrt(x.s.pct)) }))
    .sort((a, b) => b.r - a.r);
  return (
    <svg className="zone-map" viewBox={`0 ${-PAD} ${ZONE_W} ${ZONE_H + PAD}`} role="group" aria-label={tone === 'for' ? 'Mapa de goles realizados por zona' : 'Mapa de goles recibidos por zona'}>
      <HalfPitch />
      {ZONES.map((z) => {
        const sel = selected === z.id;
        const has = analysis.zones[z.id].goals > 0;
        return (
          <g key={z.id} className="zcell" role="button" tabIndex={0} aria-label={`${z.label}: ${analysis.zones[z.id].goals} goles`} onClick={() => onSelect(sel ? null : z.id)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect(sel ? null : z.id)}>
            <rect x={z.x + 1} y={z.y + 1} width={z.w - 2} height={z.h - 2} rx={6} fill={sel ? color : 'transparent'} fillOpacity={0.12} stroke={sel ? color : 'var(--pitch-line)'} strokeWidth={sel ? 2.5 : 0.8} strokeDasharray={sel ? undefined : '3 3'} />
            {!has && <text x={z.x + z.w / 2} y={z.y + z.h / 2 + 3} textAnchor="middle" fontSize={9.5} fill="var(--text3)" pointerEvents="none">{z.short}</text>}
          </g>
        );
      })}
      {bubbles.map(({ z, s, r }) => {
        // Si la burbuja no cabe en el lienzo se desplaza hacia dentro (nunca se encoge: el tamaño representa el %).
        const [zx, zy] = zoneCenter(z);
        const cx = Math.min(Math.max(zx, r + 3), ZONE_W - r - 3);
        const cy = Math.min(Math.max(zy, r + 3), ZONE_H - r - 3);
        const sel = selected === z.id;
        return (
          <g key={z.id} pointerEvents="none">
            <circle cx={cx} cy={cy} r={r} fill={color} fillOpacity={0.62} stroke={color} strokeWidth={sel ? 3 : 1.5} />
            {r >= 13 ? (
              <text x={cx} y={cy + 4} textAnchor="middle" fontSize={r >= 20 ? 13 : 10.5} fontWeight={800} fill="#fff" paintOrder="stroke" stroke="rgb(0 0 0 / .35)" strokeWidth={2.5}>
                {Math.round(s.pct)}%
              </text>
            ) : (
              <text x={cx} y={cy - r - 3} textAnchor="middle" fontSize={9.5} fontWeight={800} fill="var(--text)">{Math.round(s.pct)}%</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export { zoneLabel };
