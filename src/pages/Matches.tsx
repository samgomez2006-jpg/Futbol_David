import { CalendarClock, Plus, RotateCcw, Trash2, Trophy } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router';
import { ExportButton } from '../components/ExportButton';
import { Empty, ResultBadge, resultColor, TopBar } from '../components/bits';
import { TRASH_DAYS } from '../lib/constants';
import { compareDateDesc, fmtDate, fmtWeekday } from '../lib/dates';
import { callupOfMatch, playedMatches, resultOf, squadOf, teamSummary, trashedMatches, upcomingMatches } from '../lib/stats';
import { useStore } from '../store/store';
import { confirmDialog, openSheet, toast } from '../store/ui';

const daysLeft = (deletedAt: string) => Math.max(0, TRASH_DAYS - Math.floor((Date.now() - Date.parse(deletedAt)) / 864e5));
type Tab = 'proximos' | 'jugados' | 'papelera';

export default function Matches() {
  const data = useStore((s) => s.data);
  const upsert = useStore((s) => s.upsert);
  const remove = useStore((s) => s.remove);
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();

  const upcoming = upcomingMatches(data);
  const played = [...playedMatches(data)].sort(compareDateDesc);
  const trashed = [...trashedMatches(data)].sort((a, b) => Date.parse(b.deleted_at!) - Date.parse(a.deleted_at!));
  const requested = params.get('tab');
  const tab: Tab = requested === 'proximos' || requested === 'jugados' || requested === 'papelera' ? requested : upcoming.length ? 'proximos' : 'jugados';
  const setTab = (t: Tab) => setParams({ tab: t }, { replace: true });
  const sum = teamSummary(played);

  const restore = (id: string) => {
    upsert('matches', { ...data.matches.find((x) => x.id === id)!, deleted_at: null });
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
        subtitle={tab === 'papelera' ? `${trashed.length} en papelera` : `${played.length} jugados · ${sum.w}G ${sum.dr}E ${sum.l}P`}
        right={<div className="row-flex"><ExportButton scope="partidos" label="" title="Exportar partidos" /><button className="btn btn-p btn-sm" onClick={() => openSheet({ kind: 'match' })}><Plus className="ico-sm" /> Partido</button></div>}
      />
      <div className="page-inner">
        <div className="tabs" role="tablist" style={{ marginBottom: 12 }}>
          <button role="tab" aria-selected={tab === 'proximos'} className={`tab ${tab === 'proximos' ? 'active' : ''}`} onClick={() => setTab('proximos')}>Próximos{upcoming.length ? ` (${upcoming.length})` : ''}</button>
          <button role="tab" aria-selected={tab === 'jugados'} className={`tab ${tab === 'jugados' ? 'active' : ''}`} onClick={() => setTab('jugados')}>Jugados{played.length ? ` (${played.length})` : ''}</button>
          <button role="tab" aria-selected={tab === 'papelera'} className={`tab ${tab === 'papelera' ? 'active' : ''}`} onClick={() => setTab('papelera')}><Trash2 className="ico-sm" /> Papelera{trashed.length ? ` (${trashed.length})` : ''}</button>
        </div>

        {tab === 'proximos' && (
          !upcoming.length ? (
            <Empty icon={CalendarClock} action={<button className="btn btn-p" onClick={() => openSheet({ kind: 'callup' })}>Crear convocatoria</button>}>No hay partidos programados.<br />Al crear una convocatoria, el partido aparece aquí automáticamente.</Empty>
          ) : (
            <div className="card flush">
              {upcoming.map((m) => {
                const squad = squadOf(data, m);
                const callup = callupOfMatch(data, m);
                return (
                  <button key={m.id} className="row" onClick={() => nav(`/partidos/${m.id}`)}>
                    <div className="avatar score" style={{ flexDirection: 'column', fontSize: 11, lineHeight: 1.1 }}><CalendarClock className="ico-sm" /></div>
                    <div className="ri">
                      <div className="rn">vs {m.rival}</div>
                      <div className="rm">{fmtWeekday(m.date)}{callup?.meet_time ? ` · ${callup.meet_time}` : ''} · {m.venue === 'L' ? 'Local' : 'Visitante'}{m.competition ? ` · ${m.competition}` : ''}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span className="badge b-blue">Programado</span>
                      <div className="xs muted" style={{ marginTop: 3 }}>{squad ? `${squad.length} convocados` : 'Sin convocar'}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          )
        )}

        {tab === 'jugados' && (
          !played.length ? (
            <Empty icon={Trophy} action={<button className="btn btn-p" onClick={() => openSheet({ kind: 'match' })}>Registrar partido</button>}>No hay partidos jugados todavía.</Empty>
          ) : (
            <div className="card flush">
              {played.map((m) => (
                <button key={m.id} className="row" onClick={() => nav(`/partidos/${m.id}`)}>
                  <div className="avatar score num" style={{ color: resultColor[resultOf(m)] }}>{m.gf}-{m.ga}</div>
                  <div className="ri"><div className="rn">vs {m.rival}</div><div className="rm">{fmtDate(m.date)} · {m.venue === 'L' ? 'Local' : 'Visitante'} · {m.tactic || '—'}{m.competition ? ` · ${m.competition}` : ''}</div></div>
                  <ResultBadge m={m} />
                </button>
              ))}
            </div>
          )
        )}

        {tab === 'papelera' && (
          !trashed.length ? <Empty icon={Trash2}>La papelera está vacía.<br />Los partidos borrados se guardan {TRASH_DAYS} días.</Empty> : (
            <div className="card flush">
              {trashed.map((m) => (
                <div key={m.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <div className="row" style={{ borderBottom: 'none', opacity: 0.75 }}>
                    <div className="avatar score num">{m.status === 'played' ? `${m.gf}-${m.ga}` : '·'}</div>
                    <div className="ri"><div className="rn">vs {m.rival}</div><div className="rm">{fmtDate(m.date)} · se elimina en {daysLeft(m.deleted_at!)} días</div></div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, padding: '0 var(--pad) 12px' }}>
                    <button className="btn btn-g btn-xs" style={{ flex: 1 }} onClick={() => restore(m.id)}><RotateCcw className="ico-sm" /> Restaurar</button>
                    <button className="btn btn-danger btn-xs" style={{ flex: 1 }} onClick={() => void purge(m.id)}>Eliminar ya</button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
        <div className="spacer" />
      </div>
    </div>
  );
}
