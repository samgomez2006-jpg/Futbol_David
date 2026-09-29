import { ExternalLink, FileSearch, Lightbulb, Shield } from 'lucide-react';
import { useState } from 'react';
import { useParams } from 'react-router';
import { CompareRow, PairBars, PositionChart } from '../components/Charts';
import { Empty, TopBar } from '../components/bits';
import { FcfSourceBar, FormDots, NA, SrcFcf } from '../components/FcfBits';
import { fmtDate } from '../lib/dates';
import { goalTiming, headToHead, insights, MIN_MATCHES, MIN_TIMED_GOALS, positionHistory, shortTeamName, teamRecord, teamScorers } from '../lib/fcf/analysis';
import { actaUrl } from '../lib/fcf/types';
import { useFcf, useFcfGroup } from '../store/fcf';

const dec = (n: number, d = 1) => n.toFixed(d).replace('.', ',');
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

export default function RivalAnalysis() {
  const { id = '' } = useParams();
  const { teamId, link, group, actas, loading, refresh } = useFcfGroup();
  const [progress, setProgress] = useState<string | null>(null);

  if (!link || !group)
    return <div className="page"><TopBar back="Competición" backTo="/competicion" title="Análisis" /><Empty icon={Shield}>{loading ? 'Descargando datos de la FCF…' : 'Vincula primero la competición FCF.'}</Empty></div>;

  const me = link.team.id;
  const isMe = id === me;
  const rec = teamRecord(group, id);
  const ours = teamRecord(group, me);
  if (!rec.name) return <div className="page"><TopBar back="Competición" backTo="/competicion" title="Análisis" /><Empty icon={Shield}>Equipo no encontrado en este grupo.</Empty></div>;
  const st = group.standings.find((s) => s.teamId === id);
  const hist = positionHistory(group);
  const timing = goalTiming(group, id, actas, link.halfMins);
  const scorers = teamScorers(group, id, rec.gf);
  const h2h = isMe ? [] : headToHead(group, me, id);
  const facts = insights(rec, timing, isMe ? 'Tu equipo' : 'El rival');
  const title = shortTeamName(rec.name);
  const missing = rec.played.filter((p) => !actas[p.acta]).map((p) => p.acta);
  const timedFor = timing.forH1 + timing.forH2;
  const timedAg = timing.agH1 + timing.agH2;

  const analyseActas = async () => {
    setProgress(`0 de ${missing.length}`);
    await useFcf.getState().loadActas(teamId, missing, (d, t) => setProgress(`${d} de ${t}`));
    setProgress(null);
  };

  return (
    <div className="page">
      <TopBar back="Competición" backTo="/competicion" title={isMe ? `Mi equipo: ${title}` : `Análisis del rival`} subtitle={isMe ? link.group.label : title} />
      <div className="page-inner">
        <FcfSourceBar fetchedAt={group.fetchedAt} loading={loading} onRefresh={() => void refresh()} />

        <div className="hero" style={{ marginBottom: 12 }}>
          <div className="eyebrow"><Shield className="ico-sm" /> {link.competition.label} · {link.group.label}</div>
          <h2>{rec.name}</h2>
          <div className="meta">
            {st && st.pj > 0 ? <span>{st.pos}º · {st.pts} puntos (clasificación oficial)</span> : <span>Sin clasificación todavía</span>}
            <span>{rec.pj} partidos jugados</span>
          </div>
        </div>

        {rec.pj === 0 ? (
          <div className="card small"><NA>Aún no hay partidos jugados con resultado en la FCF: no hay datos para analizar.</NA>{rec.upcoming.length > 0 && <div className="xs muted" style={{ marginTop: 6 }}>Próximo: J{rec.upcoming[0].round} {rec.upcoming[0].date ? fmtDate(rec.upcoming[0].date) : ''}</div>}</div>
        ) : (
          <>
            <div className="sec-label">Resumen <SrcFcf /></div>
            <div className="stat-grid four">
              <div className="stat-box accent"><div className="sv">{rec.pj}</div><div className="sl">Jugados</div></div>
              <div className="stat-box"><div className="sv" style={{ fontSize: 17, paddingTop: 4 }}>{rec.w}·{rec.d}·{rec.l}</div><div className="sl">G · E · P</div></div>
              <div className="stat-box"><div className="sv">{rec.gf}</div><div className="sl">Goles a favor · {dec(rec.avgGf)}/p</div></div>
              <div className="stat-box"><div className="sv">{rec.ga}</div><div className="sl">Goles en contra · {dec(rec.avgGa)}/p</div></div>
            </div>

            {facts.length > 0 && (
              <>
                <div className="sec-label">Claves</div>
                {facts.map((f) => <div key={f} className="finding info"><Lightbulb className="ico" /><div><div className="fx">{f}</div></div></div>)}
              </>
            )}

            <div className="sec-label">Local y visitante</div>
            <div className="card flush" style={{ overflowX: 'auto' }}>
              <table className="fcf-table">
                <thead><tr><th className="tn"></th><th>PJ</th><th>G</th><th>E</th><th>P</th><th>GF</th><th>GC</th><th>Pts/p</th></tr></thead>
                <tbody>
                  {([['En casa', rec.home], ['Fuera', rec.away]] as const).map(([l, s]) => (
                    <tr key={l}><td className="tn">{l}</td><td>{s.pj}</td><td>{s.w}</td><td>{s.d}</td><td>{s.l}</td><td>{s.gf}</td><td>{s.ga}</td><td>{s.pj ? dec(s.pts / s.pj) : '–'}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="sec-label">Últimos resultados</div>
            <div className="card">
              <div style={{ marginBottom: 10 }}><FormDots res={rec.played.slice(-5).map((p) => p.res)} /></div>
              {[...rec.played].reverse().slice(0, 8).map((p) => (
                <div key={p.acta} className="between small" style={{ padding: '6px 0', borderTop: '1px solid var(--border)' }}>
                  <span><span className="xs muted">J{p.round}{p.date ? ` · ${fmtDate(p.date).slice(0, 5)}` : ''} · {p.home ? 'Casa' : 'Fuera'}</span><br />vs {shortTeamName(p.opp)}</span>
                  <a href={actaUrl(p.acta)} target="_blank" rel="noreferrer" className="bold num" style={{ color: p.res === 'V' ? 'var(--win)' : p.res === 'D' ? 'var(--loss)' : 'var(--text2)' }}>{p.gf} - {p.ga}</a>
                </div>
              ))}
            </div>

            <div className="sec-label">Evolución de goles por jornada</div>
            <div className="card">
              <PairBars items={rec.played.slice(-10).map((p) => ({ label: `J${p.round}`, a: p.gf, b: p.ga }))} aLabel="Marcados" bLabel="Recibidos" />
              {rec.played.length > 10 && <p className="xs muted" style={{ marginTop: 6 }}>Últimas 10 jornadas jugadas de {rec.played.length}.</p>}
            </div>

            {(hist.get(id)?.length ?? 0) > 1 && (
              <>
                <div className="sec-label">Evolución en la clasificación</div>
                <div className="card">
                  <PositionChart maxPos={Math.max(2, hist.size)} label={`Evolución de la posición de ${title}`}
                    series={[
                      { label: title, color: isMe ? 'var(--series-for)' : 'var(--series-against)', points: (hist.get(id) ?? []).map((p) => ({ x: p.round, y: p.pos })) },
                      ...(!isMe ? [{ label: shortTeamName(link.team.label), color: 'var(--series-for)', points: (hist.get(me) ?? []).map((p) => ({ x: p.round, y: p.pos })) }] : []),
                    ]} />
                  <p className="xs muted" style={{ marginTop: 6 }}>Calculada con los resultados publicados; puede diferir de la oficial por sanciones o desempates.</p>
                </div>
              </>
            )}

            <div className="sec-label">Goles por minuto <SrcFcf /></div>
            <div className="card">
              <p className="xs muted" style={{ marginBottom: 8 }}>Minutos sacados de las actas oficiales · partes de {link.halfMins}' · {timing.loaded} de {timing.closed} actas analizadas.</p>
              {missing.length > 0 && timing.loaded > 0 && <p className="xs" style={{ color: 'var(--draw)', marginBottom: 8 }}>Faltan actas por leer: los porcentajes aún no son de toda la temporada.</p>}
              {missing.length > 0 && (
                <button className="btn btn-g btn-sm" style={{ marginBottom: 10 }} disabled={!!progress} onClick={() => void analyseActas()}>
                  <FileSearch className="ico-sm" /> {progress ? `Leyendo actas… ${progress}` : `Analizar ${missing.length} ${missing.length === 1 ? 'acta' : 'actas'}`}
                </button>
              )}
              {timing.loaded === 0 ? <NA>Aún sin analizar: pulsa el botón para leer las actas.</NA> : timedFor + timedAg === 0 ? <NA>Las actas no incluyen minutos de gol.</NA> : (
                <>
                  <div className="xs bold muted" style={{ margin: '4px 0' }}>Por partes</div>
                  <PairBars items={[{ label: '1ª parte', a: timing.forH1, b: timing.agH1 }, { label: '2ª parte', a: timing.forH2, b: timing.agH2 }]} aLabel="Marcados" bLabel="Recibidos" />
                  <div className="small" style={{ margin: '8px 0 12px' }}>
                    Marcados: {timedFor >= MIN_TIMED_GOALS ? <b>{pct(timing.forH1, timedFor)} % / {pct(timing.forH2, timedFor)} %</b> : <NA>{`pocos datos (${timedFor} goles con minuto)`}</NA>}
                    {' · '}Recibidos: {timedAg >= MIN_TIMED_GOALS ? <b>{pct(timing.agH1, timedAg)} % / {pct(timing.agH2, timedAg)} %</b> : <NA>{`pocos datos (${timedAg})`}</NA>}
                  </div>
                  <div className="xs bold muted" style={{ margin: '4px 0' }}>Por tramos</div>
                  <PairBars items={timing.bands.map((b) => ({ label: b.label, a: b.f, b: b.a }))} aLabel="Marcados" bLabel="Recibidos" />
                  {timing.forNoMin + timing.agNoMin > 0 && <p className="xs muted" style={{ marginTop: 6 }}>{timing.forNoMin + timing.agNoMin} goles sin minuto en el acta (no se incluyen).</p>}
                  <div className="xs bold muted" style={{ margin: '12px 0 4px' }}>Jornada a jornada</div>
                  {timing.byMatch.map((m) => (
                    <div key={m.acta} className="small" style={{ padding: '5px 0', borderTop: '1px solid var(--border)' }}>
                      <span className="xs muted">J{m.round} vs {shortTeamName(m.opp)}: </span>
                      {m.f.length ? <span style={{ color: 'var(--series-for)' }}>⚽ {m.f.map((x) => `${x}'`).join(', ')}</span> : <span className="xs muted">sin goles</span>}
                      {m.a.length > 0 && <span style={{ color: 'var(--series-against)' }}> · recibidos {m.a.map((x) => `${x}'`).join(', ')}</span>}
                    </div>
                  ))}
                </>
              )}
            </div>

            <div className="sec-label">Goleadores <SrcFcf /></div>
            <div className="card">
              {!scorers.list.length ? <NA>{scorers.maybeIncomplete ? 'Ningún jugador entre los 50 máximos goleadores del grupo' : 'La FCF no publica goleadores de este equipo'}</NA> : scorers.list.map((s) => (
                <div key={s.playerId} style={{ marginBottom: 10 }}>
                  <div className="between small"><span className="bold">{s.name}</span><span className="num"><b>{s.goals}</b> goles · {Math.round(s.share)} %</span></div>
                  <div className="prog-wrap"><div className="prog" style={{ width: `${Math.min(100, s.share)}%` }} /></div>
                  <div className="xs muted">{s.matches} partidos{s.penalties ? ` · ${s.penalties} de penalti` : ''}</div>
                </div>
              ))}
              {scorers.maybeIncomplete && scorers.list.length > 0 && <p className="xs muted">% sobre los {rec.gf} goles del equipo. La FCF solo publica los 50 máximos goleadores del grupo, así que puede faltar alguno.</p>}
            </div>

            {!isMe && ours.pj > 0 && (
              <>
                <div className="sec-label">Comparativa</div>
                <div className="card">
                  <div className="between xs bold" style={{ marginBottom: 4 }}>
                    <span style={{ color: 'var(--series-for)' }}>{shortTeamName(link.team.label)}</span>
                    <span style={{ color: 'var(--series-against)' }}>{title}</span>
                  </div>
                  <CompareRow label="Puntos/partido" a={ours.pts / ours.pj} b={rec.pts / rec.pj} fmt={(v) => dec(v, 2)} />
                  <CompareRow label="% victorias" a={pct(ours.w, ours.pj)} b={pct(rec.w, rec.pj)} fmt={(v) => `${v}%`} />
                  <CompareRow label="Goles a favor/p" a={ours.avgGf} b={rec.avgGf} fmt={(v) => dec(v)} />
                  <CompareRow label="Goles en contra/p" a={ours.avgGa} b={rec.avgGa} fmt={(v) => dec(v)} lowerIsBetter />
                  <CompareRow label="Porterías a cero" a={ours.played.filter((p) => p.ga === 0).length} b={rec.played.filter((p) => p.ga === 0).length} />
                  <CompareRow label="Pts/p en casa" a={ours.home.pj ? ours.home.pts / ours.home.pj : 0} b={rec.home.pj ? rec.home.pts / rec.home.pj : 0} fmt={(v) => dec(v)} />
                  <CompareRow label="Pts/p fuera" a={ours.away.pj ? ours.away.pts / ours.away.pj : 0} b={rec.away.pj ? rec.away.pts / rec.away.pj : 0} fmt={(v) => dec(v)} />
                  {(ours.pj < MIN_MATCHES || rec.pj < MIN_MATCHES) && <p className="xs muted" style={{ marginTop: 6 }}>Con menos de {MIN_MATCHES} partidos la comparación es poco representativa.</p>}
                </div>
                <div className="sec-label">Enfrentamientos en esta competición</div>
                <div className="card">
                  {!h2h.length ? <NA>Todavía no os habéis enfrentado</NA> : h2h.map((p) => (
                    <div key={p.acta} className="between small" style={{ padding: '4px 0' }}>
                      <span>J{p.round} · {p.home ? 'En casa' : 'Fuera'}</span>
                      <a href={actaUrl(p.acta)} target="_blank" rel="noreferrer" className="bold">{p.gf} - {p.ga}</a>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
        <p className="hint" style={{ padding: '8px var(--pad)' }}><a className="link" href={actaUrl(rec.played.at(-1)?.acta ?? '')} target="_blank" rel="noreferrer" style={{ display: rec.played.length ? undefined : 'none' }}><ExternalLink className="ico-sm" /> Ver última acta en la FCF</a></p>
        <div className="spacer" />
      </div>
    </div>
  );
}
