// Gráficos sencillos compartidos (SVG/CSS, sin librerías). Colores de serie: --series-for / --series-against.

/** Barras dobles (a favor / en contra). Marcas finas, etiqueta solo con valor > 0. */
export function PairBars({ items, aLabel = 'A favor', bLabel = 'En contra' }: { items: { label: string; a: number; b: number }[]; aLabel?: string; bLabel?: string }) {
  const max = Math.max(1, ...items.flatMap((i) => [i.a, i.b]));
  const cols = { gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` };
  return (
    <>
      <div className="bars2" style={cols}>
        {items.map((it) => (
          <div className="bar-col" key={it.label} role="img" aria-label={`${it.label}: ${it.a} ${aLabel.toLowerCase()}, ${it.b} ${bLabel.toLowerCase()}`}>
            <div className="bar">{it.a > 0 && <b>{it.a}</b>}<i style={{ height: `${(it.a / max) * 78}%`, background: 'var(--series-for)' }} /></div>
            <div className="bar">{it.b > 0 && <b>{it.b}</b>}<i style={{ height: `${(it.b / max) * 78}%`, background: 'var(--series-against)' }} /></div>
          </div>
        ))}
      </div>
      <div className="bars-x" style={cols}>{items.map((i) => <span key={i.label}>{i.label}</span>)}</div>
      <div className="legend">
        <span><i className="swatch" style={{ background: 'var(--series-for)' }} />{aLabel}</span>
        <span><i className="swatch" style={{ background: 'var(--series-against)' }} />{bLabel}</span>
      </div>
    </>
  );
}


export interface LineSeries {
  label: string;
  color: string;
  points: { x: number; y: number }[];
}

/** Evolución de la posición en la tabla (1 arriba). */
export function PositionChart({ series, maxPos, label }: { series: LineSeries[]; maxPos: number; label: string }) {
  const W = 320;
  const H = 150;
  const L = 24;
  const B = 18;
  const xs = series.flatMap((s) => s.points.map((p) => p.x));
  if (!xs.length) return null;
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const X = (x: number) => L + (x1 === x0 ? (W - L - 8) / 2 : ((x - x0) / (x1 - x0)) * (W - L - 8));
  const Y = (p: number) => 8 + ((p - 1) / Math.max(1, maxPos - 1)) * (H - B - 16);
  const ticks = [1, Math.ceil(maxPos / 2), maxPos].filter((v, i, a) => a.indexOf(v) === i);
  const step = Math.max(1, Math.ceil((x1 - x0 + 1) / 8));
  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block' }} role="img" aria-label={label}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - 4} y1={Y(t)} y2={Y(t)} stroke="var(--border)" strokeWidth={1} />
            <text x={L - 5} y={Y(t) + 3.5} textAnchor="end" fontSize={9.5} fill="var(--text3)">{t}º</text>
          </g>
        ))}
        {Array.from({ length: x1 - x0 + 1 }, (_, i) => x0 + i).filter((x) => (x - x0) % step === 0).map((x) => (
          <text key={x} x={X(x)} y={H - 4} textAnchor="middle" fontSize={9} fill="var(--text3)">J{x}</text>
        ))}
        {series.map((s) => (
          <g key={s.label}>
            <polyline fill="none" stroke={s.color} strokeWidth={2.2} strokeLinejoin="round" points={s.points.map((p) => `${X(p.x)},${Y(p.y)}`).join(' ')} />
            {s.points.map((p) => <circle key={p.x} cx={X(p.x)} cy={Y(p.y)} r={2.6} fill={s.color} />)}
          </g>
        ))}
      </svg>
      {series.length > 1 && (
        <div className="legend">{series.map((s) => <span key={s.label}><i className="swatch" style={{ background: s.color }} />{s.label}</span>)}</div>
      )}
    </>
  );
}

/** Comparación de un indicador entre dos equipos (barras horizontales enfrentadas). */
export function CompareRow({ label, a, b, fmt = (v: number) => String(v), lowerIsBetter }: { label: string; a: number; b: number; fmt?: (v: number) => string; lowerIsBetter?: boolean }) {
  const max = Math.max(a, b, 0.0001);
  const better = a === b ? 0 : (a > b) !== !!lowerIsBetter ? -1 : 1;
  return (
    <div className="cmp-row" role="img" aria-label={`${label}: ${fmt(a)} frente a ${fmt(b)}`}>
      <b className={`num ${better === -1 ? 'hi' : ''}`}>{fmt(a)}</b>
      <div className="cmp-bar l"><i style={{ width: `${(a / max) * 100}%`, background: 'var(--series-for)' }} /></div>
      <span className="cmp-lbl">{label}</span>
      <div className="cmp-bar"><i style={{ width: `${(b / max) * 100}%`, background: 'var(--series-against)' }} /></div>
      <b className={`num ${better === 1 ? 'hi' : ''}`}>{fmt(b)}</b>
    </div>
  );
}
