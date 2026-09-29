// Importar/actualizar el calendario FCF en «Partidos» sin duplicados.
// - Los partidos pendientes de la FCF se crean como partidos programados (una sola vez por acta).
// - Si el entrenador ya tenía ese partido (misma fecha y mismo rival), se vincula en lugar de duplicarlo.
// - En partidos ya vinculados y aún programados solo se actualiza lo que cambia en la FCF (fecha, campo, rival).
// - Nunca se crean partidos «jugados» ni se toca lo registrado por el entrenador en un partido jugado.

import { blankMatch } from '../factories';
import type { Match } from '../types';
import { findTeam, shortTeamName } from './analysis';
import type { FcfGroupData, FcfLink } from './types';

export interface CalendarPlan {
  create: Match[];
  update: Match[];
  links: Record<string, string>;
  linked: number;
  unchanged: number;
}

export function planCalendar(matches: Match[], link: FcfLink, g: FcfGroupData, teamId: string): CalendarPlan {
  const plan: CalendarPlan = { create: [], update: [], links: { ...link.links }, linked: 0, unchanged: 0 };
  const byId = new Map(matches.map((m) => [m.id, m]));
  const taken = new Set(Object.values(plan.links));
  const ours = g.matches.filter((m) => !m.bye && (m.homeId === link.team.id || m.awayId === link.team.id));
  for (const f of ours) {
    const home = f.homeId === link.team.id;
    const oppId = home ? f.awayId : f.homeId;
    const oppName = home ? f.awayName : f.homeName;
    const venue = home ? 'L' as const : 'V' as const;
    const existing = plan.links[f.acta] ? byId.get(plan.links[f.acta]) : undefined;
    if (existing) {
      if (existing.deleted_at || existing.status === 'played' || !f.date) {
        plan.unchanged++;
        continue;
      }
      const next = { ...existing, date: f.date, venue };
      if (next.date !== existing.date || next.venue !== existing.venue) plan.update.push(next);
      else plan.unchanged++;
      continue;
    }
    // ¿Lo tenía ya el entrenador? Misma fecha y rival reconocible.
    const opp = { id: oppId, name: oppName, logo: null };
    const same = f.date ? matches.find((m) => !m.deleted_at && !taken.has(m.id) && m.date === f.date && findTeam(m.rival, [opp])) : undefined;
    if (same) {
      plan.links[f.acta] = same.id;
      taken.add(same.id);
      plan.linked++;
      continue;
    }
    if (f.closed || !f.date) continue; // solo se crean los pendientes con fecha
    const m = blankMatch({ team_id: teamId, rival: shortTeamName(oppName), date: f.date, venue, competition: link.competition.label, status: 'scheduled' });
    plan.links[f.acta] = m.id;
    taken.add(m.id);
    plan.create.push(m);
  }
  return plan;
}

/** Acta FCF vinculada a un partido de la app (o null). */
export function actaOfMatch(link: FcfLink | null | undefined, matchId: string): string | null {
  if (!link) return null;
  for (const [acta, id] of Object.entries(link.links)) if (id === matchId) return acta;
  return null;
}
