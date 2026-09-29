import { BarChart3, CalendarPlus, CalendarDays, ChevronRight, ClipboardCheck, ClipboardList, Dumbbell, LayoutTemplate, Lightbulb, MapPin, PenTool, Route, Settings, Shield, Star, Target, TriangleAlert, Trophy, UserPlus, Users } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { Empty, FormStrip, IconBadge, ResultBadge, TopBar } from '../components/bits';
import { SyncPill } from '../components/SyncPill';
import { analyse } from '../lib/analytics';
import { daysUntil, fmtDate, fmtWeekday } from '../lib/dates';
import { activePlayers, callupOfMatch, lastPlayed, nextMatch, playedMatches, playerStats, squadOf, teamSummary } from '../lib/stats';
import { useStore } from '../store/store';
import { openSheet } from '../store/ui';

export default function Home() {
  const team = useStore((s) => s.team);
  const data = useStore((s) => s.data);
  const nav = useNavigate();
  const played = playedMatches(data);
  const sum = teamSummary(played);
  const next = nextMatch(data);
  const last = lastPlayed(data);
  const players = activePlayers(data);
  const callup = next ? callupOfMatch(data, next) : undefined;
  const squad = next ? squadOf(data, next) : null;
  const top = players.map((p) => ({ p, s: playerStats(data, p.id) })).sort((a, b) => b.s.goals - a.s.goals || b.s.assists - a.s.assists)[0];
  const findings = played.length >= 3 ? analyse(data).findings.slice(0, 2) : [];
  const profile = team.profile;
  const days = next ? daysUntil(next.date) : null;
  const when = days == null ? '' : days === 0 ? 'Hoy' : days === 1 ? 'Mañana' : days > 1 ? `En ${days} días` : `Hace ${-days} días`;

  const tools: { icon: typeof Route; title: string; sub: string; to: string; primary?: boolean }[] = [
    { icon: PenTool, title: 'Pizarra táctica', sub: 'Jugadas y ejercicios', to: '/pizarra', primary: true },
    { icon: Route, title: 'Mis jugadas', sub: `${data.plays.length} guardadas`, to: '/jugadas' },
    { icon: LayoutTemplate, title: 'Alineaciones', sub: 'Histórico y sistemas', to: '/alineaciones' },
    { icon: Star, title: 'Evaluaciones', sub: `${data.evaluations.length} registradas`, to: '/evaluaciones' },
    { icon: Target, title: 'Objetivos', sub: `${data.objectives.length} definidos`, to: '/objetivos' },
    { icon: ClipboardCheck, title: 'Convocatorias', sub: 'Y asistencia', to: '/asistencia' },
  ];

  return (
    <div className="page">
      <TopBar
        title={team.name}
        subtitle={[team.season, team.category].filter(Boolean).join(' · ') || ' '}
        right={
          <div className="row-flex">
            <SyncPill />
            <Link to="/equipo" className="icon-btn" aria-label="Equipo y ajustes"><Settings className="ico" /></Link>
          </div>
        }
      />
      <div className="page-inner">
        {/* Próximo partido */}
        {next ? (
          <div className="hero">
            <div className="eyebrow"><CalendarDays className="ico-sm" /> Próximo partido{when && <> · {when}</>}</div>
            <h2>{next.venue === 'L' ? `${team.name} vs ${next.rival}` : `${next.rival} vs ${team.name}`}</h2>
            <div className="meta">
              <span><CalendarDays className="ico-sm" /> {fmtWeekday(next.date)}{callup?.meet_time ? ` · ${callup.meet_time}` : ''}</span>
              <span><MapPin className="ico-sm" /> {next.venue === 'L' ? 'Local' : 'Visitante'}{callup?.place ? ` · ${callup.place}` : ''}</span>
              {next.competition && <span><Trophy className="ico-sm" /> {next.competition}</span>}
              <span><Users className="ico-sm" /> {squad ? `${squad.length} convocados` : 'Sin convocatoria'}</span>
            </div>
            <div className="actions">
              <button className="btn btn-light btn-sm" onClick={() => nav(`/partidos/${next.id}`)}>Ver ficha <ChevronRight className="ico-sm" /></button>
              <button className="btn btn-light btn-sm" onClick={() => openSheet({ kind: 'callup', id: callup?.id })}>{callup ? 'Editar convocatoria' : 'Convocar'}</button>
            </div>
          </div>
        ) : (
          <div className="hero">
            <div className="eyebrow"><CalendarDays className="ico-sm" /> Próximo partido</div>
            <h2>Nada programado</h2>
            <div className="meta"><span>Crea una convocatoria y el partido se añade solo a Partidos.</span></div>
            <div className="actions"><button className="btn btn-light btn-sm" onClick={() => openSheet({ kind: 'callup' })}><CalendarPlus className="ico-sm" /> Nueva convocatoria</button></div>
          </div>
        )}

        {/* Último resultado */}
        {last && (
          <Link to={`/partidos/${last.id}`} className="card tap" style={{ textDecoration: 'none' }}>
            <div className="between">
              <div>
                <div className="xs muted bold" style={{ textTransform: 'uppercase', letterSpacing: '.06em' }}>Último resultado</div>
                <div className="bold" style={{ fontSize: 16, marginTop: 4 }}>vs {last.rival}</div>
                <div className="xs muted" style={{ marginTop: 2 }}>{fmtDate(last.date)} · {last.competition || (last.venue === 'L' ? 'Local' : 'Visitante')}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="m-score num" style={{ fontSize: 30, color: last.gf > last.ga ? 'var(--win)' : last.gf < last.ga ? 'var(--loss)' : 'var(--draw)' }}>{last.gf}–{last.ga}</div>
                <ResultBadge m={last} />
              </div>
            </div>
            {sum.form.length > 1 && <div className="between" style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)' }}><span className="xs muted">Racha reciente</span><FormStrip form={sum.form} /></div>}
          </Link>
        )}

        {/* KPIs */}
        <div className="stat-grid four" style={{ paddingTop: 4 }}>
          <div className="stat-box accent"><div className="sv">{sum.pts}</div><div className="sl">Puntos</div></div>
          <div className="stat-box"><div className="sv" style={{ fontSize: 17, paddingTop: 4 }}>{sum.w}·{sum.dr}·{sum.l}</div><div className="sl">G · E · P</div></div>
          <div className="stat-box"><div className="sv">{sum.gf}</div><div className="sl">Goles a favor</div></div>
          <div className="stat-box"><div className="sv">{sum.ga}</div><div className="sl">Goles en contra</div></div>
        </div>

        {/* Acciones rápidas */}
        <div className="quick">
          <button onClick={() => openSheet({ kind: 'training' })}><Dumbbell className="ico" />Entreno</button>
          <button onClick={() => openSheet({ kind: 'match' })}><Trophy className="ico" />Partido</button>
          <button onClick={() => openSheet({ kind: 'callup' })}><ClipboardList className="ico" />Convocar</button>
          <button onClick={() => openSheet({ kind: 'player' })}><UserPlus className="ico" />Jugador</button>
        </div>

        {/* Herramientas tácticas */}
        <div className="sec-label">Herramientas tácticas</div>
        <div className="tool-grid">
          {tools.map((t) => (
            <Link key={t.to} to={t.to} className={`tool ${t.primary ? 'primary' : ''}`}>
              <IconBadge icon={t.icon} />
              <div><div className="t">{t.title}</div><div className="s">{t.sub}</div></div>
            </Link>
          ))}
        </div>

        {/* Analíticas destacadas */}
        {findings.length > 0 && (
          <>
            <div className="sec-label">Analíticas <Link to="/analiticas" className="link">Ver todo <ChevronRight className="ico-sm" /></Link></div>
            {findings.map((f) => (
              <Link key={f.id} to="/analiticas" className={`finding ${f.level}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                {f.level === 'warn' ? <TriangleAlert className="ico" /> : <Lightbulb className="ico" />}
                <div><div className="ft">{f.title}</div><div className="fx">{f.text}</div></div>
              </Link>
            ))}
          </>
        )}

        {/* Plantilla y equipo */}
        <div className="sec-label">Equipo</div>
        <div className="qa-two">
          <Link to="/plantilla" className="card tap" style={{ textDecoration: 'none' }}>
            <div className="row-flex"><IconBadge icon={Users} /><div><div className="bold">{players.length} jugadores</div><div className="xs muted">{top && top.s.goals > 0 ? `Goleador: ${top.p.name} (${top.s.goals})` : 'Plantilla y minutos'}</div></div></div>
          </Link>
          <Link to="/analiticas" className="card tap" style={{ textDecoration: 'none' }}>
            <div className="row-flex"><IconBadge icon={BarChart3} /><div><div className="bold">Analíticas</div><div className="xs muted">Zonas de gol y tendencias</div></div></div>
          </Link>
          <Link to="/equipo" className="card tap" style={{ textDecoration: 'none' }}>
            <div className="row-flex"><IconBadge icon={Shield} /><div className="grow"><div className="bold">{profile.system ? `Sistema habitual ${profile.system}` : 'Modelo de juego'}</div><div className="xs muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile.model || 'Define tu modelo y principios de juego'}</div></div></div>
          </Link>
        </div>

        {!players.length && !data.matches.length && (
          <Empty icon={Users} action={<button className="btn btn-p" onClick={() => openSheet({ kind: 'player' })}>Añadir primer jugador</button>}>
            Empieza creando tu plantilla;<br />después convoca, registra partidos y analiza.
          </Empty>
        )}
        <div className="spacer" />
      </div>
    </div>
  );
}
