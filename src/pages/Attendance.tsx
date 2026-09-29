import { ClipboardCheck, Dumbbell, Pencil, Plus, Share2, Trash2 } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router';
import { Empty, Progress, TopBar } from '../components/bits';
import { ExportButton } from '../components/ExportButton';
import { compareDateDesc, fmtDate, fmtDateLong } from '../lib/dates';
import { PunctualityCard } from '../components/PunctualityCard';
import { squadPunctuality } from '../lib/punctuality';
import { normalizeTraining } from '../lib/normalize';
import { shareText } from '../lib/platform';
import { activePlayers, matchOfCallup, playerStats, sortPlayers } from '../lib/stats';
import { deleteCallup } from '../store/actions';
import { useStore } from '../store/store';
import { confirmDialog, openSheet, toast } from '../store/ui';

type Tab = 'entrenos' | 'convocatorias' | 'puntualidad' | 'resumen';
const TABS: [Tab, string][] = [['entrenos', 'Entrenos'], ['convocatorias', 'Convocat.'], ['puntualidad', 'Puntualidad'], ['resumen', 'Resumen']];

export default function Attendance() {
  const data = useStore((s) => s.data);
  const team = useStore((s) => s.team);
  const remove = useStore((s) => s.remove);
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = (TABS.find(([t]) => t === params.get('tab'))?.[0] ?? 'entrenos') as Tab;
  const setTab = (t: Tab) => setParams({ tab: t }, { replace: true });

  const players = sortPlayers(activePlayers(data));
  const stats = new Map(players.map((p) => [p.id, playerStats(data, p.id)]));
  const trainings = [...data.trainings].sort(compareDateDesc);
  const callups = [...data.callups].sort(compareDateDesc);
  const total = data.trainings.length;

  const delTraining = async (id: string) => {
    if (await confirmDialog({ title: '¿Eliminar entrenamiento?', ok: 'Eliminar', danger: true })) {
      remove('trainings', id);
      toast('Entrenamiento eliminado');
    }
  };
  const delCallup = async (id: string) => {
    const m = matchOfCallup(data, id);
    const msg = m && m.status === 'scheduled' ? 'El partido programado asociado también pasará a la papelera.' : 'El partido asociado se conserva.';
    if (await confirmDialog({ title: '¿Eliminar convocatoria?', message: msg, ok: 'Eliminar', danger: true })) {
      deleteCallup(id);
      toast('Convocatoria eliminada');
    }
  };
  const share = async (id: string) => {
    const c = data.callups.find((x) => x.id === id)!;
    const called = sortPlayers(c.players.filter((x) => x.status === 'confirmed').map((x) => data.players.find((p) => p.id === x.pid)).filter((p): p is NonNullable<typeof p> => !!p));
    const m = matchOfCallup(data, id);
    const header = [
      `⚽ *${team.name}* — Convocatoria`,
      `🆚 ${c.rival}${m?.competition ? ` (${m.competition})` : ''}`,
      `📅 ${fmtDateLong(c.date)}${c.meet_time ? ` · 🕐 ${c.meet_time}` : ''}`,
      ...(c.place ? [`📍 ${c.place}`] : []),
    ];
    const r = await shareText('Convocatoria', [...header, '', ...called.map((p) => `${p.number != null ? `${p.number}. ` : '• '}${p.name}`)].join('\n'));
    if (r === 'copied') toast('Convocatoria copiada al portapapeles ✓');
    else if (r === 'failed') toast('No se pudo compartir');
  };

  return (
    <div className="page">
      <TopBar
        back="Inicio" backTo="/" title="Convocatorias y asistencia"
        right={<div className="row-flex"><ExportButton scope="asistencia" label="" title="Exportar asistencia" />{tab === 'entrenos' ? <button className="btn btn-p btn-sm" onClick={() => openSheet({ kind: 'training' })}><Plus className="ico-sm" /> Entreno</button> : tab === 'convocatorias' ? <button className="btn btn-p btn-sm" onClick={() => openSheet({ kind: 'callup' })}><Plus className="ico-sm" /> Nueva</button> : null}</div>}
      />
      <div className="page-inner">
        <div className="tabs" role="tablist" style={{ marginBottom: 6 }}>
          {TABS.map(([t, l]) => <button key={t} role="tab" aria-selected={tab === t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{l}</button>)}
        </div>

        {tab === 'entrenos' && (
          !total ? <Empty icon={Dumbbell} action={<button className="btn btn-p" onClick={() => openSheet({ kind: 'training' })}>Pasar lista</button>}>Aún no hay entrenamientos.</Empty> : (
            <>
              <div className="sec-label">Sesiones · {total}</div>
              <div className="card flush">
                {trainings.map((raw) => {
                  const t = normalizeTraining(raw);
                  const late = t.attendance.filter((a) => a.status === 'late').length;
                  return (
                  <div className="row" key={t.id}>
                    <div className="avatar score num">{t.present.length}</div>
                    <button className="ri" style={{ background: 'none', border: 'none', textAlign: 'left' }} onClick={() => openSheet({ kind: 'training', id: t.id })}>
                      <div className="rn">{fmtDate(t.date)}</div>
                      <div className="rm">{t.notes || `${t.present.length} de ${players.length} presentes`}{late > 0 && <span className="badge b-gold" style={{ fontSize: 10 }}>{late} tarde</span>}</div>
                    </button>
                    <button className="icon-btn" onClick={() => void delTraining(t.id)} aria-label="Eliminar entrenamiento"><Trash2 className="ico" /></button>
                  </div>
                  );
                })}
              </div>
            </>
          )
        )}

        {tab === 'convocatorias' && (
          !callups.length ? <Empty icon={ClipboardCheck} action={<button className="btn btn-p" onClick={() => openSheet({ kind: 'callup' })}>Crear convocatoria</button>}>No hay convocatorias.<br />Al crear una, el partido se añade solo a Partidos.</Empty> : (
            <div style={{ paddingTop: 12 }}>
              {callups.map((c) => {
                const m = matchOfCallup(data, c.id);
                const n = (s: string) => c.players.filter((x) => x.status === s).length;
                return (
                  <div className="card" key={c.id}>
                    <div className="between" style={{ marginBottom: 8, alignItems: 'flex-start' }}>
                      <div>
                        <div className="bold">vs {c.rival}</div>
                        <div className="xs muted">{fmtDate(c.date)}{c.meet_time ? ` · ${c.meet_time}` : ''}{c.place ? ` · ${c.place}` : ''}</div>
                      </div>
                      {m && <span className={`badge ${m.status === 'played' ? 'b-gray' : 'b-blue'}`}>{m.status === 'played' ? `Jugado ${m.gf}–${m.ga}` : 'Programado'}</span>}
                    </div>
                    <div className="chips" style={{ marginBottom: 12 }}>
                      <span className="badge b-blue">{n('confirmed')} convocados</span>
                      {n('declined') > 0 && <span className="badge b-red">{n('declined')} bajas</span>}
                      {c.players.filter((x) => x.status === 'confirmed' && x.arrival?.status === 'late').length > 0 && <span className="badge b-gold">{c.players.filter((x) => x.status === 'confirmed' && x.arrival?.status === 'late').length} tarde</span>}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {m && <button className="btn btn-g btn-sm" style={{ flex: 1 }} onClick={() => nav(`/partidos/${m.id}`)}>Ver partido</button>}
                      <button className="btn btn-g btn-sm" style={{ flex: 1 }} onClick={() => openSheet({ kind: 'callup', id: c.id })}><Pencil className="ico-sm" /> Editar</button>
                      <button className="btn btn-p btn-sm" onClick={() => void share(c.id)} aria-label="Compartir"><Share2 className="ico-sm" /></button>
                      <button className="btn btn-danger btn-sm" onClick={() => void delCallup(c.id)} aria-label="Eliminar"><Trash2 className="ico-sm" /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}

        {tab === 'puntualidad' && (
          !players.length ? <Empty icon={ClipboardCheck}>Añade jugadores para ver la puntualidad.</Empty> : (
            <>
              <div className="sec-label">Plantilla · más retrasos primero</div>
              <div className="card flush">
                {squadPunctuality(data, players).map(({ p, s }) => (
                  <button key={p.id} className="row" onClick={() => nav(`/plantilla/${p.id}`)}>
                    <div className="avatar score num">{s.lates}</div>
                    <div className="ri">
                      <div className="rn">{p.name}</div>
                      <div className="rm">{s.attended ? `${s.pctLate}% con retraso · entrenos ${s.trainings.late} · convocatorias ${s.callups.late}` : 'Sin datos de puntualidad'}</div>
                    </div>
                  </button>
                ))}
              </div>
              <div className="sec-label">Detalle por jugador</div>
              {squadPunctuality(data, players).filter(({ s }) => s.lates > 0).slice(0, 5).map(({ p, s }) => (
                <div key={p.id}><div className="xs muted bold" style={{ padding: '0 var(--pad)' }}>{p.name}</div><PunctualityCard s={s} /></div>
              ))}
              {!squadPunctuality(data, players).some(({ s }) => s.lates > 0) && <p className="hint" style={{ padding: '0 var(--pad)' }}>Nadie tiene retrasos registrados todavía.</p>}
            </>
          )
        )}

        {tab === 'resumen' && (
          !players.length ? <Empty icon={ClipboardCheck}>Añade jugadores para ver el resumen.</Empty> : (
            <>
              <div className="sec-label">Por jugador</div>
              <div className="card">
                {players.map((p) => {
                  const s = stats.get(p.id)!;
                  const tone = s.attPct >= 80 ? 'green' : s.attPct >= 50 ? 'gold' : 'red';
                  return (
                    <div key={p.id} style={{ marginBottom: 14 }}>
                      <div className="between" style={{ marginBottom: 5 }}>
                        <span className="small bold">{p.name}</span>
                        <span className="xs muted num">Entrenos {s.trains}/{s.totalTrains} · Convocado {s.called}/{s.totalCallups} · {s.mins}'</span>
                      </div>
                      <Progress pct={s.attPct} tone={total ? tone : undefined} />
                    </div>
                  );
                })}
              </div>
            </>
          )
        )}
        <div className="spacer" />
      </div>
    </div>
  );
}
