import { planCalendar } from '../lib/fcf/calendar';
import type { FcfGroupData } from '../lib/fcf/types';
// Acciones de dominio que tocan varios registros a la vez, para que los datos introducidos una vez
// se reutilicen: convocatoria → partido, partido → convocatoria.

import { FORMATIONS } from '../lib/constants';
import { blankMatch } from '../lib/factories';
import { uid } from '../lib/id';
import { matchOfCallup } from '../lib/stats';
import type { Callup, Match, Venue } from '../lib/types';
import { useStore } from './store';

export interface CallupInput {
  id?: string;
  rival: string;
  date: string;
  meet_time: string;
  place: string;
  venue: Venue;
  competition: string;
  players: Callup['players'];
}

/**
 * Guarda una convocatoria. Si es nueva, crea automáticamente el partido (programado) asociado;
 * si ya existe, mantiene sincronizados rival, fecha, local/visitante y competición del partido.
 */
export function saveCallup(input: CallupInput): { callup: Callup; match: Match } {
  const s = useStore.getState();
  const callup: Callup = {
    id: input.id ?? uid(), team_id: s.team.id, rival: input.rival, date: input.date, meet_time: input.meet_time, place: input.place, players: input.players,
  };
  s.upsert('callups', callup);

  const existing = matchOfCallup(useStore.getState().data, callup.id);
  const usual = s.team.profile.system;
  const match: Match = existing
    ? { ...existing, rival: input.rival, date: input.date, venue: input.venue, competition: input.competition }
    : blankMatch({
        rival: input.rival, date: input.date, venue: input.venue, competition: input.competition,
        status: 'scheduled', callup_id: callup.id, tactic: FORMATIONS[usual] ? usual : '4-3-3',
      });
  useStore.getState().upsert('matches', match);
  return { callup, match };
}

/** Elimina la convocatoria; el partido programado asociado pasa a la papelera (uno ya jugado se conserva). */
export function deleteCallup(id: string) {
  const s = useStore.getState();
  const match = matchOfCallup(s.data, id);
  if (match && match.status === 'scheduled') s.upsert('matches', { ...match, deleted_at: new Date().toISOString() });
  useStore.getState().remove('callups', id);
}

/** Guarda un partido y refleja rival/fecha en su convocatoria (una sola fuente de verdad para esos datos). */
export function saveMatch(match: Match) {
  const s = useStore.getState();
  s.upsert('matches', match);
  if (match.callup_id) {
    const c = s.data.callups.find((x) => x.id === match.callup_id);
    if (c && (c.rival !== match.rival || c.date !== match.date)) useStore.getState().upsert('callups', { ...c, rival: match.rival, date: match.date });
  }
}

/** Aplica el calendario FCF a Partidos (ver lib/fcf/calendar.ts). Devuelve el resumen de cambios. */
export function syncFcfCalendar(group: FcfGroupData) {
  const s = useStore.getState();
  const link = s.team.profile.fcf;
  if (!link) throw new Error('Primero vincula la competición FCF');
  const plan = planCalendar(s.data.matches, link, group, s.team.id);
  for (const m of [...plan.create, ...plan.update]) s.upsert('matches', m);
  const changedLinks = JSON.stringify(plan.links) !== JSON.stringify(link.links);
  if (changedLinks) useStore.getState().updateTeam({ profile: { ...s.team.profile, fcf: { ...link, links: plan.links } } });
  return { created: plan.create.length, updated: plan.update.length, linked: plan.linked, unchanged: plan.unchanged };
}
