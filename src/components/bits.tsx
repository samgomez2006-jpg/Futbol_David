import { ChevronLeft } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { resultOf } from '../lib/stats';
import type { Match, Player, Position, Result } from '../lib/types';

export const posBadge: Record<Position, string> = {
  Portero: 'b-gold', Defensa: 'b-blue', Centrocampista: 'b-green', Delantero: 'b-red',
};
export const posShort: Record<Position, string> = { Portero: 'POR', Defensa: 'DEF', Centrocampista: 'MED', Delantero: 'DEL' };
export const resultColor: Record<Result, string> = { V: 'var(--win)', E: 'var(--draw)', D: 'var(--loss)' };

export function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}
export const playerTag = (p: Player) => (p.number != null ? String(p.number) : initials(p.name));

export function ResultBadge({ m }: { m: Pick<Match, 'gf' | 'ga'> }) {
  const r = resultOf(m);
  const [cls, txt] = r === 'V' ? ['b-green', 'Victoria'] : r === 'E' ? ['b-gold', 'Empate'] : ['b-red', 'Derrota'];
  return <span className={`badge ${cls}`}>{txt}</span>;
}

export function FormStrip({ form }: { form: Result[] }) {
  return (
    <div className="form-strip" aria-label={`Últimos resultados: ${form.join(' ')}`}>
      {[...form].reverse().map((r, i) => <span key={i} className={`form-dot ${r}`}>{r === 'V' ? 'G' : r === 'E' ? 'E' : 'P'}</span>)}
    </div>
  );
}

export function Empty({ icon: Icon, children, action }: { icon: LucideIcon; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-ico" aria-hidden><Icon className="ico-lg" /></div>
      <p>{children}</p>
      {action}
    </div>
  );
}

export function IconBadge({ icon: Icon }: { icon: LucideIcon }) {
  return <span className="ico-badge" aria-hidden><Icon className="ico" /></span>;
}

export function Progress({ pct, tone }: { pct: number; tone?: 'blue' | 'gold' | 'red' | 'green' }) {
  return (
    <div className="prog-wrap" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
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
              <ChevronLeft className="ico" /> {back}
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

/** Texto con etiqueta; no se pinta si está vacío (para fichas de solo lectura). */
export function TextBlock({ label, value }: { label: string; value: string }) {
  if (!value.trim()) return null;
  return (
    <div className="text-block">
      <h4>{label}</h4>
      <p className="prose">{value}</p>
    </div>
  );
}
