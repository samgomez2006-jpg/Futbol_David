import { LayoutTemplate } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Empty, ResultBadge, TopBar } from '../components/bits';
import { Pitch } from '../components/Pitch';
import { compareDateDesc, fmtDate } from '../lib/dates';
import { resolveAssign } from '../lib/lineup';
import { activeMatches } from '../lib/stats';
import { useStore } from '../store/store';

export default function LineupHistory() {
  const data = useStore((s) => s.data);
  const nav = useNavigate();
  const [system, setSystem] = useState<string>('');
  const byId = new Map(data.players.map((p) => [p.id, p]));
  const all = activeMatches(data).filter((m) => m.lineup.some((e) => e.role === 'TIT')).sort(compareDateDesc);
  const systems = [...new Set(all.map((m) => m.tactic))];
  const list = system ? all.filter((m) => m.tactic === system) : all;
  const counts = new Map<string, number>();
  for (const m of all) counts.set(m.tactic, (counts.get(m.tactic) ?? 0) + 1);

  return (
    <div className="page">
      <TopBar back="Inicio" backTo="/" title="Histórico de alineaciones" subtitle={all.length ? `${all.length} alineaciones registradas` : undefined} />
      <div className="page-inner">
        {systems.length > 1 && (
          <div className="tabs" style={{ marginBottom: 6 }}>
            <button className={`tab ${!system ? 'active' : ''}`} onClick={() => setSystem('')}>Todas</button>
            {systems.map((s) => <button key={s} className={`tab ${system === s ? 'active' : ''}`} onClick={() => setSystem(s)}>{s} · {counts.get(s)}</button>)}
          </div>
        )}
        {!all.length ? (
          <Empty icon={LayoutTemplate}>Todavía no hay alineaciones.<br />Se guardan al definir la alineación de un partido.</Empty>
        ) : (
          <div className="lineup-grid" style={{ paddingTop: 12 }}>
            {list.map((m) => {
              const { assign } = resolveAssign(m.tactic, m.lineup);
              const marks: Record<string, { out?: number | null }> = {};
              for (const s of m.subs) marks[s.out_pid] = { out: s.min };
              return (
                <button key={m.id} className="lineup-card" onClick={() => nav(`/partidos/${m.id}`)}>
                  <div className="between" style={{ marginBottom: 8 }}>
                    <div>
                      <div className="bold">vs {m.rival}</div>
                      <div className="xs muted">{fmtDate(m.date)} · {m.tactic}{m.competition ? ` · ${m.competition}` : ''}</div>
                    </div>
                    {m.status === 'played' ? <ResultBadge m={m} /> : <span className="badge b-blue">Programado</span>}
                  </div>
                  <Pitch tactic={m.tactic} assign={assign} players={byId} marks={marks} compact />
                </button>
              );
            })}
          </div>
        )}
        <div className="spacer" />
      </div>
    </div>
  );
}
