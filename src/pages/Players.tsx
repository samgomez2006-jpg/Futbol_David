import { Plus, Search, Users } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ExportButton } from '../components/ExportButton';
import { Empty, playerTag, posBadge, TopBar } from '../components/bits';
import { ageYears } from '../lib/dates';
import { playerStats, sortPlayers } from '../lib/stats';
import { useStore } from '../store/store';
import { openSheet } from '../store/ui';

type Sort = 'num' | 'mins' | 'goals';

export default function Players() {
  const data = useStore((s) => s.data);
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<Sort>('num');
  const [showArchived, setShowArchived] = useState(false);
  const active = data.players.filter((p) => !p.archived_at);
  const archived = data.players.filter((p) => p.archived_at);

  const rows = (showArchived ? archived : active)
    .map((p) => ({ p, s: playerStats(data, p.id) }))
    .filter(({ p }) => !q || p.name.toLowerCase().includes(q.toLowerCase()) || String(p.number ?? '') === q);
  const order = new Map(sortPlayers(rows.map((r) => r.p)).map((p, i) => [p.id, i]));
  rows.sort((a, b) => (sort === 'mins' ? b.s.mins - a.s.mins : sort === 'goals' ? b.s.goals - a.s.goals || b.s.assists - a.s.assists : 0) || order.get(a.p.id)! - order.get(b.p.id)!);
  const totalMins = active.reduce((a, p) => a + playerStats(data, p.id).mins, 0);

  return (
    <div className="page">
      <TopBar title="Plantilla" subtitle={`${active.length} jugadores${totalMins ? ` · ${totalMins.toLocaleString('es')} min jugados` : ''}`} right={<div className="row-flex"><ExportButton scope="plantilla" label="" title="Exportar plantilla" /><button className="btn btn-p btn-sm" onClick={() => openSheet({ kind: 'player' })}><Plus className="ico-sm" /> Jugador</button></div>} />
      <div className="page-inner">
        {data.players.length > 0 && (
          <>
            <div style={{ padding: '12px var(--pad) 8px', position: 'relative' }}>
              <Search className="ico" style={{ position: 'absolute', left: 30, top: 27, color: 'var(--text3)' }} />
              <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre o dorsal" aria-label="Buscar jugador" style={{ paddingLeft: 40 }} />
            </div>
            <div className="tabs" style={{ paddingTop: 0, marginBottom: 8 }}>
              {([['num', 'Dorsal'], ['mins', 'Minutos'], ['goals', 'Goles']] as [Sort, string][]).map(([k, l]) => (
                <button key={k} className={`tab ${sort === k ? 'active' : ''}`} onClick={() => setSort(k)}>{l}</button>
              ))}
              {archived.length > 0 && <button className={`tab ${showArchived ? 'active' : ''}`} onClick={() => setShowArchived(!showArchived)}>De baja ({archived.length})</button>}
            </div>
          </>
        )}
        {!data.players.length ? (
          <Empty icon={Users} action={<button className="btn btn-p" onClick={() => openSheet({ kind: 'player' })}>Añadir jugador</button>}>No hay jugadores todavía.</Empty>
        ) : !rows.length ? (
          <Empty icon={Search}>Ningún jugador coincide.</Empty>
        ) : (
          <div className="card flush">
            {rows.map(({ p, s }) => {
              const age = ageYears(p.birth);
              return (
                <button key={p.id} className="row" onClick={() => nav(`/plantilla/${p.id}`)}>
                  <div className="avatar">{playerTag(p)}</div>
                  <div className="ri">
                    <div className="rn">{p.name}</div>
                    <div className="rm"><span className={`badge ${posBadge[p.position]}`} style={{ fontSize: 10 }}>{p.position}</span>{age != null && <span>{age} años</span>}</div>
                  </div>
                  <div className="mini-stats" aria-label={`${s.mins} minutos, ${s.goals} goles, ${s.assists} asistencias, ${s.matches} partidos`}>
                    <div className="hi"><b>{s.mins}</b><span>MIN</span></div>
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
