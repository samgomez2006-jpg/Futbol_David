import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { resultOf } from '../lib/stats';
import type { Match, Player, Position, Result } from '../lib/types';

export const posBadge: Record<Position, string> = {
  Portero: 'b-gold', Defensa: 'b-blue', Centrocampista: 'b-green', Delantero: 'b-red',
};
export const resultColor: Record<Result, string> = { V: 'var(--accent)', E: 'var(--gold)', D: 'var(--red)' };

export function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}
export const playerTag = (p: Player) => (p.number != null ? String(p.number) : initials(p.name));

export function ResultBadge({ m }: { m: Pick<Match, 'gf' | 'ga'> }) {
  const r = resultOf(m);
  const [cls, txt] = r === 'V' ? ['b-green', 'Victoria'] : r === 'E' ? ['b-gold', 'Empate'] : ['b-red', 'Derrota'];
  return <span className={`badge ${cls}`}>{txt}</span>;
}

export function Empty({ icon, children, action }: { icon: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-ico" aria-hidden>{icon}</div>
      <p>{children}</p>
      {action}
    </div>
  );
}

export function Progress({ pct, tone }: { pct: number; tone?: 'blue' | 'gold' | 'red' }) {
  return (
    <div className="prog-wrap" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className={`prog ${tone ?? ''}`} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </div>
  );
}

/** Texto con **negritas** sin usar innerHTML. */
export function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split('**').map((part, i) => (i % 2 ? <strong key={i}>{part}</strong> : <span key={i}>{part}</span>))}
    </>
  );
}

export function TopBar({ title, subtitle, back, backTo = '/', right }: { title?: ReactNode; subtitle?: ReactNode; back?: string; backTo?: string; right?: ReactNode }) {
  const nav = useNavigate();
  const loc = useLocation();
  return (
    <header className="topbar">
      <div className="topbar-row">
        <div>
          {back && (
            <button className="back-btn" onClick={() => (loc.key !== 'default' ? nav(-1) : nav(backTo, { replace: true }))}>
              ← {back}
            </button>
          )}
          {title && <h1>{title}</h1>}
          {subtitle && <p>{subtitle}</p>}
        </div>
        {right}
      </div>
    </header>
  );
}
