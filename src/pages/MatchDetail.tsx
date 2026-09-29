import { ArrowLeftRight, CalendarClock, ClipboardCheck, MapPin, Pencil, Play, Trash2, Trophy } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router';
import { ExportButton } from '../components/ExportButton';
import { Empty, ResultBadge, resultColor, TextBlock, TopBar, posBadge } from '../components/bits';
import { Pitch } from '../components/Pitch';
import { TRASH_DAYS } from '../lib/constants';
import { fmtDate, fmtWeekday } from '../lib/dates';
import { resolveAssign } from '../lib/lineup';
import { callupOfMatch, resultOf, sortPlayers } from '../lib/stats';
import { zoneLabel } from '../lib/zones';
import { saveMatch } from '../store/actions';
import { useStore } from '../store/store';
import { confirmDialog, openSheet, toast } from '../store/ui';

function EditLink({ tab, id, label = 'Editar' }: { tab: string; id: string; label?: string }) {
  return <button className="link" onClick={() => openSheet({ kind: 'match', id, tab })}><Pencil className="ico-sm" /> {label}</button>;
}

export default function MatchDetail() {
  const { id } = useParams();
  const data = useStore((s) => s.data);
  const team = useStore((s) => s.team);
  const nav = useNavigate();
  const m = data.matches.find((x) => x.id === id);
  if (!m) return <div className="page"><TopBar back="Partidos" backTo="/partidos" /><Empty icon={Trophy}>Partido no encontrado.</Empty></div>;

  const name = (pid: string | null) => (pid ? data.players.find((p) => p.id === pid)?.name ?? '—' : 'Sin asignar');
  const byId = new Map(data.players.map((p) => [p.id, p]));
  const callup = callupOfMatch(data, m);
  const called = callup ? sortPlayers(callup.players.filter((p) => p.status === 'confirmed').map((p) => byId.get(p.pid)).filter((p): p is NonNullable<typeof p> => !!p)) : [];
  const { assign, extras } = resolveAssign(m.tactic, m.lineup);
  const marks: Record<string, { out?: number | null }> = {};
  for (const s of m.subs) marks[s.out_pid] = { out: s.min };
  const bench = m.lineup.filter((e) => e.role === 'SUP');
  const played = m.status === 'played';
  const r = resultOf(m);
  const hasLineup = m.lineup.some((e) => e.role === 'TIT');
  const rv = m.rival_info;
  const hasRival = Object.values(rv).some((v) => v.trim());
  const pa = m.plan.attack;
  const pd = m.plan.defense;
  const hasPlan = [...Object.values(pa), ...Object.values(pd)].some((v) => v.trim());

  const trash = async () => {
    if (!(await confirmDialog({ title: 'Mover a la papelera', message: `Podrás restaurarlo durante ${TRASH_DAYS} días.`, ok: 'Mover', danger: true }))) return;
    saveMatch({ ...m, deleted_at: new Date().toISOString() });
    toast('Partido movido a la papelera');
    nav('/partidos', { replace: true });
  };
  const markPlayed = () => {
    saveMatch({ ...m, status: 'played' });
    openSheet({ kind: 'match', id: m.id, tab: 'info' });
  };

  const subLine = (s: (typeof m.subs)[number]) => (
    <div className="sub-row" key={s.id}>
      <span className="ev-min">{s.min ?? '?'}'</span>
      <span className="sub-out">↓ {name(s.out_pid)}</span>
      <ArrowLeftRight className="ico-sm" style={{ color: 'var(--text3)' }} />
      <span className="sub-in">↑ {name(s.in_pid)}</span>
    </div>
  );

  return (
    <div className="page">
      <TopBar back="Partidos" backTo="/partidos" right={<div className="row-flex"><ExportButton scope="partidos" match={m} label="PDF" title="Exportar ficha del partido" /><button className="btn btn-g btn-sm" onClick={() => openSheet({ kind: 'match', id: m.id })}><Pencil className="ico-sm" /> Editar</button></div>} />
      <div className="page-inner">
        <div className="det-header">
          <div className="xs muted" style={{ marginBottom: 6 }}>
            {played ? fmtDate(m.date) : fmtWeekday(m.date)}{callup?.meet_time ? ` · ${callup.meet_time}` : ''} · {m.venue === 'L' ? 'Local' : 'Visitante'}{m.competition ? ` · ${m.competition}` : ''}
          </div>
          <div className="small muted" style={{ marginBottom: 4 }}>
            {m.venue === 'L' ? <>{team.name} <span style={{ color: 'var(--text3)' }}>vs</span> {m.rival}</> : <>{m.rival} <span style={{ color: 'var(--text3)' }}>vs</span> {team.name}</>}
          </div>
          {played ? (
            <>
              <div className="m-score num" style={{ color: resultColor[r] }}>{m.venue === 'L' ? `${m.gf} — ${m.ga}` : `${m.ga} — ${m.gf}`}</div>
              <div style={{ marginTop: 10 }}><ResultBadge m={m} /></div>
            </>
          ) : (
            <>
              <div className="badge b-blue" style={{ margin: '6px 0' }}><CalendarClock className="ico-sm" /> Partido programado</div>
              {callup?.place && <div className="small muted"><MapPin className="ico-sm" style={{ verticalAlign: '-2px' }} /> {callup.place}</div>}
              <div style={{ marginTop: 12 }}><button className="btn btn-p btn-sm" onClick={markPlayed}><Play className="ico-sm" /> Registrar resultado</button></div>
            </>
          )}
          {m.deleted_at && <div style={{ marginTop: 8 }}><span className="badge b-red">En la papelera</span></div>}
        </div>

        {m.motm && (
          <div className="card row-flex" style={{ marginTop: 12 }}>
            <span className="ico-badge"><Trophy className="ico" /></span>
            <div><div className="xs muted bold">Jugador del partido</div><div className="bold">{name(m.motm)}</div></div>
          </div>
        )}

        {/* Convocados */}
        <div className="sec-label"><span>Convocados{called.length ? ` · ${called.length}` : ''}</span>{callup ? <button className="link" onClick={() => openSheet({ kind: 'callup', id: callup.id })}><Pencil className="ico-sm" /> Editar</button> : <button className="link" onClick={() => openSheet({ kind: 'match', id: m.id, tab: 'lineup' })}>Alineación</button>}</div>
        <div className="card">
          {called.length ? (
            <div className="chips">{called.map((p) => <span key={p.id} className="chip static"><b>{p.number ?? '·'}</b> {p.name.split(' ')[0]}</span>)}</div>
          ) : <p className="small muted">Este partido no tiene convocatoria. <Link to="/asistencia?tab=convocatorias" style={{ color: 'var(--accent-d)', fontWeight: 650 }}>Crear una</Link> lo vincula automáticamente.</p>}
        </div>

        {/* Alineación visual */}
        <div className="sec-label"><span>Alineación · {m.tactic}</span><EditLink tab="lineup" id={m.id} /></div>
        {hasLineup ? (
          <div className="card" style={{ padding: 12 }}>
            <Pitch tactic={m.tactic} assign={assign} players={byId} marks={marks} />
            {extras.length > 0 && (
              <div className="chips" style={{ marginTop: 10 }}>{extras.map((e) => <span key={e.pid} className="chip static">{name(e.pid)} · {e.mins}'</span>)}</div>
            )}
            <div className="legend" style={{ marginTop: 8 }}>
              <span><i className="swatch" style={{ background: 'var(--accent)', borderRadius: '50%' }} />Titular</span>
              <span><i className="swatch" style={{ background: 'var(--loss)', borderRadius: '50%' }} />Sustituido (minuto)</span>
            </div>
            <div className="sec-label" style={{ padding: '14px 0 6px' }}>Minutos</div>
            {m.lineup.filter((e) => e.role === 'TIT').map((e) => (
              <div className="srow" key={e.pid} style={{ padding: '7px 0' }}><span className="srl">{name(e.pid)} <span className="xs" style={{ color: 'var(--text3)' }}>{e.slot ? e.slot.split('#')[0].replace(/\d+$/, '') : ''}</span></span><span className="srv num">{e.mins}'</span></div>
            ))}
          </div>
        ) : <div className="card small muted">Aún no has definido la alineación. <button className="linkbtn" onClick={() => openSheet({ kind: 'match', id: m.id, tab: 'lineup' })}>Definirla</button></div>}

        {(m.subs.length > 0 || bench.length > 0) && (
          <>
            <div className="sec-label"><span>Suplentes y cambios</span><EditLink tab="lineup" id={m.id} /></div>
            <div className="card">
              {m.subs.length > 0 && <div className="sub-list" style={{ marginBottom: bench.length ? 12 : 0 }}>{[...m.subs].sort((a, b) => (a.min ?? 999) - (b.min ?? 999)).map(subLine)}</div>}
              {bench.length > 0 && (
                <div className="chips">
                  {bench.map((e) => {
                    const p = byId.get(e.pid);
                    return <span key={e.pid} className="chip static">{p ? <span className={`badge ${posBadge[p.position]}`} style={{ fontSize: 9 }}>{p.position.slice(0, 3)}</span> : null}{name(e.pid).split(' ')[0]}{e.mins > 0 ? ` · ${e.mins}'` : ''}</span>;
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {/* Goles */}
        {(m.goals.length > 0 || m.conceded.length > 0) && (
          <>
            <div className="sec-label"><span>Goles</span><EditLink tab="goals" id={m.id} /></div>
            <div className="card flush" style={{ padding: '6px 0' }}>
              {[...m.goals.map((g) => ({ ...g, side: 'for' as const })), ...m.conceded.map((g) => ({ ...g, side: 'against' as const, pid: null as string | null, apid: null as string | null, body: '' }))]
                .sort((a, b) => (a.min ?? 999) - (b.min ?? 999))
                .map((g) => (
                  <div className="ev-row" key={g.id}>
                    <div className="ev-min">{g.min ?? '?'}'</div>
                    <span className="swatch" style={{ background: g.side === 'for' ? 'var(--series-for)' : 'var(--series-against)', borderRadius: '50%' }} aria-label={g.side === 'for' ? 'A favor' : 'En contra'} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="small bold">{g.side === 'for' ? (g.gtype === 'Propia puerta' ? 'Propia puerta (rival)' : name(g.pid)) : `Gol de ${m.rival}`}</div>
                      <div className="xs muted">{[g.gtype, g.body, g.apid && `Asist: ${name(g.apid)}`, g.field_zone && zoneLabel(g.field_zone), g.goal_zone].filter(Boolean).join(' · ')}</div>
                    </div>
                  </div>
                ))}
            </div>
          </>
        )}

        {(m.cards.length > 0 || m.incidents.length > 0) && (
          <>
            <div className="sec-label"><span>Incidencias</span><EditLink tab="incidents" id={m.id} /></div>
            <div className="card flush" style={{ padding: '6px 0' }}>
              {m.cards.map((c) => (
                <div className="ev-row" key={c.id}><div className="ev-min">{c.min ?? '?'}'</div><span aria-label={c.type === 'Y' ? 'Amarilla' : 'Roja'}>{c.type === 'Y' ? '🟨' : '🟥'}</span><span className="small">{name(c.pid)}</span></div>
              ))}
              {m.incidents.map((i) => (
                <div className="ev-row" key={i.id}><div className="ev-min">{i.min ?? '?'}'</div><span className="small">{i.text}</span></div>
              ))}
            </div>
          </>
        )}

        {/* Rival y planteamiento */}
        <div className="sec-label"><span>Rival</span><EditLink tab="rival" id={m.id} label={hasRival ? 'Editar' : 'Añadir'} /></div>
        <div className="card">
          {hasRival ? (
            <>
              <TextBlock label="Observaciones generales" value={rv.general} />
              <TextBlock label="Características" value={rv.traits} />
              <TextBlock label="Fortalezas" value={rv.strengths} />
              <TextBlock label="Debilidades" value={rv.weaknesses} />
              <TextBlock label="Sistema utilizado" value={rv.system} />
              <TextBlock label="Jugadores relevantes" value={rv.key_players} />
              <TextBlock label="Otra información" value={rv.other} />
            </>
          ) : <p className="small muted">Sin información del rival. Añade fortalezas, debilidades y su sistema para preparar el partido.</p>}
        </div>

        <div className="sec-label"><span>Planteamiento del partido</span><EditLink tab="plan" id={m.id} label={hasPlan ? 'Editar' : 'Añadir'} /></div>
        {hasPlan ? (
          <>
            <div className="card">
              <div className="bold" style={{ marginBottom: 8 }}>En ataque</div>
              <TextBlock label="Objetivos ofensivos" value={pa.objectives} />
              <TextBlock label="Salida de balón" value={pa.buildup} />
              <TextBlock label="Progresión" value={pa.progression} />
              <TextBlock label="Ataque" value={pa.attack} />
              <TextBlock label="Ocupación de espacios" value={pa.spaces} />
              <TextBlock label="Principios ofensivos" value={pa.principles} />
              <TextBlock label="Indicaciones para este rival" value={pa.specific} />
            </div>
            <div className="card">
              <div className="bold" style={{ marginBottom: 8 }}>En defensa</div>
              <TextBlock label="Organización defensiva" value={pd.organization} />
              <TextBlock label="Presión" value={pd.press} />
              <TextBlock label="Bloque defensivo" value={pd.block} />
              <TextBlock label="Marcajes" value={pd.marking} />
              <TextBlock label="Vigilancias" value={pd.vigilance} />
              <TextBlock label="Objetivos defensivos" value={pd.objectives} />
              <TextBlock label="Indicaciones para este rival" value={pd.specific} />
            </div>
          </>
        ) : <div className="card small muted">Prepara cómo quieres atacar y defender ante este rival. Podrás consultarlo después del partido.</div>}

        {m.notes && (
          <>
            <div className="sec-label"><span>Observaciones</span><EditLink tab="info" id={m.id} /></div>
            <div className="card"><p className="prose">{m.notes}</p></div>
          </>
        )}

        {!m.deleted_at && (
          <div style={{ padding: '6px var(--pad) 0', display: 'flex', gap: 10 }}>
            {callup && <button className="btn btn-g" style={{ flex: 1 }} onClick={() => nav('/asistencia?tab=convocatorias')}><ClipboardCheck className="ico-sm" /> Convocatoria</button>}
            <button className="btn btn-danger" style={{ flex: 1 }} onClick={trash}><Trash2 className="ico-sm" /> Papelera</button>
          </div>
        )}
        <div className="spacer" />
      </div>
    </div>
  );
}
