import { BarChart3, Lightbulb, MessageSquareText, TrendingUp, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { Empty, Progress, TopBar } from '../components/bits';
import { PairBars } from '../components/Charts';
import { ExportButton } from '../components/ExportButton';
import { ZoneBubbleMap } from '../components/Zones';
import { analyse, fmtPct, type Analysis, type Finding, type ZoneAnalysis } from '../lib/analytics';
import { fmtDate } from '../lib/dates';
import { MIN_OBSERVED } from '../lib/patterns';
import { activePlayers, playerStats } from '../lib/stats';
import { MIN_ZONE_GOALS } from '../lib/zones';
import { useStore } from '../store/store';

const ICON = { warn: TriangleAlert, good: TrendingUp, info: Lightbulb } as const;

function FindingCard({ f }: { f: Finding }) {
  const Icon = ICON[f.level];
  return (
    <div className={`finding ${f.level}`}>
      <Icon className="ico" />
      <div><div className="fa">{f.area}</div><div className="ft">{f.title}</div><div className="fx">{f.text}</div></div>
    </div>
  );
}

function ZoneCard({ title, sub, tone, a }: { title: string; sub: string; tone: 'for' | 'against'; a: ZoneAnalysis }) {
  const [sel, setSel] = useState<string | null>(a.ranking[0]?.id ?? null);
  const z = sel ? a.zones[sel] : null;
  const color = tone === 'for' ? 'var(--series-for)' : 'var(--series-against)';
  const byMatch = z ? [...new Map(z.items.map((i) => [i.matchId, { ...i, mins: [] as (number | null)[] }])).values()].map((m) => ({ ...m, mins: z.items.filter((i) => i.matchId === m.matchId).map((i) => i.min) })) : [];
  const types = z ? Object.entries(z.items.reduce<Record<string, number>>((acc, i) => ((acc[i.gtype || 'Sin tipo'] = (acc[i.gtype || 'Sin tipo'] ?? 0) + 1), acc), {})).sort((x, y) => y[1] - x[1]) : [];
  return (
    <div className="card">
      <div className="between" style={{ marginBottom: 2 }}>
        <div className="bold" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><i className="swatch" style={{ background: color }} />{title}</div>
        <span className="xs muted num">{a.withZone} con zona{a.noZone ? ` · ${a.noZone} sin zona` : ''}</span>
      </div>
      <p className="xs muted" style={{ marginBottom: 8 }}>{sub}</p>
      <ZoneBubbleMap analysis={a} tone={tone} selected={sel} onSelect={setSel} />
      {!a.withZone ? (
        <div className="notice-empty">Todavía no hay goles con zona registrada. Al añadir un gol en un partido, toca la zona del campo desde la que se produjo.</div>
      ) : !a.enough ? (
        <div className="notice-empty">Todavía no hay suficientes registros para sacar conclusiones ({a.withZone} de {MIN_ZONE_GOALS} goles con zona). El mapa se irá completando.</div>
      ) : null}
      {z && (
        <div className="zone-detail" aria-live="polite">
          <h4>{z.label}</h4>
          {z.goals === 0 ? <p className="xs muted" style={{ marginTop: 4 }}>Ningún gol registrado desde esta zona.</p> : (
            <>
              <p className="small" style={{ marginTop: 2 }}><b className="num">{z.goals}</b> {z.goals === 1 ? 'gol' : 'goles'} · <b className="num">{fmtPct(z.pct, 1)}</b> de los {a.withZone} con zona</p>
              <div className="zg">
                {byMatch.slice(0, 6).map((m) => (
                  <div key={m.matchId}>
                    <span className="ev-min" style={{ minWidth: 0 }}>{fmtDate(m.date).slice(0, 5)}</span>
                    <Link to={`/partidos/${m.matchId}`} style={{ color: 'var(--accent-d)', fontWeight: 600 }}>vs {m.rival}</Link>
                    <span className="muted">{m.mins.map((x) => (x != null ? `${x}'` : '?')).join(', ')}</span>
                  </div>
                ))}
                {byMatch.length > 6 && <span className="xs muted">y {byMatch.length - 6} partidos más</span>}
              </div>
              <div className="chips" style={{ marginTop: 8 }}>{types.map(([t, n]) => <span key={t} className="badge b-gray">{t} · {n}</span>)}</div>
              {a.matchesWithGoals >= 4 && z.goals >= 2 && <p className="xs muted" style={{ marginTop: 8 }}>Evolución: {z.earlier} en la 1ª mitad de la temporada → {z.recent} en la 2ª{z.recent > z.earlier ? ' (al alza)' : z.recent < z.earlier ? ' (a la baja)' : ''}.</p>}
            </>
          )}
        </div>
      )}
      {a.ranking.length > 0 && (
        <div style={{ marginTop: 12 }}>
          {a.ranking.slice(0, 5).map((r) => (
            <button key={r.id} className="srow" style={{ width: '100%', background: 'none', border: 'none', padding: '7px 0', borderBottom: 'none' }} onClick={() => setSel(r.id)} aria-pressed={sel === r.id}>
              <span className="srl" style={{ fontWeight: sel === r.id ? 700 : 400, color: sel === r.id ? 'var(--text)' : undefined }}>{r.label}</span>
              <span className="row-flex"><span style={{ width: 70 }}><Progress pct={r.pct} tone={tone === 'for' ? 'blue' : 'gold'} /></span><span className="srv num" style={{ minWidth: 60, textAlign: 'right' }}>{r.goals} · {fmtPct(r.pct)}</span></span>
            </button>
          ))}
          {a.enough && a.ranking.length >= 3 && <p className="xs muted" style={{ marginTop: 6 }}>Las 3 zonas principales concentran el {fmtPct(a.ranking.slice(0, 3).reduce((x, r) => x + r.pct, 0))} de los goles.</p>}
        </div>
      )}
    </div>
  );
}

function Ranking({ title, rows, unit }: { title: string; rows: [string, number][]; unit: string }) {
  const max = rows[0]?.[1] || 1;
  return (
    <>
      <div className="sec-label">{title}</div>
      <div className="card flush">
        {rows.map(([n, v], i) => (
          <div className="srow" key={n + i}>
            <span className="srl"><span style={{ color: 'var(--text3)' }}>{i + 1}.</span> {n}</span>
            <div className="row-flex"><div style={{ width: 70 }}><Progress pct={(v / max) * 100} /></div><span className="srv num" style={{ minWidth: 44, textAlign: 'right' }}>{v}{unit}</span></div>
          </div>
        ))}
      </div>
    </>
  );
}

export default function Analytics() {
  const data = useStore((s) => s.data);
  const a: Analysis = analyse(data);

  if (!a.total)
    return (
      <div className="page">
        <TopBar title="Analíticas" subtitle="Estadísticas y tendencias del equipo" />
        <Empty icon={BarChart3}>Registra partidos jugados para ver estadísticas,<br />mapas de zonas de gol y tendencias.</Empty>
      </div>
    );

  const { summary: s } = a;
  const players = activePlayers(data).map((p) => ({ p, s: playerStats(data, p.id) }));
  const scorers = players.filter((x) => x.s.goals > 0).sort((x, y) => y.s.goals - x.s.goals).slice(0, 5);
  const assisters = players.filter((x) => x.s.assists > 0).sort((x, y) => y.s.assists - x.s.assists).slice(0, 5);
  const evo = a.series.slice(-10);
  const h = a.halves;
  const known = h.gfH1 + h.gfH2 + h.gaH1 + h.gaH2;

  return (
    <div className="page">
      <TopBar title="Analíticas" subtitle={`${a.total} partidos jugados analizados`} right={<ExportButton scope="analiticas" title="Exportar analíticas" />} />
      <div className="page-inner">
        <div className="stat-grid four">
          <div className="stat-box accent"><div className="sv">{a.winPct}%</div><div className="sl">Victorias</div></div>
          <div className="stat-box"><div className="sv">{s.gf - s.ga > 0 ? '+' : ''}{s.gf - s.ga}</div><div className="sl">Dif. de goles</div></div>
          <div className="stat-box"><div className="sv">{(s.gf / a.total).toFixed(1)}</div><div className="sl">GF / partido</div></div>
          <div className="stat-box"><div className="sv">{(s.ga / a.total).toFixed(1)}</div><div className="sl">GC / partido</div></div>
          <div className="stat-box"><div className="sv">{a.ppg.toFixed(2)}</div><div className="sl">Puntos / partido</div></div>
          <div className="stat-box"><div className="sv">{s.cleanSheets}</div><div className="sl">Porterías a cero</div></div>
          <div className="stat-box"><div className="sv">{a.csPct}%</div><div className="sl">% a cero</div></div>
          <div className="stat-box"><div className="sv">{s.pts}</div><div className="sl">Puntos</div></div>
        </div>

        <div className="sec-label">Hallazgos</div>
        {a.findings.length ? a.findings.map((f) => <FindingCard key={f.id} f={f} />) : <p className="hint">{a.total < 3 ? 'Los hallazgos automáticos aparecen a partir de 3 partidos jugados.' : 'No se detectan diferencias significativas por ahora.'}</p>}

        <div className="sec-label">Mapas de goles por zona</div>
        <ZoneCard title="Goles realizados" sub="Zona desde la que marcamos (portería rival arriba). Toca una zona para ver el detalle." tone="for" a={a.zonesFor} />
        <ZoneCard title="Goles recibidos" sub="Zona desde la que nos marcan (nuestra portería arriba). Misma división del campo." tone="against" a={a.zonesAgainst} />

        <div className="sec-label">Primera y segunda parte</div>
        <div className="card">
          {known > 0 ? (
            <>
              <PairBars items={[{ label: '1ª parte', a: h.gfH1, b: h.gaH1 }, { label: '2ª parte', a: h.gfH2, b: h.gaH2 }]} />
              {h.unknown > 0 && <p className="xs muted" style={{ textAlign: 'center', marginTop: 6 }}>{h.unknown} goles sin minuto no se reparten.</p>}
            </>
          ) : <div className="notice-empty">Añade el minuto de los goles para ver cómo se reparten por partes.</div>}
        </div>

        <div className="sec-label">Evolución por partido</div>
        <div className="card">
          <PairBars items={evo.map((e) => ({ label: fmtDate(e.date).slice(0, 5), a: e.gf, b: e.ga }))} aLabel="Goles a favor" bLabel="Goles en contra" />
          <div className="between" style={{ marginTop: 12 }}>
            <span className="xs muted">Resultados (antiguo → reciente)</span>
            <div className="form-strip">{evo.map((e) => <span key={e.id} className={`form-dot ${e.res}`} title={`${e.rival} ${e.gf}-${e.ga}`}>{e.res === 'V' ? 'G' : e.res === 'E' ? 'E' : 'P'}</span>)}</div>
          </div>
          <details style={{ marginTop: 10 }}>
            <summary className="xs muted" style={{ cursor: 'pointer' }}>Ver datos en tabla</summary>
            <table style={{ width: '100%', fontSize: 12.5, marginTop: 8, borderCollapse: 'collapse' }}>
              <thead><tr style={{ textAlign: 'left', color: 'var(--text3)' }}><th>Fecha</th><th>Rival</th><th style={{ textAlign: 'right' }}>Resultado</th></tr></thead>
              <tbody>{[...a.series].reverse().map((e) => <tr key={e.id}><td>{fmtDate(e.date)}</td><td>{e.rival}</td><td className="num" style={{ textAlign: 'right' }}>{e.gf}–{e.ga}</td></tr>)}</tbody>
            </table>
          </details>
        </div>

        <div className="sec-label">Minutos y carga</div>
        <div className="card flush">
          {a.loads.filter((l) => l.mins > 0 || l.matches > 0).length === 0 ? <div className="notice-empty" style={{ margin: 12 }}>Registra las alineaciones para ver los minutos jugados.</div> : a.loads.slice(0, 16).map((l) => (
            <div className="load-row" key={l.pid}>
              <div style={{ minWidth: 0 }}>
                <div className="rn">{l.number != null ? `${l.number}. ` : ''}{l.name}</div>
                <div className="xs muted">{l.matches} PJ{l.level === 'alta' ? ' · carga alta' : l.level === 'baja' ? ' · poca participación' : ''}</div>
              </div>
              <Progress pct={l.pct} tone={l.level === 'alta' ? 'gold' : l.level === 'baja' ? 'red' : undefined} />
              <span className="srv num" style={{ textAlign: 'right' }}>{l.mins}'</span>
            </div>
          ))}
        </div>

        <div className="sec-label">Patrones en tus observaciones</div>
        <div className="card">
          <div className="row-flex" style={{ marginBottom: 8 }}><MessageSquareText className="ico" style={{ color: 'var(--accent-d)' }} /><span className="small muted">Detectados en las observaciones e incidencias que escribes. Son <b>tendencias</b> según lo registrado, no conclusiones absolutas.</span></div>
          {a.observed < MIN_OBSERVED ? (
            <div className="notice-empty">Escribe observaciones en al menos {MIN_OBSERVED} partidos para detectar patrones (llevas {a.observed}).</div>
          ) : !a.patterns.length ? (
            <div className="notice-empty">Por ahora ningún aspecto se repite en dos o más partidos.</div>
          ) : a.patterns.map((p) => (
            <details key={p.id} style={{ borderTop: '1px solid var(--border)', padding: '10px 0' }}>
              <summary style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, listStyle: 'none' }}>
                <span className="bold grow small">{p.label}</span>
                <span className={`badge ${p.tone === 'negativo' ? 'b-red' : p.tone === 'positivo' ? 'b-green' : 'b-gray'}`}>{p.tone === 'negativo' ? 'Mejorable' : p.tone === 'positivo' ? 'Positivo' : 'Se menciona'}</span>
                <span className="xs muted num">{p.matches}/{p.observed}</span>
              </summary>
              <div className="xs muted" style={{ margin: '6px 0' }}>{p.area} · aparece en {p.matches} de {p.observed} partidos con observaciones ({fmtPct((p.matches / p.observed) * 100)}).</div>
              {p.examples.map((e) => <div key={e.matchId} className="xs" style={{ marginBottom: 4 }}><Link to={`/partidos/${e.matchId}`} style={{ color: 'var(--accent-d)', fontWeight: 600 }}>vs {e.rival} ({fmtDate(e.date).slice(0, 5)})</Link>: «{e.text}»</div>)}
            </details>
          ))}
        </div>

        {(a.goalTypes.scored.length > 0 || a.goalTypes.conceded.length > 0) && (
          <>
            <div className="sec-label">Tipos de gol</div>
            <div className="card">
              {[['A favor', a.goalTypes.scored, 'blue'], ['En contra', a.goalTypes.conceded, 'gold']].map(([label, list, tone]) => (list as [string, number][]).length > 0 && (
                <div key={label as string} style={{ marginBottom: 10 }}>
                  <div className="xs muted bold" style={{ marginBottom: 4 }}>{label as string}</div>
                  {(list as [string, number][]).slice(0, 5).map(([t, n]) => (
                    <div className="srow" key={t} style={{ padding: '5px 0', border: 'none' }}><span className="srl">{t}</span><div className="row-flex"><div style={{ width: 70 }}><Progress pct={(n / (list as [string, number][])[0][1]) * 100} tone={tone as 'blue' | 'gold'} /></div><span className="srv num" style={{ minWidth: 22, textAlign: 'right' }}>{n}</span></div></div>
                  ))}
                </div>
              ))}
            </div>
          </>
        )}

        <div className="sec-label">Local y visitante</div>
        <div className="card flush">
          <div className="srow"><span className="srl">Local ({a.local.n})</span><span className="srv">{a.local.w}G {a.local.e}E {a.local.d}P</span></div>
          <div className="srow"><span className="srl">Visitante ({a.visit.n})</span><span className="srv">{a.visit.w}G {a.visit.e}E {a.visit.d}P</span></div>
        </div>

        {a.tactics.length > 0 && (
          <>
            <div className="sec-label">Rendimiento por sistema</div>
            <div className="card flush">
              {a.tactics.map((t) => (
                <div className="srow" key={t.tactic}>
                  <span className="srl bold" style={{ color: 'var(--text)' }}>{t.tactic}</span>
                  <div style={{ textAlign: 'right' }}><div className="small bold num">{(t.pts / t.played).toFixed(2)} pts/partido</div><div className="xs muted">{t.played} PJ · {t.w}G · {t.gf}-{t.ga}</div></div>
                </div>
              ))}
            </div>
          </>
        )}
        {scorers.length > 0 && <Ranking title="Goleadores" rows={scorers.map((x) => [x.p.name, x.s.goals])} unit=" ⚽" />}
        {assisters.length > 0 && <Ranking title="Asistencias" rows={assisters.map((x) => [x.p.name, x.s.assists])} unit=" 🅰" />}
        <div className="spacer" />
      </div>
    </div>
  );
}
