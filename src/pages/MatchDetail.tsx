import { useNavigate, useParams } from 'react-router';
import { Empty, ResultBadge, resultColor, TopBar } from '../components/bits';
import { formationSlots, slotLabel, TRASH_DAYS } from '../lib/constants';
import { fmtDate } from '../lib/dates';
import { resultOf } from '../lib/stats';
import { useStore } from '../store/store';
import { confirmDialog, openSheet, toast } from '../store/ui';

export default function MatchDetail() {
  const { id } = useParams();
  const data = useStore((s) => s.data);
  const team = useStore((s) => s.team);
  const upsert = useStore((s) => s.upsert);
  const nav = useNavigate();
  const m = data.matches.find((x) => x.id === id);
  if (!m) return <div className="page"><TopBar back="Partidos" backTo="/partidos" /><Empty icon="🤷">Partido no encontrado.</Empty></div>;

  const name = (pid: string | null) => (pid ? data.players.find((p) => p.id === pid)?.name ?? '—' : 'Sin asignar');
  const order = formationSlots(m.tactic).map((s) => s.p);
  const starters = m.lineup.filter((e) => e.role === 'TIT').sort((a, b) => order.indexOf(slotLabel(a.slot)) - order.indexOf(slotLabel(b.slot)));
  const subs = m.lineup.filter((e) => e.role === 'SUP');
  const r = resultOf(m);

  const trash = async () => {
    if (!(await confirmDialog({ title: 'Mover a la papelera', message: `Podrás restaurarlo durante ${TRASH_DAYS} días.`, ok: 'Mover', danger: true }))) return;
    upsert('matches', { ...m, deleted_at: new Date().toISOString() });
    toast('Partido movido a la papelera');
    nav('/partidos', { replace: true });
  };

  return (
    <div className="page">
      <TopBar back="Partidos" backTo="/partidos" right={<button className="btn btn-g btn-sm" onClick={() => openSheet({ kind: 'match', id: m.id })}>✏️ Editar</button>} />
      <div className="page-inner">
        <div className="det-header">
          <div className="xs muted" style={{ marginBottom: 6 }}>{fmtDate(m.date)} · {m.venue === 'L' ? 'Local' : 'Visitante'} · {m.tactic} · {m.total_mins}'</div>
          <div className="small muted" style={{ marginBottom: 4 }}>
            {m.venue === 'L' ? <>{team.name} <span style={{ color: 'var(--text3)' }}>vs</span> {m.rival}</> : <>{m.rival} <span style={{ color: 'var(--text3)' }}>vs</span> {team.name}</>}
          </div>
          <div className="m-score" style={{ color: resultColor[r] }}>{m.venue === 'L' ? `${m.gf} — ${m.ga}` : `${m.ga} — ${m.gf}`}</div>
          <div style={{ marginTop: 10 }}><ResultBadge m={m} /></div>
          {m.deleted_at && <div style={{ marginTop: 8 }}><span className="badge b-red">En la papelera</span></div>}
        </div>

        {m.motm && (
          <div className="card row-flex" style={{ marginTop: 12 }}>
            <span style={{ fontSize: 26 }} aria-hidden>⭐</span>
            <div><div className="xs muted bold">Jugador del partido</div><div className="bold">{name(m.motm)}</div></div>
          </div>
        )}

        {m.goals.length > 0 && (
          <>
            <div className="sec-label">⚽ Goles marcados</div>
            <div className="card flush" style={{ padding: '6px 0' }}>
              {[...m.goals].sort((a, b) => (a.min ?? 999) - (b.min ?? 999)).map((g) => (
                <div className="ev-row" key={g.id}>
                  <div className="ev-min">{g.min ?? '?'}'</div>
                  <div style={{ flex: 1 }}>
                    <div className="small bold">{name(g.pid)}</div>
                    <div className="xs muted">{[g.gtype, g.body, g.apid && `Asist: ${name(g.apid)}`, g.field_zone, g.goal_zone].filter(Boolean).join(' · ')}</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
        {m.conceded.length > 0 && (
          <>
            <div className="sec-label">🥅 Goles encajados</div>
            <div className="card flush" style={{ padding: '6px 0' }}>
              {[...m.conceded].sort((a, b) => (a.min ?? 999) - (b.min ?? 999)).map((g) => (
                <div className="ev-row" key={g.id}>
                  <div className="ev-min">{g.min ?? '?'}'</div>
                  <div className="small muted">{[g.gtype, g.field_zone, g.goal_zone].filter(Boolean).join(' · ') || '—'}</div>
                </div>
              ))}
            </div>
          </>
        )}
        {m.cards.length > 0 && (
          <>
            <div className="sec-label">Tarjetas</div>
            <div className="card flush" style={{ padding: '6px 0' }}>
              {m.cards.map((c) => (
                <div className="ev-row" key={c.id}>
                  <div className="ev-min">{c.min ?? '?'}'</div>
                  <span aria-label={c.type === 'Y' ? 'Amarilla' : 'Roja'}>{c.type === 'Y' ? '🟨' : '🟥'}</span>
                  <span className="small">{name(c.pid)}</span>
                </div>
              ))}
            </div>
          </>
        )}
        {starters.length > 0 && (
          <>
            <div className="sec-label">Alineación titular ({m.tactic})</div>
            <div className="card flush">
              {starters.map((e) => (
                <div className="srow" key={e.pid}>
                  <span className="srl">{name(e.pid)} <span className="xs" style={{ color: 'var(--text3)' }}>{slotLabel(e.slot)}</span></span>
                  <span className="srv">{e.mins}'</span>
                </div>
              ))}
            </div>
          </>
        )}
        {subs.length > 0 && (
          <>
            <div className="sec-label">Suplentes</div>
            <div className="card flush">
              {subs.map((e) => (
                <div className="srow" key={e.pid}>
                  <span className="srl">{name(e.pid)}</span>
                  <span className="srv">{e.mins ? `${e.mins}'` : 'No jugó'}</span>
                </div>
              ))}
            </div>
          </>
        )}
        {m.notes && (
          <>
            <div className="sec-label">Notas</div>
            <div className="card"><p className="small muted" style={{ lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{m.notes}</p></div>
          </>
        )}
        {!m.deleted_at && (
          <div style={{ padding: '6px var(--pad) 0' }}>
            <button className="btn btn-danger btn-block" onClick={trash}>🗑️ Mover a la papelera</button>
          </div>
        )}
        <div className="spacer" />
      </div>
    </div>
  );
}
