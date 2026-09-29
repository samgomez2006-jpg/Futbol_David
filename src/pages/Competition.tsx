import { CalendarPlus, ExternalLink, Link2, Trophy } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Empty, TopBar } from '../components/bits';
import { FcfSourceBar, NA, SrcFcf } from '../components/FcfBits';
import { fmtDate } from '../lib/dates';
import { shortTeamName } from '../lib/fcf/analysis';
import { actaUrl } from '../lib/fcf/types';
import { syncFcfCalendar } from '../store/actions';
import { useFcfGroup } from '../store/fcf';
import { openSheet, toast } from '../store/ui';

type Tab = 'clasificacion' | 'calendario' | 'goleadores';
const TABS: [Tab, string][] = [['clasificacion', 'Clasificación'], ['calendario', 'Calendario'], ['goleadores', 'Goleadores']];

export default function Competition() {
  const { link, group, loading, error, refresh } = useFcfGroup();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = (TABS.find(([t]) => t === params.get('tab'))?.[0] ?? 'clasificacion') as Tab;
  const [mine, setMine] = useState(true);

  if (!link)
    return (
      <div className="page">
        <TopBar back="Inicio" backTo="/" title="Competición" />
        <Empty icon={Trophy} action={<button className="btn btn-p" onClick={() => openSheet({ kind: 'fcf' })}><Link2 className="ico-sm" /> Vincular competición</button>}>
          Vincula tu equipo con su competición de la FCF para ver<br />calendario, resultados, clasificación, goleadores y análisis de rivales.
        </Empty>
      </div>
    );

  const me = link.team.id;
  const importCal = () => {
    if (!group) return;
    try {
      const r = syncFcfCalendar(group);
      toast(r.created || r.updated || r.linked ? `Calendario: ${r.created} nuevos, ${r.updated} actualizados, ${r.linked} vinculados ✓` : 'El calendario ya estaba al día ✓');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo importar');
    }
  };
  const rounds = group ? [...new Set(group.matches.map((m) => m.round))].sort((a, b) => a - b) : [];
  const standings = group ? [...group.standings].sort((a, b) => a.pos - b.pos) : [];
  const noTable = standings.every((s) => s.pj === 0);

  return (
    <div className="page">
      <TopBar back="Inicio" backTo="/" title="Competición" subtitle={`${link.competition.label} · ${link.group.label}`}
        right={<button className="btn btn-g btn-sm" onClick={() => openSheet({ kind: 'fcf' })}>Cambiar</button>} />
      <div className="page-inner">
        <FcfSourceBar fetchedAt={group?.fetchedAt ?? null} loading={loading} onRefresh={() => void refresh().then((g) => g && toast('Datos FCF actualizados ✓'))} />
        {error && <div className="error-box" role="alert">{error}</div>}
        {!group ? (
          <div className="hint" style={{ textAlign: 'center', padding: 24 }}>{loading ? 'Descargando datos de la FCF…' : 'Sin datos todavía.'}</div>
        ) : (
          <>
            <div style={{ padding: '0 var(--pad) 8px' }}>
              <button className="btn btn-p btn-block" onClick={() => nav(`/competicion/equipo/${me}`)}>Análisis de mi equipo ({shortTeamName(link.team.label)})</button>
            </div>
            <div className="tabs" role="tablist">
              {TABS.map(([t, l]) => <button key={t} role="tab" aria-selected={tab === t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setParams({ tab: t }, { replace: true })}>{l}</button>)}
            </div>

            {tab === 'clasificacion' && (
              <>
                <div className="sec-label">Clasificación oficial <SrcFcf /></div>
                {noTable && <p className="hint" style={{ padding: '0 var(--pad)' }}>La competición aún no ha empezado: no hay clasificación disponible.</p>}
                <div className="card flush" style={{ overflowX: 'auto' }}>
                  <table className="fcf-table">
                    <thead><tr><th>#</th><th className="tn">Equipo</th><th>PJ</th><th>G</th><th>E</th><th>P</th><th>GF</th><th>GC</th><th>Pts</th></tr></thead>
                    <tbody>
                      {standings.map((s) => (
                        <tr key={s.teamId} className={`tap ${s.teamId === me ? 'me' : ''}`} onClick={() => nav(`/competicion/equipo/${s.teamId}`)}>
                          <td>{s.pj ? s.pos : '–'}</td><td className="tn">{shortTeamName(s.name)}</td><td>{s.pj}</td><td>{s.w}</td><td>{s.d}</td><td>{s.l}</td><td>{s.gf}</td><td>{s.ga}</td><td><b>{s.pts}</b></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="hint" style={{ padding: '0 var(--pad)' }}>Toca un equipo para ver su análisis.</p>
              </>
            )}

            {tab === 'calendario' && (
              <>
                <div className="card">
                  <div className="bold small">Importar a Partidos</div>
                  <p className="xs muted" style={{ margin: '4px 0 10px' }}>Crea tus partidos pendientes como programados y actualiza fechas o campo si cambian en la FCF. No duplica partidos: si ya tenías uno con ese rival y fecha, lo vincula.</p>
                  <button className="btn btn-g btn-sm" onClick={importCal}><CalendarPlus className="ico-sm" /> Importar / actualizar calendario</button>
                </div>
                <div className="chips" style={{ padding: '0 var(--pad) 6px' }}>
                  <button className={`chip ${mine ? 'sel' : ''}`} onClick={() => setMine(true)}>Mis partidos</button>
                  <button className={`chip ${!mine ? 'sel' : ''}`} onClick={() => setMine(false)}>Todo el grupo</button>
                </div>
                {rounds.map((r) => {
                  const list = group.matches.filter((m) => m.round === r && (!mine || m.homeId === me || m.awayId === me));
                  if (!list.length) return null;
                  return (
                    <div key={r}>
                      <div className="round-h">Jornada {r}{list[0].date ? ` · ${fmtDate(list[0].date)}` : ''}</div>
                      <div className="card flush" style={{ margin: '0 var(--pad) 4px' }}>
                        {list.map((m) => (
                          <div key={m.acta} className={`fx-row ${m.homeId === me || m.awayId === me ? 'me' : ''}`}>
                            <span className="h">{m.bye ? shortTeamName(m.homeId === '-1' ? m.awayName : m.homeName) : shortTeamName(m.homeName)}</span>
                            {m.bye ? <span className="sc xs muted">Descansa</span> : m.closed ? (
                              <a className="sc" href={actaUrl(m.acta)} target="_blank" rel="noreferrer" aria-label="Ver acta en la FCF">{m.hg} - {m.ag}</a>
                            ) : <span className="sc xs muted">{m.time ?? (m.date ? fmtDate(m.date).slice(0, 5) : '—')}</span>}
                            <span>{m.bye ? '' : shortTeamName(m.awayName)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </>
            )}

            {tab === 'goleadores' && (
              <>
                <div className="sec-label">Máximos goleadores del grupo <SrcFcf /></div>
                <div className="chips" style={{ padding: '0 var(--pad) 6px' }}>
                  <button className={`chip ${!mine ? 'sel' : ''}`} onClick={() => setMine(false)}>Todo el grupo</button>
                  <button className={`chip ${mine ? 'sel' : ''}`} onClick={() => setMine(true)}>Mi equipo</button>
                </div>
                {(() => {
                  const list = group.scorers.filter((s) => !mine || s.teamId === me);
                  if (!list.length) return <div className="card small"><NA>{group.scorers.length ? 'Ningún jugador de tu equipo en la lista de la FCF' : 'La FCF aún no publica goleadores para este grupo'}</NA></div>;
                  return (
                    <div className="card flush">
                      {list.map((s, i) => (
                        <button key={s.playerId + i} className="row" onClick={() => nav(`/competicion/equipo/${s.teamId}`)}>
                          <div className="avatar score num">{s.goals}</div>
                          <div className="ri"><div className="rn">{s.name}</div><div className="rm">{shortTeamName(s.teamName)} · {s.matches} PJ{s.penalties ? ` · ${s.penalties} de penalti` : ''}</div></div>
                        </button>
                      ))}
                    </div>
                  );
                })()}
                {group.scorers.length >= 50 && <p className="hint" style={{ padding: '0 var(--pad)' }}>La FCF solo publica los 50 máximos goleadores del grupo.</p>}
              </>
            )}
          </>
        )}
        <p className="hint" style={{ padding: '8px var(--pad)' }}><Link to="/equipo" className="link"><ExternalLink className="ico-sm" /> Configurar en Equipo → Competición FCF</Link></p>
        <div className="spacer" />
      </div>
    </div>
  );
}
