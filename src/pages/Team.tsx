import { ChevronRight, ArrowLeftRight, Download, Lightbulb, Link2, Trophy, Pencil, Shield, Users, UserCog } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Link } from 'react-router';
import { IconBadge, TextBlock, TopBar } from '../components/bits';
import { SyncPill } from '../components/SyncPill';
import { useAuth } from '../store/auth';
import { useStore } from '../store/store';
import { useFcf } from '../store/fcf';
import { confirmDialog, openSheet } from '../store/ui';

function Section({ icon, title, children, empty }: { icon: LucideIcon; title: string; children?: React.ReactNode; empty: string }) {
  return (
    <div className="card">
      <div className="row-flex" style={{ marginBottom: children ? 10 : 0 }}>
        <IconBadge icon={icon} />
        <div className="bold grow">{title}</div>
      </div>
      {children ?? <button className="linkbtn" style={{ textDecoration: 'none', color: 'var(--text3)', fontWeight: 500, padding: 0, textAlign: 'left' }} onClick={() => openSheet({ kind: 'team' })}>{empty}</button>}
    </div>
  );
}

export default function Team() {
  const team = useStore((s) => s.team);
  const players = useStore((s) => s.data.players).filter((p) => !p.archived_at).length;
  const email = useAuth((s) => s.email);
  const p = team.profile;
  const unlink = async () => {
    if (!(await confirmDialog({ title: 'Desvincular competición', message: 'Se dejarán de mostrar los datos FCF. Tus partidos no se borran.', ok: 'Desvincular' }))) return;
    useStore.getState().updateTeam({ profile: { ...p, fcf: null } });
    useFcf.getState().forget(team.id);
  };

  return (
    <div className="page">
      <TopBar title="Equipo" subtitle="Información, modelo de juego y cuenta" right={<button className="btn btn-p btn-sm" onClick={() => openSheet({ kind: 'team' })}><Pencil className="ico-sm" /> Editar</button>} />
      <div className="page-inner">
        <div className="hero" style={{ marginBottom: 12 }}>
          <div className="eyebrow"><Shield className="ico-sm" /> {[team.season, team.category].filter(Boolean).join(' · ') || 'Mi equipo'}</div>
          <h2>{team.name}</h2>
          <div className="meta"><span><Users className="ico-sm" /> {players} jugadores</span>{p.system && <span>Sistema {p.system}</span>}</div>
        </div>

        <Section icon={Shield} title="Información general" empty="Añade información general del equipo">
          {p.info ? <p className="prose">{p.info}</p> : undefined}
        </Section>

        <Section icon={UserCog} title="Cuerpo técnico" empty="Añade a tu cuerpo técnico">
          {p.staff.length ? (
            <div className="kv">
              {p.staff.map((s) => (<><dt key={s.id + 'r'}>{s.role || 'Staff'}</dt><dd key={s.id}>{s.name}</dd></>))}
            </div>
          ) : undefined}
        </Section>

        <Section icon={Lightbulb} title="Juego" empty="Define sistema, modelo y principios de juego">
          {p.system || p.model || p.principles || p.ideas || p.other ? (
            <>
              {p.system && <div className="text-block"><h4>Sistema habitual</h4><p className="prose">{p.system}</p></div>}
              <TextBlock label="Modelo de juego" value={p.model} />
              <TextBlock label="Principios de juego" value={p.principles} />
              <TextBlock label="Ideas y conceptos tácticos" value={p.ideas} />
              <TextBlock label="Otros aspectos" value={p.other} />
            </>
          ) : undefined}
        </Section>

        <div className="sec-label">Competición FCF</div>
        <div className="card">
          {p.fcf ? (
            <>
              <div className="bold">{p.fcf.competition.label}</div>
              <div className="xs muted" style={{ marginBottom: 10 }}>{p.fcf.season.label} · {p.fcf.discipline.label} · {p.fcf.group.label} · {p.fcf.team.label}</div>
              <div className="row-flex" style={{ gap: 8, flexWrap: 'wrap' }}>
                <Link className="btn btn-p btn-sm" to="/competicion"><Trophy className="ico-sm" /> Ver competición</Link>
                <button className="btn btn-g btn-sm" onClick={() => openSheet({ kind: 'fcf' })}>Cambiar</button>
                <button className="btn btn-g btn-sm" onClick={() => void unlink()}>Desvincular</button>
              </div>
            </>
          ) : (
            <>
              <p className="small muted" style={{ marginBottom: 10 }}>Vincula tu equipo con su competición de la Federació Catalana de Futbol para tener calendario, resultados, clasificación, goleadores y análisis de rivales.</p>
              <button className="btn btn-p btn-sm" onClick={() => openSheet({ kind: 'fcf' })}><Link2 className="ico-sm" /> Vincular competición</button>
            </>
          )}
        </div>

        <div className="sec-label">Cuenta y datos</div>
        <div className="card flush">
          <Link className="row" to="/equipos"><div className="ri"><div className="rn">Mis equipos</div><div className="rm">Cambiar, crear o eliminar equipos</div></div><ArrowLeftRight className="ico" /></Link>
          <Link className="row" to="/cuenta"><div className="ri"><div className="rn">Cuenta y sincronización</div><div className="rm">{email ?? 'Solo en este dispositivo'} <SyncPill /></div></div><ChevronRight className="ico" /></Link>
          <Link className="row" to="/exportar"><div className="ri"><div className="rn">Exportar datos</div><div className="rm">Excel, CSV y PDF</div></div><Download className="ico" /></Link>
          <button className="row" onClick={() => openSheet({ kind: 'backup' })}><div className="ri"><div className="rn">Copias de seguridad</div><div className="rm">Exportar o importar un archivo .json</div></div><ChevronRight className="ico" /></button>
        </div>
        <div className="spacer" />
      </div>
    </div>
  );
}
