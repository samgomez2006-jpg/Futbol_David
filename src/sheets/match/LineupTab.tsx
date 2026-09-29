import { ArrowLeftRight, Plus, RotateCcw, X } from 'lucide-react';
import { useState } from 'react';
import { Pitch } from '../../components/Pitch';
import { formationSlots, slotKey, slotLabel } from '../../lib/constants';
import { uid } from '../../lib/id';
import { resolveAssign } from '../../lib/lineup';
import type { LineupEntry, Match, Player, Substitution } from '../../lib/types';
import { posBadge, playerTag } from '../../components/bits';
import { NumInput, playerLabel, type TabProps } from './common';

/** Devuelve la alineación con los titulares en los huecos resueltos de la formación actual. */
function withResolvedSlots(d: Match): LineupEntry[] {
  const { assign } = resolveAssign(d.tactic, d.lineup);
  const slotOf = Object.fromEntries(Object.entries(assign).map(([k, pid]) => [pid, k]));
  return d.lineup.map((e) => (e.role === 'TIT' ? { ...e, slot: slotOf[e.pid] ?? e.slot } : e));
}

export function LineupTab({ draft, set, roster, byId, squad }: TabProps) {
  const [picker, setPicker] = useState<{ key: string; label: string } | null>(null);
  const [showAll, setShowAll] = useState(false);
  const { assign, extras } = resolveAssign(draft.tactic, draft.lineup);
  const starters = new Set(draft.lineup.filter((e) => e.role === 'TIT').map((e) => e.pid));
  const entry = (pid: string) => draft.lineup.find((e) => e.pid === pid);

  // Con convocatoria, solo se ofrecen los convocados (se puede ver toda la plantilla).
  const pool = squad && !showAll ? roster.filter((p) => squad.includes(p.id) || entry(p.id)) : roster;
  const bench = pool.filter((p) => !starters.has(p.id));

  const marks: Record<string, { out?: number | null }> = {};
  for (const s of draft.subs) if (s.out_pid) marks[s.out_pid] = { out: s.min };

  const pick = (pid: string | null) => {
    if (!picker) return;
    const key = picker.key;
    const occupant = assign[key];
    let lineup = withResolvedSlots(draft).filter((e) => e.pid !== pid && e.pid !== occupant);
    if (pid) lineup.push({ pid, role: 'TIT', slot: key, mins: draft.total_mins });
    if (occupant && occupant !== pid) lineup.push({ pid: occupant, role: 'SUP', slot: null, mins: 0 });
    lineup = lineup.map((e) => e);
    set({ lineup, subs: draft.subs.filter((s) => s.in_pid !== pid) });
    setPicker(null);
  };

  const toggleBench = (pid: string) => {
    const e = entry(pid);
    if (e) set({ lineup: draft.lineup.filter((x) => x.pid !== pid), subs: draft.subs.filter((s) => s.in_pid !== pid && s.out_pid !== pid) });
    else set({ lineup: [...draft.lineup, { pid, role: 'SUP', slot: null, mins: 0 }] });
  };
  const setMins = (pid: string, mins: number | null) => set({ lineup: draft.lineup.map((e) => (e.pid === pid ? { ...e, mins: mins ?? 0, mins_manual: true } : e)) });
  const resetMins = (pid: string) => set({ lineup: draft.lineup.map((e) => (e.pid === pid ? { ...e, mins_manual: false } : e)) });

  // --- cambios -----------------------------------------------------------------------------------
  const updSub = (id: string, patch: Partial<Substitution>) => {
    let lineup = draft.lineup;
    if (patch.in_pid && !lineup.some((e) => e.pid === patch.in_pid)) lineup = [...lineup, { pid: patch.in_pid, role: 'SUP', slot: null, mins: 0 }];
    set({ subs: draft.subs.map((s) => (s.id === id ? { ...s, ...patch } : s)), lineup });
  };
  const outOptions = (sub: Substitution) => {
    const ids = new Set<string>(starters);
    for (const s of draft.subs) if (s.id !== sub.id && s.in_pid) ids.add(s.in_pid);
    return [...ids].map((id) => byId.get(id)).filter((p): p is Player => !!p);
  };

  const legacy = extras;
  const inLineupCount = draft.lineup.filter((e) => e.role === 'TIT').length;

  return (
    <>
      <p className="hint">
        Toca una posición para asignar un jugador. {squad ? `Se muestran los ${squad.length} convocados. ` : ''}Los minutos se calculan solos a partir de los cambios.
      </p>
      <div style={{ padding: '0 var(--pad)' }}>
        <Pitch tactic={draft.tactic} assign={assign} players={byId} marks={marks} onSlot={(key, label) => setPicker({ key, label })} />
      </div>

      {inLineupCount > 0 && (
        <>
          <div className="sec-label">Titulares · {inLineupCount}</div>
          {formationSlots(draft.tactic).map((s, i) => {
            const pid = assign[slotKey(s, i)];
            const p = pid ? byId.get(pid) : undefined;
            const e = pid ? entry(pid) : undefined;
            if (!p || !e) return null;
            return <MinRow key={pid} p={p} e={e} label={s.p} total={draft.total_mins} onMins={setMins} onReset={resetMins} />;
          })}
          {legacy.map((e) => {
            const p = byId.get(e.pid);
            return p ? <MinRow key={e.pid} p={p} e={e} label={slotLabel(e.slot) || '—'} total={draft.total_mins} onMins={setMins} onReset={resetMins} /> : null;
          })}
        </>
      )}

      <div className="sec-label">
        <span>Cambios</span>
        <button className="link" onClick={() => set({ subs: [...draft.subs, { id: uid(), min: null, out_pid: '', in_pid: '' }] })}><Plus className="ico-sm" /> Añadir cambio</button>
      </div>
      <div style={{ padding: '0 var(--pad)' }}>
        {draft.subs.map((s) => (
          <div className="event-card" key={s.id}>
            <div className="top">
              <ArrowLeftRight className="ico" style={{ color: 'var(--text3)' }} />
              <NumInput className="min-input" label="Minuto del cambio" placeholder="min" value={s.min} min={1} max={150} onChange={(v) => updSub(s.id, { min: v })} />
              <span className="grow" />
              <button className="icon-btn danger" onClick={() => set({ subs: draft.subs.filter((x) => x.id !== s.id) })} aria-label="Quitar cambio"><X className="ico" /></button>
            </div>
            <select value={s.out_pid} onChange={(e) => updSub(s.id, { out_pid: e.target.value })} aria-label="Jugador que sale">
              <option value="">Sale…</option>
              {outOptions(s).map((p) => <option key={p.id} value={p.id}>{playerLabel(p)}</option>)}
            </select>
            <select value={s.in_pid} onChange={(e) => updSub(s.id, { in_pid: e.target.value })} aria-label="Jugador que entra">
              <option value="">Entra…</option>
              {pool.filter((p) => !starters.has(p.id)).map((p) => <option key={p.id} value={p.id}>{playerLabel(p)}</option>)}
            </select>
          </div>
        ))}
        {!draft.subs.length && <p className="hint" style={{ padding: 0 }}>Sin cambios registrados.</p>}
      </div>

      <div className="sec-label">
        <span>Suplentes</span>
        {squad && <button className="link" onClick={() => setShowAll(!showAll)}>{showAll ? 'Solo convocados' : 'Ver toda la plantilla'}</button>}
      </div>
      {bench.map((p) => {
        const e = entry(p.id);
        return (
          <div className="check-row" key={p.id}>
            <input type="checkbox" id={`sub-${p.id}`} checked={!!e} onChange={() => toggleBench(p.id)} />
            <label htmlFor={`sub-${p.id}`} className="grow">{playerLabel(p)} <span className="muted xs">{p.position}</span></label>
            {e && <MinsInput p={p} e={e} total={draft.total_mins} onMins={setMins} onReset={resetMins} />}
          </div>
        );
      })}
      {!roster.length && <p className="hint">Añade jugadores a la plantilla para hacer la alineación.</p>}

      {picker && (
        <div className="overlay" style={{ zIndex: 200 }} onClick={(e) => e.target === e.currentTarget && setPicker(null)}>
          <div className="sheet" role="dialog" aria-modal="true" aria-label={`Posición ${picker.label}`} style={{ maxHeight: '70dvh' }}>
            <div className="handle" />
            <div className="sh-title"><span>Posición {picker.label.replace(/\d+$/, '')}</span><button className="icon-btn" onClick={() => setPicker(null)} aria-label="Cerrar"><X className="ico" /></button></div>
            {assign[picker.key] && (
              <button className="row" onClick={() => pick(null)}><div className="avatar" style={{ background: 'var(--bg3)', color: 'var(--text3)' }}>–</div><div className="ri"><div className="rn">Vaciar posición</div></div></button>
            )}
            {pool.filter((p) => !starters.has(p.id) || assign[picker.key] === p.id).map((p) => (
              <button className="row" key={p.id} onClick={() => pick(p.id)}>
                <div className="avatar">{playerTag(p)}</div>
                <div className="ri"><div className="rn">{p.name}</div><div className="rm"><span className={`badge ${posBadge[p.position]}`} style={{ fontSize: 10 }}>{p.position}</span></div></div>
                {p.id === assign[picker.key] && <span className="badge b-blue">Actual</span>}
              </button>
            ))}
            {!pool.some((p) => !starters.has(p.id) || assign[picker.key] === p.id) && <p className="hint">No quedan jugadores disponibles.</p>}
          </div>
        </div>
      )}
    </>
  );
}

function MinsInput({ p, e, total, onMins, onReset }: { p: Player; e: LineupEntry; total: number; onMins: (pid: string, v: number | null) => void; onReset: (pid: string) => void }) {
  return (
    <span className="row-flex" style={{ gap: 4 }}>
      {e.mins_manual && <button className="icon-btn" style={{ minWidth: 30, minHeight: 30 }} onClick={() => onReset(p.id)} aria-label={`Minutos de ${p.name} en automático`} title="Volver a automático"><RotateCcw className="ico-sm" /></button>}
      <NumInput className="min-input" label={`Minutos de ${p.name}`} value={e.mins} min={0} max={total + 15} onChange={(v) => onMins(p.id, v)} />
    </span>
  );
}

function MinRow({ p, e, label, total, onMins, onReset }: { p: Player; e: LineupEntry; label: string; total: number; onMins: (pid: string, v: number | null) => void; onReset: (pid: string) => void }) {
  return (
    <div className="check-row">
      <span className="badge b-gray" style={{ minWidth: 44, justifyContent: 'center' }}>{label.replace(/\d+$/, '')}</span>
      <span className="grow">{playerLabel(p)}</span>
      <MinsInput p={p} e={e} total={total} onMins={onMins} onReset={onReset} />
    </div>
  );
}
