import { useNavigate } from 'react-router';
import { Empty, Progress, TopBar } from '../components/bits';
import { OBJECTIVE_LABELS, SKILLS, slotLabel } from '../lib/constants';
import { compareDateDesc, fmtDate, fmtDateLong } from '../lib/dates';
import { shareText } from '../lib/platform';
import { activeMatches, activePlayers, evalAverage, objectiveProgress, playerStats, sortPlayers } from '../lib/stats';
import { useStore } from '../store/store';
import { confirmDialog, openSheet, toast } from '../store/ui';
import { ResultBadge } from '../components/bits';

export function TacticalHub() {
  const data = useStore((s) => s.data);
  const nav = useNavigate();
  const tools: [string, string, string, () => void][] = [
    ['⭐', 'Evaluaciones', 'Habilidades individuales', () => nav('/tactico/evaluaciones')],
    ['🎯', 'Objetivos', 'Metas de equipo y jugadores', () => nav('/tactico/objetivos')],
    ['📝', 'Convocatorias', 'Citar y compartir', () => nav('/tactico/convocatorias')],
    ['🧩', 'Alineaciones', 'Histórico de onces', () => nav('/tactico/alineaciones')],
    ['📋', 'Entrenamientos', 'Pasar lista', () => openSheet({ kind: 'training' })],
    ['📈', 'Asistencia', 'Resumen y registro', () => nav('/tactico/asistencia')],
  ];
  return (
    <div className="page">
      <TopBar title="Táctico" subtitle="Evaluaciones, objetivos y convocatorias" />
      <div className="page-inner">
        <div className="stat-grid four">
          <div className="stat-box accent"><div className="sv">{data.evaluations.length}</div><div className="sl">Evaluaciones</div></div>
          <div className="stat-box"><div className="sv">{data.objectives.length}</div><div className="sl">Objetivos</div></div>
          <div className="stat-box"><div className="sv">{data.trainings.length}</div><div className="sl">Entrenos</div></div>
          <div className="stat-box"><div className="sv">{activePlayers(data).length}</div><div className="sl">Jugadores</div></div>
        </div>
        <div className="sec-label">Herramientas</div>
        <div className="qa-grid three">
          {tools.map(([ico, l, sub, fn]) => (
            <button key={l} className="qa-btn" onClick={fn}><span className="qa-ico">{ico}</span><span className="qa-lbl">{l}</span><span className="qa-sub">{sub}</span></button>
          ))}
        </div>
        <div className="sec-label">Objetivos activos</div>
        {!data.objectives.length ? <div className="card small muted">No hay objetivos definidos.</div> : data.objectives.slice(0, 4).map((o) => {
          const pr = objectiveProgress(data, o);
          return (
            <div className="card" key={o.id}>
              <div className="between"><span className="bold small">{o.title}</span>{pr.done && <span className="badge b-green">✓ Cumplido</span>}</div>
              <div style={{ margin: '8px 0 4px' }}><Progress pct={pr.pct} tone={pr.done ? undefined : 'blue'} /></div>
              <div className="xs muted num">{pr.current} / {o.target} · {pr.pct}%</div>
            </div>
          );
        })}
        <div className="spacer" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
export function Evaluations() {
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
      <TopBar back="Táctico" backTo="/tactico" title="Evaluaciones" right={<button className="btn btn-p btn-sm" onClick={() => openSheet({ kind: 'eval' })}>+ Evaluar</button>} />
      <div className="page-inner">
        {!byPlayer.length ? <Empty icon="⭐">No hay evaluaciones.<br />Pulsa Evaluar para empezar.</Empty> : byPlayer.map(({ p, evs }) => {
          const latest = evs[0];
          const avg = evalAverage(latest);
          const diff = evs[1] ? avg - evalAverage(evs[1]) : null;
          return (
            <div key={p.id}>
              <div className="sec-label"><button className="back-btn" style={{ padding: 0, minHeight: 0, fontSize: 12 }} onClick={() => nav(`/plantilla/${p.id}`)}>{p.name}</button></div>
              <div className="card">
                <div className="between xs muted" style={{ marginBottom: 10 }}>
                  <span>
                    {fmtDate(latest.date)} · Media <b className="num">{avg.toFixed(1)}</b>/10{' '}
                    {diff != null && (diff > 0 ? <span style={{ color: 'var(--accent)' }}>▲ +{diff.toFixed(1)}</span> : diff < 0 ? <span style={{ color: 'var(--red)' }}>▼ {diff.toFixed(1)}</span> : <span>= sin cambios</span>)}
                  </span>
                  <button className="icon-btn" aria-label="Eliminar última evaluación" onClick={() => del(latest.id)}>🗑</button>
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

// ---------------------------------------------------------------------------
export function Objectives() {
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
      <TopBar back="Táctico" backTo="/tactico" title="Objetivos" right={<button className="btn btn-p btn-sm" onClick={() => openSheet({ kind: 'objective' })}>+ Objetivo</button>} />
      <div className="page-inner" style={{ paddingTop: 12 }}>
        {!data.objectives.length ? <Empty icon="🎯" action={<button className="btn btn-p" onClick={() => openSheet({ kind: 'objective' })}>Crear objetivo</button>}>No hay objetivos definidos.</Empty> : data.objectives.map((o) => {
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
                  {pr.done && <span className="badge b-green">✓ Meta cumplida</span>}
                  <button className="icon-btn" onClick={() => del(o.id)} aria-label="Eliminar objetivo">×</button>
                </div>
              </div>
              <div style={{ margin: '10px 0 6px' }}><Progress pct={pr.pct} tone={pr.done ? undefined : 'blue'} /></div>
              <div className="between small">
                <span className="muted num">{pr.current} / {o.target}</span>
                {o.category === 'custom' ? (
                  <span className="row-flex">
                    <button className="btn btn-g btn-xs" aria-label="Restar" onClick={() => upsert('objectives', { ...o, current: Math.max(0, o.current - 1) })}>−</button>
                    <button className="btn btn-g btn-xs" aria-label="Sumar" onClick={() => upsert('objectives', { ...o, current: o.current + 1 })}>+</button>
                  </span>
                ) : <span className="bold num" style={{ color: pr.done ? 'var(--accent)' : 'var(--text)' }}>{pr.pct}%</span>}
              </div>
            </div>
          );
        })}
        <div className="spacer" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
export function Callups() {
  const data = useStore((s) => s.data);
  const team = useStore((s) => s.team);
  const remove = useStore((s) => s.remove);
  const list = [...data.callups].sort(compareDateDesc);
  const name = (pid: string) => data.players.find((p) => p.id === pid);

  const share = async (id: string) => {
    const c = data.callups.find((x) => x.id === id)!;
    const conf = c.players.filter((x) => x.status === 'confirmed').map((x) => name(x.pid)).filter((p): p is NonNullable<typeof p> => !!p);
    const header = [
      `⚽ *${team.name}* — Convocatoria`,
      `🆚 ${c.rival}`,
      `📅 ${fmtDateLong(c.date)}${c.meet_time ? ` · 🕐 ${c.meet_time}` : ''}`,
      ...(c.place ? [`📍 ${c.place}`] : []),
    ];
    const lines = sortPlayers(conf).map((p) => `${p.number != null ? `${p.number}. ` : '• '}${p.name}`);
    const text = [...header, '', ...lines].join('\n');
    const r = await shareText('Convocatoria', text);
    if (r === 'copied') toast('Convocatoria copiada al portapapeles ✓');
    else if (r === 'failed') toast('No se pudo compartir');
  };
  const del = async (id: string) => {
    if (await confirmDialog({ title: '¿Eliminar convocatoria?', ok: 'Eliminar', danger: true })) {
      remove('callups', id);
      toast('Convocatoria eliminada');
    }
  };

  return (
    <div className="page">
      <TopBar back="Táctico" backTo="/tactico" title="Convocatorias" right={<button className="btn btn-p btn-sm" onClick={() => openSheet({ kind: 'callup' })}>+ Nueva</button>} />
      <div className="page-inner" style={{ paddingTop: 12 }}>
        {!list.length ? <Empty icon="📝">No hay convocatorias creadas.</Empty> : list.map((c) => {
          const n = (s: string) => c.players.filter((x) => x.status === s).length;
          return (
            <div className="card" key={c.id}>
              <div className="between" style={{ marginBottom: 8 }}>
                <div><div className="bold">vs {c.rival}</div><div className="xs muted">{fmtDate(c.date)}{c.meet_time ? ` · ${c.meet_time}` : ''}{c.place ? ` · ${c.place}` : ''}</div></div>
                <button className="icon-btn" onClick={() => del(c.id)} aria-label="Eliminar convocatoria">×</button>
              </div>
              <div className="chips" style={{ marginBottom: 10 }}>
                <span className="badge b-green">{n('confirmed')} convocados</span>
                {n('declined') > 0 && <span className="badge b-red">{n('declined')} bajas</span>}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-g btn-sm" style={{ flex: 1 }} onClick={() => openSheet({ kind: 'callup', id: c.id })}>Editar</button>
                <button className="btn btn-p btn-sm" style={{ flex: 1 }} onClick={() => share(c.id)}>📤 Compartir</button>
              </div>
            </div>
          );
        })}
        <div className="spacer" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
export function LineupHistory() {
  const data = useStore((s) => s.data);
  const nav = useNavigate();
  const list = activeMatches(data).filter((m) => m.lineup.some((e) => e.role === 'TIT')).sort(compareDateDesc);
  const first = (pid: string) => data.players.find((p) => p.id === pid)?.name.split(' ')[0] ?? '—';
  return (
    <div className="page">
      <TopBar back="Táctico" backTo="/tactico" title="Histórico de alineaciones" />
      <div className="page-inner" style={{ paddingTop: 12 }}>
        {!list.length ? <Empty icon="🧩">No hay alineaciones registradas todavía.</Empty> : list.map((m) => (
          <button className="card" key={m.id} style={{ display: 'block', width: 'calc(100% - 2 * var(--pad))', textAlign: 'left' }} onClick={() => nav(`/partidos/${m.id}`)}>
            <div className="between" style={{ marginBottom: 8 }}>
              <div><div className="bold">vs {m.rival}</div><div className="xs muted">{fmtDate(m.date)} · {m.tactic}</div></div>
              <ResultBadge m={m} />
            </div>
            <div className="chips">
              {m.lineup.filter((e) => e.role === 'TIT').map((e) => <span key={e.pid} className="chip static">{slotLabel(e.slot)} {first(e.pid)}</span>)}
            </div>
          </button>
        ))}
        <div className="spacer" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
export function Attendance() {
  const data = useStore((s) => s.data);
  const remove = useStore((s) => s.remove);
  const total = data.trainings.length;
  const rows = sortPlayers(activePlayers(data)).map((p) => ({ p, s: playerStats(data, p.id) })).sort((a, b) => b.s.attPct - a.s.attPct);
  const trainings = [...data.trainings].sort(compareDateDesc);
  const del = async (id: string) => {
    if (await confirmDialog({ title: '¿Eliminar entrenamiento?', ok: 'Eliminar', danger: true })) {
      remove('trainings', id);
      toast('Entrenamiento eliminado');
    }
  };
  return (
    <div className="page">
      <TopBar back="Táctico" backTo="/tactico" title="Asistencia" subtitle={`${total} entrenamientos registrados`} right={<button className="btn btn-p btn-sm" onClick={() => openSheet({ kind: 'training' })}>+ Entreno</button>} />
      <div className="page-inner">
        {!total ? <Empty icon="📋">Aún no hay entrenamientos.</Empty> : (
          <>
            <div className="sec-label">Por jugador</div>
            <div className="card">
              {rows.map(({ p, s }) => {
                const tone = s.attPct >= 80 ? undefined : s.attPct >= 50 ? 'gold' : 'red';
                return (
                  <div key={p.id} style={{ marginBottom: 12 }}>
                    <div className="between" style={{ marginBottom: 4 }}>
                      <span className="small bold">{p.name}</span>
                      <span className="small bold num" style={{ color: tone ? `var(--${tone})` : 'var(--accent)' }}>{s.trains}/{total} ({s.attPct}%)</span>
                    </div>
                    <Progress pct={s.attPct} tone={tone} />
                  </div>
                );
              })}
            </div>
            <div className="sec-label">Sesiones</div>
            <div className="card flush">
              {trainings.map((t) => (
                <div className="row" key={t.id}>
                  <div className="avatar score num">{t.present.length}</div>
                  <button className="ri" style={{ background: 'none', border: 'none', textAlign: 'left' }} onClick={() => openSheet({ kind: 'training', id: t.id })}>
                    <div className="rn">{fmtDate(t.date)}</div>
                    <div className="rm">{t.notes || 'Sin notas'}</div>
                  </button>
                  <button className="icon-btn" onClick={() => del(t.id)} aria-label="Eliminar entrenamiento">🗑</button>
                </div>
              ))}
            </div>
          </>
        )}
        <div className="spacer" />
      </div>
    </div>
  );
}
