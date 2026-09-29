import { ChevronRight, ExternalLink, Shield } from 'lucide-react';
import { Link } from 'react-router';
import { actaOfMatch } from '../lib/fcf/calendar';
import { findTeam, shortTeamName } from '../lib/fcf/analysis';
import { actaUrl } from '../lib/fcf/types';
import type { Match } from '../lib/types';
import { useFcfGroup } from '../store/fcf';
import { SrcFcf } from './FcfBits';

/** En la ficha de partido: reconoce al rival en la FCF, da acceso a su análisis y muestra el resultado oficial. */
export function FcfMatchCard({ match }: { match: Match }) {
  const { link, group } = useFcfGroup();
  if (!link || !group) return null;
  const acta = actaOfMatch(link, match.id);
  const fm = acta ? group.matches.find((m) => m.acta === acta) : undefined;
  const me = link.team.id;
  const rivalId = fm ? (fm.homeId === me ? fm.awayId : fm.homeId) : findTeam(match.rival, group.teams.filter((t) => t.id !== me))?.id;
  if (!rivalId) return null;
  const rival = group.teams.find((t) => t.id === rivalId);
  const st = group.standings.find((s) => s.teamId === rivalId);
  const official = fm?.closed ? (fm.homeId === me ? `${fm.hg} - ${fm.ag}` : `${fm.ag} - ${fm.hg}`) : null;
  const differs = official && match.status === 'played' && official !== `${match.gf} - ${match.ga}`;
  return (
    <div className="card">
      <div className="between" style={{ marginBottom: 8 }}>
        <span className="bold small" style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Shield className="ico-sm" /> Rival en la FCF <SrcFcf /></span>
        {st && st.pj > 0 && <span className="xs muted">{st.pos}º · {st.pts} pts</span>}
      </div>
      <div className="small" style={{ marginBottom: 10 }}>{rival ? shortTeamName(rival.name) : ''}{fm ? ` · Jornada ${fm.round}` : ''}</div>
      {official && (
        <div className="small" style={{ marginBottom: 10 }}>
          Resultado oficial (nosotros – rival): <b>{official}</b>{' '}
          <a href={actaUrl(fm!.acta)} target="_blank" rel="noreferrer" className="link"><ExternalLink className="ico-sm" /> Acta</a>
          {differs && <div className="xs" style={{ color: 'var(--draw)', marginTop: 4 }}>No coincide con el resultado registrado en la app ({match.gf} - {match.ga}).</div>}
        </div>
      )}
      <Link className="btn btn-p btn-sm btn-block" to={`/competicion/equipo/${rivalId}`}>Análisis del rival <ChevronRight className="ico-sm" /></Link>
    </div>
  );
}
