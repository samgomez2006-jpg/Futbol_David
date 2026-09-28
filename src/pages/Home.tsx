import { Link, useNavigate } from 'react-router';
import { Empty, ResultBadge, resultColor, TopBar } from '../components/bits';
import { SyncPill } from '../components/SyncPill';
import { fmtDate, compareDateDesc, todayISO } from '../lib/dates';
import { activeMatches, activePlayers, playerStats, resultOf, teamSummary } from '../lib/stats';
import { useStore } from '../store/store';
import { openSheet } from '../store/ui';

export default function Home() {
  const team = useStore((s) => s.team);
  const data = useStore((s) => s.data);
  const nav = useNavigate();
  const ms = activeMatches(data);
  const sum = teamSummary(ms);
  const recent = [...ms].sort(compareDateDesc).slice(0, 5);
  const players = activePlayers(data);
  const top = players
    .map((p) => ({ p, s: playerStats(data, p.id) }))
    .sort((a, b) => b.s.goals - a.s.goals || b.s.assists - a.s.assists)[0];
  const nextCallup = [...data.callups].filter((c) => c.date >= todayISO()).sort((a, b) => (a.date < b.date ? -1 : 1))[0];

  return (
    <div className="page">
      <TopBar
        title={team.name}
        subtitle={[team.season, team.category].filter(Boolean).join(' · ') || ' '}
        right={
          <div className="row-flex">
            <SyncPill />
            <button className="btn btn-g btn-sm" onClick={() => openSheet({ kind: 'settings' })} aria-label="Configuración">⚙️</button>
          </div>
        }
      />
      <div className="page-inner">
        <div className="stat-grid four">
          <div className="stat-box gold"><div className="sv">{sum.pts}</div><div className="sl">Puntos</div></div>
          <div className="stat-box"><div className="sv" style={{ fontSize: 17 }}>{sum.w}V {sum.dr}E {sum.l}D</div><div className="sl">Resultados</div></div>
          <div className="stat-box accent"><div className="sv">{sum.gf}</div><div className="sl">Goles a favor</div></div>
          <div className="stat-box red"><div className="sv">{sum.ga}</div><div className="sl">Goles en contra</div></div>
        </div>

        {sum.streak && sum.streak.count > 1 && (
          <div className="card row-flex">
            <span style={{ fontSize: 28 }} aria-hidden>{sum.streak.type === 'V' ? '🔥' : sum.streak.type === 'E' ? '🤝' : '❄️'}</span>
            <div>
              <div className="bold">{sum.streak.count} {{ V: 'victorias', E: 'empates', D: 'derrotas' }[sum.streak.type]} seguidas</div>
              <div className="xs muted">Racha actual del equipo</div>
            </div>
          </div>
        )}

        {nextCallup && (
          <Link to="/tactico/convocatorias" className="card row-flex" style={{ textDecoration: 'none', color: 'inherit' }}>
            <span style={{ fontSize: 26 }} aria-hidden>📣</span>
            <div className="ri">
              <div className="bold">Próximo: vs {nextCallup.rival}</div>
              <div className="xs muted">
                {fmtDate(nextCallup.date)}{nextCallup.meet_time ? ` · ${nextCallup.meet_time}` : ''} · {nextCallup.players.filter((x) => x.status === 'confirmed').length} convocados
              </div>
            </div>
          </Link>
        )}

        <div className="sec-label">Acciones rápidas</div>
        <div className="qa-grid">
          <button className="qa-btn" onClick={() => openSheet({ kind: 'training' })}><span className="qa-ico">📋</span><span className="qa-lbl">Entrenamiento</span><span className="qa-sub">Pasar lista</span></button>
          <button className="qa-btn" onClick={() => openSheet({ kind: 'match' })}><span className="qa-ico">🏟️</span><span className="qa-lbl">Partido</span><span className="qa-sub">Añadir resultado</span></button>
          <button className="qa-btn" onClick={() => openSheet({ kind: 'player' })}><span className="qa-ico">👤</span><span className="qa-lbl">Jugador</span><span className="qa-sub">Añadir a plantilla</span></button>
          <button className="qa-btn" onClick={() => openSheet({ kind: 'callup' })}><span className="qa-ico">📝</span><span className="qa-lbl">Convocatoria</span><span className="qa-sub">Citar jugadores</span></button>
        </div>

        {!players.length && !ms.length && (
          <Empty icon="⚽" action={<button className="btn btn-p" onClick={() => openSheet({ kind: 'player' })}>Añadir primer jugador</button>}>
            Bienvenido. Empieza creando tu plantilla;<br />después registra entrenamientos y partidos.
          </Empty>
        )}

        {recent.length > 0 && (
          <>
            <div className="sec-label">Últimos partidos <Link to="/partidos" className="xs" style={{ color: 'var(--accent)', textTransform: 'none', letterSpacing: 0 }}>Ver todos</Link></div>
            <div className="card flush">
              {recent.map((m) => (
                <button key={m.id} className="row" onClick={() => nav(`/partidos/${m.id}`)}>
                  <div className="avatar score num" style={{ color: resultColor[resultOf(m)] }}>{m.gf}-{m.ga}</div>
                  <div className="ri"><div className="rn">vs {m.rival}</div><div className="rm">{fmtDate(m.date)} · {m.tactic || '—'}</div></div>
                  <ResultBadge m={m} />
                </button>
              ))}
            </div>
          </>
        )}

        {top && top.s.goals > 0 && (
          <>
            <div className="sec-label">Máximo goleador</div>
            <button className="card row-flex" style={{ width: 'calc(100% - 2 * var(--pad))', textAlign: 'left' }} onClick={() => nav(`/plantilla/${top.p.id}`)}>
              <span style={{ fontSize: 32 }} aria-hidden>🥇</span>
              <div><div className="bold">{top.p.name}</div><div className="small muted">{top.s.goals} goles · {top.s.assists} asistencias</div></div>
            </button>
          </>
        )}
        <div className="spacer" />
      </div>
    </div>
  );
}
