import { useNavigate, useParams } from 'react-router';
import { Empty, playerTag, posBadge, Progress, TopBar } from '../components/bits';
import { SKILLS } from '../lib/constants';
import { ageYears, compareDateDesc, fmtDate } from '../lib/dates';
import { activeMatches, evalAverage, latestEvaluations, playerStats } from '../lib/stats';
import { useStore } from '../store/store';
import { confirmDialog, openSheet, toast } from '../store/ui';

export default function PlayerDetail() {
  const { id } = useParams();
  const data = useStore((s) => s.data);
  const upsert = useStore((s) => s.upsert);
  const remove = useStore((s) => s.remove);
  const nav = useNavigate();
  const p = data.players.find((x) => x.id === id);
  if (!p) return <div className="page"><TopBar back="Plantilla" backTo="/plantilla" /><Empty icon="🤷">Jugador no encontrado.</Empty></div>;

  const s = playerStats(data, p.id);
  const evals = latestEvaluations(data, p.id);
  const ev = evals[0];
  const age = ageYears(p.birth);
  const events = activeMatches(data)
    .flatMap((m) => [
      ...m.goals.filter((g) => g.pid === p.id).map((g) => ({ k: g.id, icon: '⚽', min: g.min, m, detail: g.gtype })),
      ...m.goals.filter((g) => g.apid === p.id).map((g) => ({ k: g.id + 'a', icon: '🅰️', min: g.min, m, detail: 'Asistencia' })),
      ...m.cards.filter((c) => c.pid === p.id).map((c) => ({ k: c.id, icon: c.type === 'Y' ? '🟨' : '🟥', min: c.min, m, detail: 'Tarjeta' })),
    ])
    .sort((a, b) => compareDateDesc(a.m, b.m));
  const avgMins = s.matches ? Math.round(s.mins / s.matches) : 0;

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
      <TopBar back="Plantilla" backTo="/plantilla" right={<button className="btn btn-g btn-sm" onClick={() => openSheet({ kind: 'player', id: p.id })}>✏️ Editar</button>} />
      <div className="page-inner">
        <div className="det-header">
          <div className="det-avatar">{playerTag(p)}</div>
          <div className="det-name">{p.name}</div>
          <div className="chips" style={{ justifyContent: 'center', marginTop: 8 }}>
            <span className={`badge ${posBadge[p.position]}`}>{p.position}</span>
            {age != null && <span className="badge b-gray">{age} años</span>}
            <span className="badge b-gray">Pie {p.foot === 'D' ? 'derecho' : p.foot === 'I' ? 'izquierdo' : 'ambidiestro'}</span>
            {s.motm > 0 && <span className="badge b-purple">⭐ MVP ×{s.motm}</span>}
            {p.archived_at && <span className="badge b-red">De baja</span>}
          </div>
        </div>
        <div className="stat-grid four">
          <div className="stat-box accent"><div className="sv">{s.goals}</div><div className="sl">Goles</div></div>
          <div className="stat-box blue"><div className="sv">{s.assists}</div><div className="sl">Asistencias</div></div>
          <div className="stat-box"><div className="sv">{s.matches}</div><div className="sl">Partidos ({s.starts} tit.)</div></div>
          <div className="stat-box gold"><div className="sv">{s.mins}'</div><div className="sl">Minutos</div></div>
          <div className="stat-box"><div className="sv">{avgMins}'</div><div className="sl">Media/partido</div></div>
          <div className="stat-box"><div className="sv">{s.cleanSheets}</div><div className="sl">P. a cero</div></div>
          <div className="stat-box gold"><div className="sv">{s.yellows}</div><div className="sl">Amarillas</div></div>
          <div className="stat-box red"><div className="sv">{s.reds}</div><div className="sl">Rojas</div></div>
        </div>
        <div className="card">
          <div className="between" style={{ marginBottom: 8 }}>
            <span className="small muted">Asistencia a entrenos</span>
            <span className="bold num">{s.trains}/{s.totalTrains} <span className="muted" style={{ fontWeight: 400 }}>({s.attPct}%)</span></span>
          </div>
          <Progress pct={s.attPct} tone={s.attPct >= 80 ? undefined : s.attPct >= 50 ? 'gold' : 'red'} />
        </div>

        <div className="sec-label">
          {ev ? `Última evaluación (${fmtDate(ev.date)})` : 'Evaluación'}
          <button className="btn btn-g btn-xs" onClick={() => openSheet({ kind: 'eval', playerId: p.id })}>+ Evaluar</button>
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

        {events.length > 0 && (
          <>
            <div className="sec-label">Participaciones</div>
            <div className="card flush" style={{ padding: '6px 0' }}>
              {events.slice(0, 15).map((e) => (
                <button key={e.k} className="ev-row" style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left' }} onClick={() => nav(`/partidos/${e.m.id}`)}>
                  <div className="ev-min">{e.min ?? '?'}'</div>
                  <span style={{ fontSize: 16 }} aria-hidden>{e.icon}</span>
                  <div><div className="small bold">vs {e.m.rival}</div><div className="xs muted">{fmtDate(e.m.date)} · {e.detail}</div></div>
                </button>
              ))}
            </div>
          </>
        )}

        <div style={{ display: 'flex', gap: 10, padding: '6px var(--pad) 0' }}>
          <button className="btn btn-g" style={{ flex: 1 }} onClick={toggleArchive}>{p.archived_at ? '↺ Reactivar' : '📦 Dar de baja'}</button>
          <button className="btn btn-danger" style={{ flex: 1 }} onClick={del}>🗑️ Eliminar</button>
        </div>
        <div className="spacer" />
      </div>
    </div>
  );
}
