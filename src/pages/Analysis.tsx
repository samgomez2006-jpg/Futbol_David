import { Empty, Progress, Rich, TopBar } from '../components/bits';
import { FIELD_ZONES } from '../lib/constants';
import { activePlayers, analyse, playerStats } from '../lib/stats';
import { useStore } from '../store/store';

function TimeChart({ scored, conceded, labels }: { scored: number[]; conceded: number[]; labels: string[] }) {
  const max = Math.max(...scored, ...conceded, 1);
  const bar = (v: number, color: string, what: string, lbl: string) => (
    <div className="chart-bar" title={`${lbl}: ${v} ${what}`} aria-label={`${lbl}: ${v} ${what}`} role="img">
      {v > 0 && <b>{v}</b>}
      <i style={{ height: `${(v / max) * 82}%`, background: color }} />
    </div>
  );
  return (
    <>
      <div className="chart">
        {labels.map((l, i) => (
          <div className="chart-col" key={l}>
            {bar(scored[i], 'var(--series-for)', 'goles a favor', l)}
            {bar(conceded[i], 'var(--series-against)', 'goles en contra', l)}
          </div>
        ))}
      </div>
      <div className="chart-x">{labels.map((l) => <span key={l}>{l}</span>)}</div>
      <div className="legend">
        <span><i className="swatch" style={{ background: 'var(--series-for)' }} />A favor</span>
        <span><i className="swatch" style={{ background: 'var(--series-against)' }} />En contra</span>
      </div>
    </>
  );
}

export default function Analysis() {
  const data = useStore((s) => s.data);
  const a = analyse(data);
  if (!a.total)
    return (
      <div className="page">
        <TopBar title="Análisis" subtitle="Estadísticas del equipo" />
        <Empty icon="📊">Registra partidos para ver<br />estadísticas y análisis automáticos.</Empty>
      </div>
    );

  const { summary: s } = a;
  const players = activePlayers(data).map((p) => ({ p, s: playerStats(data, p.id) }));
  const scorers = players.filter((x) => x.s.goals > 0).sort((x, y) => y.s.goals - x.s.goals).slice(0, 5);
  const assisters = players.filter((x) => x.s.assists > 0).sort((x, y) => y.s.assists - x.s.assists).slice(0, 5);
  const minutes = players.filter((x) => x.s.mins > 0).sort((x, y) => y.s.mins - x.s.mins).slice(0, 8);
  const totalGoals = a.goalTypes.reduce((t, [, n]) => t + n, 0);
  const zones = FIELD_ZONES.filter((z) => a.fzScored[z] || a.fzConceded[z]);

  return (
    <div className="page">
      <TopBar title="Análisis" subtitle={`${a.total} partidos analizados`} />
      <div className="page-inner">
        <div className="stat-grid four">
          <div className="stat-box accent"><div className="sv">{a.winPct}%</div><div className="sl">Victorias</div></div>
          <div className="stat-box"><div className="sv">{s.gf - s.ga > 0 ? '+' : ''}{s.gf - s.ga}</div><div className="sl">Dif. goles</div></div>
          <div className="stat-box"><div className="sv">{(s.gf / a.total).toFixed(1)}</div><div className="sl">GF / partido</div></div>
          <div className="stat-box"><div className="sv">{(s.ga / a.total).toFixed(1)}</div><div className="sl">GC / partido</div></div>
          <div className="stat-box gold"><div className="sv">{s.cleanSheets}</div><div className="sl">Porterías a cero</div></div>
          <div className="stat-box"><div className="sv">{(s.pts / a.total).toFixed(2)}</div><div className="sl">Puntos / partido</div></div>
        </div>

        {a.insights.length > 0 ? (
          <>
            <div className="sec-label">💡 Análisis automático</div>
            {a.insights.map((t, i) => <div className="card insight" key={i}><p><Rich text={t} /></p></div>)}
          </>
        ) : a.total < 3 && <p className="hint" style={{ paddingTop: 8 }}>El análisis automático aparece a partir de 3 partidos.</p>}

        <div className="sec-label">Goles por tramo del partido</div>
        <div className="card">
          <TimeChart scored={a.slots.scored} conceded={a.slots.conceded} labels={a.slots.labels} />
          <p className="xs muted" style={{ textAlign: 'center', marginTop: 6 }}>Tramos proporcionales a la duración de cada partido (referencia {a.slots.typical}').</p>
        </div>

        <div className="sec-label">Local vs visitante</div>
        <div className="card flush">
          <div className="srow"><span className="srl">🏠 Local ({a.local.n})</span><span className="srv">{a.local.w}V {a.local.e}E {a.local.d}D</span></div>
          <div className="srow"><span className="srl">✈️ Visitante ({a.visit.n})</span><span className="srv">{a.visit.w}V {a.visit.e}E {a.visit.d}D</span></div>
        </div>

        {zones.length > 0 && (
          <>
            <div className="sec-label">🗺️ Zonas de los goles</div>
            <div className="card">
              <div className="zone-grid">
                {zones.map((z) => (
                  <div className="zone" key={z}>
                    <div className="zt">{z}</div>
                    <div className="zn"><i className="swatch" style={{ background: 'var(--series-for)' }} />{a.fzScored[z] ?? 0}</div>
                    <div className="zl">a favor</div>
                    <div className="zn"><i className="swatch" style={{ background: 'var(--series-against)' }} />{a.fzConceded[z] ?? 0}</div>
                    <div className="zl">en contra</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {a.goalTypes.length > 0 && (
          <>
            <div className="sec-label">Origen de los goles a favor</div>
            <div className="card flush">
              {a.goalTypes.slice(0, 6).map(([t, n]) => (
                <div className="srow" key={t}>
                  <span className="srl">{t}</span>
                  <div className="row-flex"><div style={{ width: 70 }}><Progress pct={(n / totalGoals) * 100} /></div><span className="srv" style={{ minWidth: 22, textAlign: 'right' }}>{n}</span></div>
                </div>
              ))}
            </div>
          </>
        )}
        {a.concededTypes.length > 0 && (
          <>
            <div className="sec-label">Origen de los goles en contra</div>
            <div className="card flush">
              {a.concededTypes.slice(0, 6).map(([t, n]) => (
                <div className="srow" key={t}><span className="srl">{t}</span><span className="srv">{n}</span></div>
              ))}
            </div>
          </>
        )}
        {a.bodyParts.length > 0 && (
          <>
            <div className="sec-label">Parte del cuerpo</div>
            <div className="card" style={{ display: 'flex', justifyContent: 'space-around' }}>
              {a.bodyParts.map(([k, v]) => (
                <div key={k} style={{ textAlign: 'center' }}><div className="bold num" style={{ fontSize: 20 }}>{v}</div><div className="xs muted">{k}</div></div>
              ))}
            </div>
          </>
        )}
        {a.tactics.length > 0 && (
          <>
            <div className="sec-label">Rendimiento por formación</div>
            <div className="card flush">
              {a.tactics.map((t) => (
                <div className="srow" key={t.tactic}>
                  <span className="srl bold" style={{ color: 'var(--text)' }}>{t.tactic}</span>
                  <div style={{ textAlign: 'right' }}>
                    <div className="small bold">{(t.pts / t.played).toFixed(2)} pts/partido</div>
                    <div className="xs muted">{t.played} PJ · {t.w}V · {t.gf}-{t.ga}</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
        {scorers.length > 0 && <Ranking title="Goleadores" rows={scorers.map((x) => [x.p.name, x.s.goals])} unit="⚽" />}
        {assisters.length > 0 && <Ranking title="Asistencias" rows={assisters.map((x) => [x.p.name, x.s.assists])} unit="🅰️" tone="blue" />}
        {minutes.length > 0 && <Ranking title="Minutos jugados" rows={minutes.map((x) => [x.p.name, x.s.mins])} unit="'" tone="gold" />}
        <div className="spacer" />
      </div>
    </div>
  );
}

function Ranking({ title, rows, unit, tone }: { title: string; rows: [string, number][]; unit: string; tone?: 'blue' | 'gold' }) {
  const max = rows[0]?.[1] || 1;
  return (
    <>
      <div className="sec-label">{title}</div>
      <div className="card flush">
        {rows.map(([n, v], i) => (
          <div className="srow" key={n + i}>
            <span className="srl"><span style={{ color: 'var(--text3)' }}>{i + 1}.</span> {n}</span>
            <div className="row-flex"><div style={{ width: 70 }}><Progress pct={(v / max) * 100} tone={tone} /></div><span className="srv" style={{ minWidth: 44, textAlign: 'right' }}>{v}{unit === "'" ? "'" : ` ${unit}`}</span></div>
          </div>
        ))}
      </div>
    </>
  );
}
