import { todayISO } from './dates';
import { uid } from './id';
import { emptyPlan, emptyRival, type Match } from './types';

/** Partido nuevo con todos los campos por defecto (team_id lo pone el store al guardar). */
export function blankMatch(p: Partial<Match> = {}): Match {
  return {
    id: uid(),
    team_id: '',
    rival: '',
    date: todayISO(),
    venue: 'L',
    competition: '',
    status: 'played',
    callup_id: null,
    gf: 0,
    ga: 0,
    total_mins: 60,
    tactic: '4-3-3',
    notes: '',
    motm: null,
    goals: [],
    conceded: [],
    cards: [],
    lineup: [],
    subs: [],
    incidents: [],
    rival_info: emptyRival(),
    plan: emptyPlan(),
    deleted_at: null,
    ...p,
  };
}
