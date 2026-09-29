import { Archive, Pencil, RotateCcw, Star, Trash2 } from 'lucide-react';
import { useNavigate, useParams } from 'react-router';
import { Empty, playerTag, posBadge, Progress, TopBar } from '../components/bits';
import { SKILLS } from '../lib/constants';
import { ageYears, compareDateDesc, fmtDate } from '../lib/dates';
import { evalAverage, latestEvaluations, playedMatches, playerStats } from '../lib/stats';
import { PunctualityCard } from '../components/PunctualityCard';
import { punctualityStats } from '../lib/punctuality';
import { useStore } from '../store/store';
import { confirmDialog, openSheet, toast } from '../store/ui';

export default function PlayerDetail() {
  const { id } = useParams();
  const data = useStore((s) => s.data);
  const upsert = useStore((s) => s.upsert);
  const remove = useStore((s) => s.remove);
  const nav = useNavigate();
  const p = data.players.find((x) => x.id === id);
  if (!p) return <div className="page"><TopBar back="Plantilla" backTo="/plantilla" /><Empty icon={Archive}>Jugador no encontrado.</Empty></div>;

  const s = playerStats(data, p.id);
  const evals = latestEvaluations(data, p.id);
  const ev = evals[0];
  const age = ageYears(p.birth);
  const played = playedMatches(data).sort(compareDateDesc);
  const history = played.flatMap((m) => {
    const e = m.lineup.find((x) => x.pid === p.id);
    const goals = m.goals.filter((g) => g.pid === p.id).length;
    const assists = m.goals.filter((g) => g.apid === p.id).length;
    const cards = m.cards.filter((c) => c.pid === p.id);
    return e || goals || assists || cards.length ? [{ m, e, goals, assists, cards }] : [];
  });

  const toggleArchive = async () => {
    if (!p.archived_at) {
      const ok = await confirmDialog({ title: 'Dar de baja', message: `${p.name} dejará de aparecer en convocatorias y alineaciones. Sus estadísticas se conservan y puedes reactivarlo cuando quieras.`, ok: 'Dar de baja' });
      if (!ok) return;
    }
    upsert('players', { ...p, archived_at: p.archived_at ? null : new Date().toISOString() });
    toast(p.archived_at ? 'Jugador reactivado ✓' : 'Jugador dado de baja');
  };
  const del = async () => {
    const ok = await confirmDialog({ title: 'Eliminar definitivamente', message: 'Se borrarán también sus evaluaciones y objetivos. En los partidos aparecerá como "—". No se puede deshacer.', ok: 'Eliminar', danger: true });
    if (!ok) return;
    remove('players', p.id);
    toast('Jugador eliminado');
    nav('/plantilla', { replace: true });
  };

  return (
    <div className="page">
      <TopBar back="Plantilla" backTo="/plantilla" right={<button className="btn btn-g btn-sm" onClick={() => openSheet({ kind: 'player', id: p.id })}><Pencil className="ico-sm" /> Editar</button>} />
      <div className="page-inner">
        <div className="det-header">
          <div className="det-avatar">{playerTag(p)}</div>
          <div className="det-name">{p.name}</div>
          <div className="chips" style={{ justifyContent: 'center', marginTop: 8 }}>
            <span className={`badge ${posBadge[p.position]}`}>{p.position}</span>
            {age != null && <span className="badge b-gray">{age} años</span>}
            <span className="badge b-gray">Pie {p.foot === 'D' ? 'derecho' : p.foot === 'I' ? 'izquierdo' : 'ambidiestro'}</span>
            {s.motm > 0 && <span className="badge b-blue"><Star className="ico-sm" /> MVP ×{s.motm}</span>}
            {p.archived_at && <span className="badge b-red">De baja</span>}
          </div>
        </div>

        <div className="stat-grid four">
          <div className="stat-box accent"><div className="sv">{s.mins}'</div><div className="sl">Minutos</div></div>
          <div className="stat-box"><div className="sv">{s.matches}</div><div className="sl">Partidos · {s.starts} tit.</div></div>
          <div className="stat-box"><div className="sv">{s.goals}</div><div className="sl">Goles</div></div>
          <div className="stat-box"><div className="sv">{s.assists}</div><div className="sl">Asistencias</div></div>
          <div className="stat-box"><div className="sv">{s.avgMins}'</div><div className="sl">Media / partido</div></div>
          <div className="stat-box"><div className="sv">{s.minsPct}%</div><div className="sl">De los minutos</div></div>
          <div className="stat-box gold"><div className="sv">{s.yellows}</div><div className="sl">Amarillas</div></div>
          <div className="stat-box red"><div className="sv">{s.reds}</div><div className="sl">Rojas</div></div>
        </div>

        <div className="card">
          <div className="between" style={{ marginBottom: 8 }}>
            <span className="small muted">Asistencia a entrenos</span>
            <span className="bold num">{s.trains}/{s.totalTrains} <span className="muted" style={{ fontWeight: 400 }}>({s.attPct}%)</span></span>
          </div>
          <Progress pct={s.attPct} tone={s.attPct >= 80 ? 'green' : s.attPct >= 50 ? 'gold' : 'red'} />
          <div className="between" style={{ marginTop: 12 }}>
            <span className="small muted">Convocatorias</span>
            <span className="bold num">{s.called}/{s.totalCallups}</span>
          </div>
        </div>

        <PunctualityCard s={punctualityStats(data, p.id)} />

        <div className="sec-label">
          {ev ? `Última evaluación (${fmtDate(ev.date)})` : 'Evaluación'}
          <button className="link" onClick={() => openSheet({ kind: 'eval', playerId: p.id })}>+ Evaluar</button>
        </div>
        {ev ? (
          <div className="card">
            {SKILLS.map((sk) => (
              <div className="skill-row" key={sk}>
                <span className="skill-lbl">{sk}</span>
                <div style={{ flex: 1 }}><Progress pct={(ev.skills[sk] ?? 0) * 10} /></div>
                <span className="skill-val">{ev.skills[sk] ?? '–'}</span>
              </div>
            ))}
            <div className="xs muted">Media {evalAverage(ev).toFixed(1)}/10 · {evals.length} evaluaciones</div>
            {ev.notes && <p className="small muted" style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>{ev.notes}</p>}
          </div>
        ) : <div className="card small muted">Aún sin evaluar.</div>}

        {history.length > 0 && (
          <>
            <div className="sec-label">Partidos</div>
            <div className="card flush">
              {history.slice(0, 15).map(({ m, e, goals, assists, cards }) => (
                <button key={m.id} className="row" onClick={() => nav(`/partidos/${m.id}`)}>
                  <div className="ri">
                    <div className="rn">vs {m.rival}</div>
                    <div className="rm">{fmtDate(m.date)} · {e ? `${e.role === 'TIT' ? 'Titular' : 'Suplente'} ${e.mins}'` : 'No jugó'}</div>
                  </div>
                  <div className="chips" style={{ flexShrink: 0 }}>
                    {goals > 0 && <span className="badge b-blue">⚽ {goals}</span>}
                    {assists > 0 && <span className="badge b-gray">🅰 {assists}</span>}
                    {cards.map((c) => <span key={c.id} aria-label={c.type === 'Y' ? 'Amarilla' : 'Roja'}>{c.type === 'Y' ? '🟨' : '🟥'}</span>)}
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        <div style={{ display: 'flex', gap: 10, padding: '6px var(--pad) 0' }}>
          <button className="btn btn-g" style={{ flex: 1 }} onClick={toggleArchive}>{p.archived_at ? <><RotateCcw className="ico-sm" /> Reactivar</> : <><Archive className="ico-sm" /> Dar de baja</>}</button>
          <button className="btn btn-danger" style={{ flex: 1 }} onClick={del}><Trash2 className="ico-sm" /> Eliminar</button>
        </div>
        <div className="spacer" />
      </div>
    </div>
  );
}
