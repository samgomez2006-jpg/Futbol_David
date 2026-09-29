import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Sheet } from '../../components/Sheet';
import { FORMATIONS } from '../../lib/constants';
import { blankMatch } from '../../lib/factories';
import { applyAutoMinutes, validSubs } from '../../lib/minutes';
import { normalizeMatch } from '../../lib/normalize';
import { resolveAssign } from '../../lib/lineup';
import { formationSlots, slotKey } from '../../lib/constants';
import { callupOfMatch, sortPlayers, squadOf, validateMatch } from '../../lib/stats';
import type { Match } from '../../lib/types';
import { saveMatch } from '../../store/actions';
import { useStore } from '../../store/store';
import { toast } from '../../store/ui';
import type { TabProps } from './common';
import { GoalsTab } from './GoalsTab';
import { IncidentsTab } from './IncidentsTab';
import { InfoTab } from './InfoTab';
import { LineupTab } from './LineupTab';
import { PlanTab, RivalTab } from './TextTabs';

type Tab = 'info' | 'lineup' | 'goals' | 'incidents' | 'rival' | 'plan';
const TABS: [Tab, string][] = [['info', 'Datos'], ['lineup', 'Alineación'], ['goals', 'Goles'], ['incidents', 'Incidencias'], ['rival', 'Rival'], ['plan', 'Planteamiento']];
const RECALC: (keyof Match)[] = ['lineup', 'subs', 'cards', 'total_mins'];

export function MatchSheet({ id, tab: initialTab, onClose }: { id?: string; tab?: string; onClose: () => void }) {
  const data = useStore((s) => s.data);
  const team = useStore((s) => s.team);
  const nav = useNavigate();
  const existing = id ? data.matches.find((m) => m.id === id) : undefined;

  const [tab, setTab] = useState<Tab>((TABS.find(([t]) => t === initialTab)?.[0] ?? 'info') as Tab);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Match>(() => {
    const usual = team.profile.system;
    const m = existing ? normalizeMatch(structuredClone(existing)) : blankMatch({ tactic: FORMATIONS[usual] ? usual : '4-3-3' });
    // Partido creado desde una convocatoria: los convocados empiezan en el banquillo para no tener que introducirlos otra vez.
    const squad = squadOf(data, m);
    if (squad && !m.lineup.length) m.lineup = squad.map((pid) => ({ pid, role: 'SUP', slot: null, mins: 0 }));
    return m;
  });

  const set = (patch: Partial<Match>) =>
    setDraft((d) => {
      let n: Match = { ...d, ...patch };
      if (RECALC.some((k) => k in patch)) n = { ...n, lineup: applyAutoMinutes(n.lineup, validSubs(n.subs), n.cards, n.total_mins) };
      return n;
    });

  /** Cambiar de sistema recoloca a los titulares por orden en la nueva formación. */
  const onFormation = (tactic: string) =>
    setDraft((d) => {
      const { assign } = resolveAssign(d.tactic, d.lineup);
      const oldSlots = formationSlots(d.tactic);
      const newSlots = formationSlots(tactic);
      const slotOf: Record<string, string> = {};
      oldSlots.forEach((s, i) => {
        const pid = assign[slotKey(s, i)];
        if (pid && newSlots[i]) slotOf[pid] = slotKey(newSlots[i], i);
      });
      return { ...d, tactic, lineup: d.lineup.map((e) => (e.role === 'TIT' ? { ...e, slot: slotOf[e.pid] ?? null } : e)) };
    });

  // Jugadores seleccionables: activos + los que ya figuran en este partido (aunque estén de baja).
  const involved = new Set<string>([
    ...draft.lineup.map((e) => e.pid), ...draft.goals.flatMap((g) => [g.pid, g.apid]).filter((x): x is string => !!x), ...draft.cards.map((c) => c.pid),
  ]);
  const roster = sortPlayers(data.players.filter((p) => !p.archived_at || involved.has(p.id)));
  const byId = new Map(roster.map((p) => [p.id, p]));
  const squad = squadOf(data, draft);
  const callup = callupOfMatch(data, draft);
  const props: TabProps = { draft, set, roster, byId, squad };

  const save = () => {
    const m: Match = { ...draft, rival: draft.rival.trim(), date: draft.date || new Date().toISOString().slice(0, 10), subs: validSubs(draft.subs), cards: draft.cards.filter((c) => c.pid) };
    const err = validateMatch(m);
    if (err) {
      setError(err);
      setTab('info');
      toast(err);
      return;
    }
    saveMatch(m);
    toast(existing ? 'Partido actualizado ✓' : 'Partido guardado ✓');
    onClose();
    if (!existing) nav(`/partidos/${m.id}`);
  };

  const badge = (t: Tab) =>
    t === 'goals' ? draft.goals.length + draft.conceded.length : t === 'lineup' ? draft.lineup.filter((e) => e.role === 'TIT').length : t === 'incidents' ? draft.cards.length + draft.incidents.length : 0;

  return (
    <Sheet
      title={existing ? (draft.status === 'scheduled' ? 'Preparar partido' : 'Editar partido') : 'Nuevo partido'}
      onClose={onClose}
      actions={<><button className="btn btn-g" style={{ flex: 1 }} onClick={onClose}>Cancelar</button><button className="btn btn-p" style={{ flex: 2 }} onClick={save}>Guardar partido</button></>}
    >
      {callup && <div className="info-box" style={{ marginTop: -4 }}>Convocatoria vinculada: {callup.players.filter((p) => p.status === 'confirmed').length} convocados.</div>}
      <div className="tabs" role="tablist" style={{ marginBottom: 12 }}>
        {TABS.map(([t, l]) => (
          <button key={t} role="tab" aria-selected={tab === t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {l}{badge(t) > 0 ? ` (${badge(t)})` : ''}
          </button>
        ))}
      </div>
      {error && <div className="error-box" role="alert">{error}</div>}
      {tab === 'info' && <InfoTab {...props} onFormation={onFormation} />}
      {tab === 'lineup' && <LineupTab {...props} />}
      {tab === 'goals' && <GoalsTab {...props} />}
      {tab === 'incidents' && <IncidentsTab {...props} />}
      {tab === 'rival' && <RivalTab {...props} />}
      {tab === 'plan' && <PlanTab {...props} />}
    </Sheet>
  );
}
