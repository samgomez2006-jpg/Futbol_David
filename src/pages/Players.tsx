import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Empty, playerTag, posBadge, TopBar } from '../components/bits';
import { ageYears } from '../lib/dates';
import { playerStats, sortPlayers } from '../lib/stats';
import { useStore } from '../store/store';
import { openSheet } from '../store/ui';

export default function Players() {
  const data = useStore((s) => s.data);
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const active = data.players.filter((p) => !p.archived_at);
  const archived = data.players.filter((p) => p.archived_at);
  const list = sortPlayers(showArchived ? archived : active).filter((p) => !q || p.name.toLowerCase().includes(q.toLowerCase()) || String(p.number ?? '') === q);

  return (
    <div className="page">
      <TopBar title="Plantilla" subtitle={`${active.length} jugadores`} right={<button className="btn btn-p btn-sm" onClick={() => openSheet({ kind: 'player' })}>+ Jugador</button>} />
      <div className="page-inner">
        {data.players.length > 0 && (
          <div style={{ padding: '12px var(--pad) 10px' }}>
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre o dorsal" aria-label="Buscar jugador" />
          </div>
        )}
        {archived.length > 0 && (
          <div className="tabs" style={{ paddingTop: 0, marginBottom: 10 }}>
            <button className={`tab ${!showArchived ? 'active' : ''}`} onClick={() => setShowArchived(false)}>En plantilla ({active.length})</button>
            <button className={`tab ${showArchived ? 'active' : ''}`} onClick={() => setShowArchived(true)}>De baja ({archived.length})</button>
          </div>
        )}
        {!data.players.length ? (
          <Empty icon="👥" action={<button className="btn btn-p" onClick={() => openSheet({ kind: 'player' })}>Añadir jugador</button>}>
            No hay jugadores todavía.
          </Empty>
        ) : !list.length ? (
          <Empty icon="🔍">Ningún jugador coincide.</Empty>
        ) : (
          <div className="card flush">
            {list.map((p) => {
              const s = playerStats(data, p.id);
              const age = ageYears(p.birth);
              return (
                <button key={p.id} className="row" onClick={() => nav(`/plantilla/${p.id}`)}>
                  <div className="avatar">{playerTag(p)}</div>
                  <div className="ri">
                    <div className="rn">{p.name}</div>
                    <div className="rm"><span className={`badge ${posBadge[p.position]}`} style={{ fontSize: 10 }}>{p.position}</span>{age != null && <span>{age} años</span>}</div>
                  </div>
                  <div className="mini-stats">
                    <div><b>{s.goals}</b><span>GOL</span></div>
                    <div><b>{s.assists}</b><span>ASI</span></div>
                    <div><b>{s.matches}</b><span>PJ</span></div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
        <div className="spacer" />
      </div>
    </div>
  );
}
