import { Plus, Star, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router';
import { Empty, Progress, TopBar } from '../components/bits';
import { SKILLS } from '../lib/constants';
import { compareDateDesc, fmtDate } from '../lib/dates';
import { evalAverage, sortPlayers } from '../lib/stats';
import { useStore } from '../store/store';
import { confirmDialog, openSheet, toast } from '../store/ui';

export default function Evaluations() {
  const data = useStore((s) => s.data);
  const remove = useStore((s) => s.remove);
  const nav = useNavigate();
  const byPlayer = sortPlayers(data.players)
    .map((p) => ({ p, evs: data.evaluations.filter((e) => e.player_id === p.id).sort(compareDateDesc) }))
    .filter((x) => x.evs.length);
  const del = async (id: string) => {
    if (await confirmDialog({ title: '¿Eliminar evaluación?', ok: 'Eliminar', danger: true })) {
      remove('evaluations', id);
      toast('Evaluación eliminada');
    }
  };
  return (
    <div className="page">
      <TopBar back="Inicio" backTo="/" title="Evaluaciones" right={<button className="btn btn-p btn-sm" onClick={() => openSheet({ kind: 'eval' })}><Plus className="ico-sm" /> Evaluar</button>} />
      <div className="page-inner">
        {!byPlayer.length ? <Empty icon={Star}>No hay evaluaciones.<br />Pulsa Evaluar para empezar.</Empty> : byPlayer.map(({ p, evs }) => {
          const latest = evs[0];
          const avg = evalAverage(latest);
          const diff = evs[1] ? avg - evalAverage(evs[1]) : null;
          return (
            <div key={p.id}>
              <div className="sec-label"><button className="link" onClick={() => nav(`/plantilla/${p.id}`)}>{p.name}</button></div>
              <div className="card">
                <div className="between xs muted" style={{ marginBottom: 10 }}>
                  <span>
                    {fmtDate(latest.date)} · Media <b className="num">{avg.toFixed(1)}</b>/10{' '}
                    {diff != null && (diff > 0.05 ? <span style={{ color: 'var(--win)' }}>▲ +{diff.toFixed(1)}</span> : diff < -0.05 ? <span style={{ color: 'var(--loss)' }}>▼ {diff.toFixed(1)}</span> : <span>= sin cambios</span>)}
                  </span>
                  <button className="icon-btn" aria-label="Eliminar última evaluación" onClick={() => void del(latest.id)}><Trash2 className="ico" /></button>
                </div>
                {SKILLS.map((sk) => (
                  <div className="skill-row" key={sk}>
                    <span className="skill-lbl">{sk}</span>
                    <div style={{ flex: 1 }}><Progress pct={(latest.skills[sk] ?? 0) * 10} /></div>
                    <span className="skill-val">{latest.skills[sk] ?? '–'}</span>
                  </div>
                ))}
                {latest.notes && <p className="small muted" style={{ whiteSpace: 'pre-wrap' }}>{latest.notes}</p>}
                {evs.length > 1 && <div className="xs muted" style={{ marginTop: 8 }}>{evs.length} evaluaciones · evolución: {evs.slice(0, 6).reverse().map((e) => evalAverage(e).toFixed(1)).join(' → ')}</div>}
              </div>
            </div>
          );
        })}
        <div className="spacer" />
      </div>
    </div>
  );
}
