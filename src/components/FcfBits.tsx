import { ExternalLink, RefreshCw } from 'lucide-react';
import type { Res } from '../lib/fcf/analysis';
import { FCF_WEB } from '../lib/fcf/types';

export const SrcFcf = () => <span className="src fcf" title="Dato oficial descargado de la Federació Catalana de Futbol">FCF</span>;
export const SrcManual = () => <span className="src man" title="Dato registrado por el entrenador">Manual</span>;
export const NA = ({ children = 'No disponible' }: { children?: string }) => <span className="na">{children}</span>;

const when = (iso: string) => {
  const d = new Date(iso);
  return `${d.toLocaleDateString('es', { day: '2-digit', month: '2-digit' })} ${d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}`;
};

/** Origen de los datos + actualizar + enlace a la web oficial. Siempre visible en pantallas con datos FCF. */
export function FcfSourceBar({ fetchedAt, loading, onRefresh }: { fetchedAt: string | null; loading: boolean; onRefresh?: () => void }) {
  return (
    <div className="card" style={{ padding: '10px 12px' }}>
      <div className="between" style={{ gap: 8, flexWrap: 'wrap' }}>
        <span className="xs muted" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <SrcFcf /> Fuente: Federació Catalana de Futbol{fetchedAt ? ` · ${when(fetchedAt)}` : ''}
        </span>
        <span className="row-flex" style={{ gap: 6, flexWrap: 'wrap' }}>
          {onRefresh && <button className="btn btn-g btn-xs" disabled={loading} onClick={onRefresh}><RefreshCw className="ico-sm" /> {loading ? 'Actualizando…' : 'Actualizar datos FCF'}</button>}
          <a className="btn btn-g btn-xs" href={FCF_WEB} target="_blank" rel="noreferrer"><ExternalLink className="ico-sm" /> Ver competición en FCF</a>
        </span>
      </div>
    </div>
  );
}

const COL: Record<Res, string> = { V: 'var(--win)', E: 'var(--text3)', D: 'var(--loss)' };
const TXT: Record<Res, string> = { V: 'G', E: 'E', D: 'P' };
export function FormDots({ res }: { res: Res[] }) {
  return (
    <span className="form-dots" aria-label={`Últimos resultados: ${res.map((r) => ({ V: 'victoria', E: 'empate', D: 'derrota' })[r]).join(', ')}`}>
      {res.map((r, i) => <span key={i} style={{ background: COL[r] }}>{TXT[r]}</span>)}
    </span>
  );
}
