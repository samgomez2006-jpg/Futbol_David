import { Minus, Plus, Target, X } from 'lucide-react';
import { Empty, Progress, TopBar } from '../components/bits';
import { OBJECTIVE_LABELS } from '../lib/constants';
import { objectiveProgress } from '../lib/stats';
import { useStore } from '../store/store';
import { confirmDialog, openSheet, toast } from '../store/ui';

export default function Objectives() {
  const data = useStore((s) => s.data);
  const upsert = useStore((s) => s.upsert);
  const remove = useStore((s) => s.remove);
  const del = async (id: string) => {
    if (await confirmDialog({ title: '¿Eliminar objetivo?', ok: 'Eliminar', danger: true })) {
      remove('objectives', id);
      toast('Objetivo eliminado');
    }
  };
  return (
    <div className="page">
      <TopBar back="Inicio" backTo="/" title="Objetivos" right={<button className="btn btn-p btn-sm" onClick={() => openSheet({ kind: 'objective' })}><Plus className="ico-sm" /> Objetivo</button>} />
      <div className="page-inner" style={{ paddingTop: 12 }}>
        {!data.objectives.length ? <Empty icon={Target} action={<button className="btn btn-p" onClick={() => openSheet({ kind: 'objective' })}>Crear objetivo</button>}>No hay objetivos definidos.</Empty> : data.objectives.map((o) => {
          const pr = objectiveProgress(data, o);
          const p = o.player_id ? data.players.find((x) => x.id === o.player_id) : null;
          return (
            <div className="card" key={o.id}>
              <div className="between" style={{ alignItems: 'flex-start' }}>
                <div>
                  <div className="bold">{o.title}</div>
                  <div className="xs muted">{o.scope === 'team' ? 'Equipo' : p?.name ?? 'Jugador'} · {OBJECTIVE_LABELS[o.category]}</div>
                </div>
                <div className="row-flex">
                  {pr.done && <span className="badge b-green">✓ Cumplido</span>}
                  <button className="icon-btn" onClick={() => void del(o.id)} aria-label="Eliminar objetivo"><X className="ico" /></button>
                </div>
              </div>
              <div style={{ margin: '10px 0 6px' }}><Progress pct={pr.pct} tone={pr.done ? 'green' : undefined} /></div>
              <div className="between small">
                <span className="muted num">{pr.current} / {o.target}</span>
                {o.category === 'custom' ? (
                  <span className="row-flex">
                    <button className="btn btn-g btn-xs" aria-label="Restar" onClick={() => upsert('objectives', { ...o, current: Math.max(0, o.current - 1) })}><Minus className="ico-sm" /></button>
                    <button className="btn btn-g btn-xs" aria-label="Sumar" onClick={() => upsert('objectives', { ...o, current: o.current + 1 })}><Plus className="ico-sm" /></button>
                  </span>
                ) : <span className="bold num" style={{ color: pr.done ? 'var(--win)' : 'var(--text)' }}>{pr.pct}%</span>}
              </div>
            </div>
          );
        })}
        <div className="spacer" />
      </div>
    </div>
  );
}
