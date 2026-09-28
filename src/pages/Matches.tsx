import { useNavigate } from 'react-router';
import { Empty, ResultBadge, resultColor, TopBar } from '../components/bits';
import { TRASH_DAYS } from '../lib/constants';
import { compareDateDesc, fmtDate } from '../lib/dates';
import { activeMatches, resultOf, teamSummary, trashedMatches } from '../lib/stats';
import { useStore } from '../store/store';
import { confirmDialog, openSheet, toast } from '../store/ui';

const daysLeft = (deletedAt: string) => Math.max(0, TRASH_DAYS - Math.floor((Date.now() - Date.parse(deletedAt)) / 864e5));

export default function Matches({ trash = false }: { trash?: boolean }) {
  const data = useStore((s) => s.data);
  const upsert = useStore((s) => s.upsert);
  const remove = useStore((s) => s.remove);
  const nav = useNavigate();
  const active = [...activeMatches(data)].sort(compareDateDesc);
  const trashed = [...trashedMatches(data)].sort((a, b) => Date.parse(b.deleted_at!) - Date.parse(a.deleted_at!));
  const sum = teamSummary(active);

  const restore = (id: string) => {
    const m = data.matches.find((x) => x.id === id)!;
    upsert('matches', { ...m, deleted_at: null });
    toast('Partido restaurado ✓');
  };
  const purge = async (id: string) => {
    if (!(await confirmDialog({ title: 'Eliminar definitivamente', message: 'Esta acción no se puede deshacer.', ok: 'Eliminar', danger: true }))) return;
    remove('matches', id);
    toast('Partido eliminado');
  };

  return (
    <div className="page">
      <TopBar
        title="Partidos"
        subtitle={trash ? `${trashed.length} en papelera` : `${active.length} partidos · ${sum.w}V ${sum.dr}E ${sum.l}D`}
        right={<button className="btn btn-p btn-sm" onClick={() => openSheet({ kind: 'match' })}>+ Partido</button>}
      />
      <div className="page-inner">
        <div className="tabs" style={{ marginBottom: 12 }}>
          <button className={`tab ${!trash ? 'active' : ''}`} onClick={() => nav('/partidos', { replace: true })}>Lista</button>
          <button className={`tab ${trash ? 'active' : ''}`} onClick={() => nav('/partidos/papelera', { replace: true })}>🗑 Papelera{trashed.length ? ` (${trashed.length})` : ''}</button>
        </div>
        {trash ? (
          !trashed.length ? <Empty icon="🗑️">La papelera está vacía.<br />Los partidos borrados se guardan {TRASH_DAYS} días.</Empty> : (
            <div className="card flush">
              {trashed.map((m) => (
                <div key={m.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <div className="row" style={{ borderBottom: 'none', opacity: 0.75 }}>
                    <div className="avatar score num">{m.gf}-{m.ga}</div>
                    <div className="ri"><div className="rn">vs {m.rival}</div><div className="rm">{fmtDate(m.date)} · se elimina en {daysLeft(m.deleted_at!)} días</div></div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, padding: '0 var(--pad) 12px' }}>
                    <button className="btn btn-g btn-xs" style={{ flex: 1 }} onClick={() => restore(m.id)}>↺ Restaurar</button>
                    <button className="btn btn-danger btn-xs" style={{ flex: 1 }} onClick={() => purge(m.id)}>Eliminar ya</button>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : !active.length ? (
          <Empty icon="🏟️" action={<button className="btn btn-p" onClick={() => openSheet({ kind: 'match' })}>Registrar partido</button>}>No hay partidos registrados.</Empty>
        ) : (
          <div className="card flush">
            {active.map((m) => (
              <button key={m.id} className="row" onClick={() => nav(`/partidos/${m.id}`)}>
                <div className="avatar score num" style={{ color: resultColor[resultOf(m)] }}>{m.gf}-{m.ga}</div>
                <div className="ri"><div className="rn">vs {m.rival}</div><div className="rm">{fmtDate(m.date)} · {m.venue === 'L' ? 'Local' : 'Visitante'} · {m.tactic || '—'}</div></div>
                <ResultBadge m={m} />
              </button>
            ))}
          </div>
        )}
        <div className="spacer" />
      </div>
    </div>
  );
}
