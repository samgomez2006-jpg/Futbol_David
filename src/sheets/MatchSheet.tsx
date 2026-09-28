import { useMemo, useState } from 'react';
import { Field, Sheet } from '../components/Sheet';
import { GoalGrid, Pitch } from '../components/Pitch';
import { BODY_PARTS, FIELD_ZONES, FORMATIONS, GOAL_TYPES, formationSlots, slotKey } from '../lib/constants';
import { todayISO } from '../lib/dates';
import { uid } from '../lib/id';
import { sortPlayers, validateMatch } from '../lib/stats';
import type { CardEvent, ConcededGoal, LineupEntry, Match, Player, ScoredGoal } from '../lib/types';
import { useStore } from '../store/store';
import { toast } from '../store/ui';
import { playerTag } from '../components/bits';

type Tab = 'info' | 'lineup' | 'goals' | 'cards';
const TABS: [Tab, string][] = [['info', 'Datos'], ['lineup', 'Alineación'], ['goals', 'Goles'], ['cards', 'Tarjetas']];
const PRESETS = Object.keys(FORMATIONS);

const numOrNull = (v: string) => (v.trim() === '' ? null : Math.max(0, Math.round(Number(v)) || 0));

export function MatchSheet({ id, onClose }: { id?: string; onClose: () => void }) {
  const data = useStore((s) => s.data);
  const upsert = useStore((s) => s.upsert);
  const existing = id ? data.matches.find((m) => m.id === id) : undefined;

  const [tab, setTab] = useState<Tab>('info');
  const [rival, setRival] = useState(existing?.rival ?? '');
  const [date, setDate] = useState(existing?.date ?? todayISO());
  const [venue, setVenue] = useState(existing?.venue ?? 'L');
  const [gf, setGf] = useState(String(existing?.gf ?? 0));
  const [ga, setGa] = useState(String(existing?.ga ?? 0));
  const [totalMins, setTotalMins] = useState(String(existing?.total_mins ?? 60));
  const initialTactic = existing?.tactic ?? '4-3-3';
  const [tacticSel, setTacticSel] = useState(PRESETS.includes(initialTactic) ? initialTactic : 'custom');
  const [tacticCustom, setTacticCustom] = useState(PRESETS.includes(initialTactic) ? '' : initialTactic);
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [motm, setMotm] = useState(existing?.motm ?? '');
  const [goals, setGoals] = useState<ScoredGoal[]>(existing?.goals ?? []);
  const [conceded, setConceded] = useState<ConcededGoal[]>(existing?.conceded ?? []);
  const [cards, setCards] = useState<CardEvent[]>(existing?.cards ?? []);
  const [assign, setAssign] = useState<Record<string, string>>(() =>
    Object.fromEntries((existing?.lineup ?? []).filter((e) => e.role === 'TIT' && e.slot).map((e) => [e.slot!, e.pid])),
  );
  // Minutos por jugador: si no hay override, un titular juega el partido entero.
  const [mins, setMins] = useState<Record<string, number>>(() =>
    Object.fromEntries((existing?.lineup ?? []).map((e) => [e.pid, e.mins])),
  );
  const [subs, setSubs] = useState<string[]>(() => (existing?.lineup ?? []).filter((e) => e.role === 'SUP').map((e) => e.pid));
  const [picker, setPicker] = useState<{ key: string; label: string } | null>(null);
  const [openZone, setOpenZone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const tactic = tacticSel === 'custom' ? tacticCustom.trim() || 'Personalizada' : tacticSel;
  const total = Math.min(Math.max(Number(totalMins) || 60, 1), 150);

  // Jugadores seleccionables: activos + los que ya figuran en este partido (aunque estén de baja).
  const roster = useMemo(() => {
    const ids = new Set<string>([
      ...(existing?.lineup ?? []).map((e) => e.pid),
      ...(existing?.goals ?? []).flatMap((g) => [g.pid, g.apid]).filter((x): x is string => !!x),
      ...(existing?.cards ?? []).map((c) => c.pid),
    ]);
    return sortPlayers(data.players.filter((p) => !p.archived_at || ids.has(p.id)));
  }, [data.players, existing]);
  const byId = useMemo(() => new Map(roster.map((p) => [p.id, p])), [roster]);
  const starters = Object.values(assign);
  const startersSorted = formationSlots(tactic)
    .map((s, i) => ({ key: slotKey(s, i), label: s.p }))
    .filter((x) => assign[x.key]);

  const changeFormation = (v: string) => {
    const oldSlots = formationSlots(tactic);
    const newSlots = formationSlots(v === 'custom' ? tacticCustom : v);
    // Conserva a los jugadores recolocándolos por orden (el original vaciaba la alineación).
    const next: Record<string, string> = {};
    oldSlots.forEach((s, i) => {
      const pid = assign[slotKey(s, i)];
      if (pid && newSlots[i]) next[slotKey(newSlots[i], i)] = pid;
    });
    setAssign(next);
    setTacticSel(v);
  };

  const pickPlayer = (pid: string | null) => {
    if (!picker) return;
    const next = { ...assign };
    for (const [k, v] of Object.entries(next)) if (v === pid) delete next[k];
    if (pid) next[picker.key] = pid;
    else delete next[picker.key];
    setAssign(next);
    if (pid) setSubs((s) => s.filter((x) => x !== pid));
    setPicker(null);
  };

  const save = () => {
    const lineup: LineupEntry[] = [
      ...Object.entries(assign).map(([slot, pid]) => ({ pid, role: 'TIT' as const, slot, mins: Math.min(mins[pid] ?? total, total) })),
      ...subs.filter((pid) => !starters.includes(pid)).map((pid) => ({ pid, role: 'SUP' as const, slot: null, mins: Math.min(mins[pid] ?? 0, total) })),
    ];
    const m: Match = {
      id: existing?.id ?? uid(),
      team_id: '',
      rival: rival.trim(),
      date: date || todayISO(),
      venue: venue as Match['venue'],
      gf: Math.min(Number(gf) || 0, 99),
      ga: Math.min(Number(ga) || 0, 99),
      total_mins: total,
      tactic,
      notes: notes.trim(),
      motm: motm || null,
      goals,
      conceded,
      cards: cards.filter((c) => c.pid),
      lineup,
      deleted_at: existing?.deleted_at ?? null,
    };
    const err = validateMatch(m);
    if (err) {
      setError(err);
      toast(err);
      return;
    }
    upsert('matches', m);
    toast(existing ? 'Partido actualizado ✓' : 'Partido guardado ✓');
    onClose();
  };

  const playerOptions = (placeholder: string) => (
    <>
      <option value="">{placeholder}</option>
      {roster.map((p) => (
        <option key={p.id} value={p.id}>{p.number != null ? `${p.number}. ` : ''}{p.name}</option>
      ))}
    </>
  );

  const zoneEditor = (key: string, fz: string, gz: string, set: (patch: { field_zone?: string; goal_zone?: string }) => void) =>
    openZone === key && (
      <div>
        <div className="lbl">Zona del campo</div>
        <div className="chips" style={{ marginBottom: 10 }}>
          {FIELD_ZONES.map((z) => (
            <button key={z} type="button" className={`chip ${fz === z ? 'sel' : ''}`} onClick={() => set({ field_zone: fz === z ? '' : z })}>{z}</button>
          ))}
        </div>
        <div className="lbl">Zona de portería</div>
        <GoalGrid selected={gz} onSelect={(z) => set({ goal_zone: z })} />
      </div>
    );

  return (
    <Sheet
      title={existing ? 'Editar partido' : 'Registrar partido'}
      onClose={onClose}
      actions={
        <>
          <button className="btn btn-g" style={{ flex: 1 }} onClick={onClose}>Cancelar</button>
          <button className="btn btn-p" style={{ flex: 2 }} onClick={save}>Guardar partido</button>
        </>
      }
    >
      <div className="tabs" role="tablist">
        {TABS.map(([t, l]) => (
          <button key={t} role="tab" aria-selected={tab === t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {l}
            {t === 'goals' && goals.length + conceded.length > 0 ? ` (${goals.length + conceded.length})` : ''}
            {t === 'cards' && cards.length > 0 ? ` (${cards.length})` : ''}
            {t === 'lineup' && starters.length > 0 ? ` (${starters.length})` : ''}
          </button>
        ))}
      </div>
      {error && <div className="error-box" role="alert">{error}</div>}

      {tab === 'info' && (
        <>
          <div className="frow">
            <Field label="Rival" className=""><input value={rival} onChange={(e) => setRival(e.target.value)} placeholder="Nombre del rival" maxLength={80} autoFocus={!existing} /></Field>
            <Field label="Fecha" className=""><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          </div>
          <div className="frow3">
            <Field label="Goles nuestros" className=""><input type="number" inputMode="numeric" min={0} max={99} value={gf} onChange={(e) => setGf(e.target.value)} /></Field>
            <Field label="Goles rival" className=""><input type="number" inputMode="numeric" min={0} max={99} value={ga} onChange={(e) => setGa(e.target.value)} /></Field>
            <Field label="Duración" className=""><input type="number" inputMode="numeric" min={1} max={150} value={totalMins} onChange={(e) => setTotalMins(e.target.value)} /></Field>
          </div>
          <div className="frow">
            <Field label="Local / Visitante" className="">
              <select value={venue} onChange={(e) => setVenue(e.target.value as Match['venue'])}>
                <option value="L">Local</option>
                <option value="V">Visitante</option>
              </select>
            </Field>
            <Field label="Formación" className="">
              <select value={tacticSel} onChange={(e) => changeFormation(e.target.value)}>
                {PRESETS.map((f) => <option key={f}>{f}</option>)}
                <option value="custom">Personalizada</option>
              </select>
            </Field>
          </div>
          {tacticSel === 'custom' && (
            <Field label="Formación personalizada"><input value={tacticCustom} onChange={(e) => setTacticCustom(e.target.value)} placeholder="Ej: 4-1-4-1" maxLength={20} /></Field>
          )}
          <Field label="Jugador del partido">
            <select value={motm} onChange={(e) => setMotm(e.target.value)}>{playerOptions('— Sin elegir —')}</select>
          </Field>
          <Field label="Notas"><textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observaciones del partido…" maxLength={4000} /></Field>
        </>
      )}

      {tab === 'lineup' && (
        <>
          <p className="hint">Toca una posición del campo para asignar un jugador.{tacticSel === 'custom' ? ' (Las formaciones personalizadas usan el dibujo 4-3-3.)' : ''}</p>
          <div style={{ padding: '0 var(--pad)' }}>
            <Pitch tactic={tactic} assign={assign} players={byId} onSlot={(key, label) => setPicker({ key, label })} />
          </div>
          {startersSorted.length > 0 && (
            <>
              <div className="sec-label">Minutos de los titulares</div>
              {startersSorted.map(({ key, label }) => {
                const p = byId.get(assign[key]);
                if (!p) return null;
                return (
                  <div className="check-row" key={key}>
                    <span className="badge b-gray" style={{ minWidth: 44, justifyContent: 'center' }}>{label.replace(/\d+$/, '')}</span>
                    <span className="grow">{p.name}</span>
                    <input className="min-input" type="number" inputMode="numeric" min={0} max={total} aria-label={`Minutos de ${p.name}`}
                      value={mins[p.id] ?? total} onChange={(e) => setMins({ ...mins, [p.id]: numOrNull(e.target.value) ?? 0 })} />
                  </div>
                );
              })}
            </>
          )}
          <div className="sec-label">Suplentes <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 500 }}>minutos jugados</span></div>
          {roster.filter((p) => !starters.includes(p.id)).map((p) => {
            const on = subs.includes(p.id);
            return (
              <div className="check-row" key={p.id}>
                <input type="checkbox" id={`sub-${p.id}`} checked={on} onChange={() => setSubs(on ? subs.filter((x) => x !== p.id) : [...subs, p.id])} />
                <label htmlFor={`sub-${p.id}`} className="grow">{p.name} <span className="muted xs">{p.position}</span></label>
                {on && (
                  <input className="min-input" type="number" inputMode="numeric" min={0} max={total} aria-label={`Minutos de ${p.name}`}
                    value={mins[p.id] ?? 0} onChange={(e) => setMins({ ...mins, [p.id]: numOrNull(e.target.value) ?? 0 })} />
                )}
              </div>
            );
          })}
          {!roster.length && <p className="hint">Añade jugadores a la plantilla para hacer la alineación.</p>}
        </>
      )}

      {tab === 'goals' && (
        <div style={{ padding: '0 var(--pad)' }}>
          <div className="between" style={{ marginBottom: 8 }}>
            <span className="lbl" style={{ margin: 0 }}>⚽ Goles marcados ({goals.length}/{Number(gf) || 0})</span>
          </div>
          {goals.map((g, i) => {
            const set = (patch: Partial<ScoredGoal>) => setGoals(goals.map((x, j) => (j === i ? { ...x, ...patch } : x)));
            return (
              <div className="event-card" key={g.id}>
                <div className="top">
                  <select value={g.pid ?? ''} onChange={(e) => set({ pid: e.target.value || null })} aria-label="Goleador">{playerOptions('Goleador / p.p.')}</select>
                  <input className="min-input" type="number" inputMode="numeric" placeholder="min" aria-label="Minuto" value={g.min ?? ''} onChange={(e) => set({ min: numOrNull(e.target.value) })} />
                  <button className="icon-btn danger" onClick={() => setGoals(goals.filter((_, j) => j !== i))} aria-label="Quitar gol">×</button>
                </div>
                <select value={g.apid ?? ''} onChange={(e) => set({ apid: e.target.value || null })} aria-label="Asistente">{playerOptions('Sin asistencia')}</select>
                <div className="chips">
                  {GOAL_TYPES.map((t) => <button type="button" key={t} className={`chip ${g.gtype === t ? 'sel' : ''}`} onClick={() => set({ gtype: t })}>{t}</button>)}
                </div>
                <div className="chips">
                  {BODY_PARTS.map((b) => <button type="button" key={b} className={`chip ${g.body === b ? 'sel' : ''}`} onClick={() => set({ body: b })}>{b}</button>)}
                </div>
                <button type="button" className="btn btn-g btn-xs" style={{ alignSelf: 'flex-start' }} onClick={() => setOpenZone(openZone === g.id ? null : g.id)}>
                  📍 {g.field_zone || 'Zona del campo'}{g.goal_zone ? ` · ${g.goal_zone}` : ''}
                </button>
                {zoneEditor(g.id, g.field_zone, g.goal_zone, set)}
              </div>
            );
          })}
          <button className="btn btn-g btn-sm" onClick={() => {
            const g: ScoredGoal = { id: uid(), pid: null, apid: null, min: null, gtype: 'Jugada elaborada', body: 'Pie derecho', field_zone: '', goal_zone: '' };
            setGoals([...goals, g]);
            if (goals.length + 1 > (Number(gf) || 0)) setGf(String(goals.length + 1));
          }}>+ Añadir gol</button>

          <div className="lbl" style={{ margin: '22px 0 8px' }}>🥅 Goles encajados ({conceded.length}/{Number(ga) || 0})</div>
          {conceded.map((g, i) => {
            const set = (patch: Partial<ConcededGoal>) => setConceded(conceded.map((x, j) => (j === i ? { ...x, ...patch } : x)));
            return (
              <div className="event-card" key={g.id}>
                <div className="top">
                  <span className="grow small bold muted" style={{ flex: 1 }}>Gol encajado</span>
                  <input className="min-input" type="number" inputMode="numeric" placeholder="min" aria-label="Minuto" value={g.min ?? ''} onChange={(e) => set({ min: numOrNull(e.target.value) })} />
                  <button className="icon-btn danger" onClick={() => setConceded(conceded.filter((_, j) => j !== i))} aria-label="Quitar gol encajado">×</button>
                </div>
                <div className="chips">
                  {GOAL_TYPES.map((t) => <button type="button" key={t} className={`chip ${g.gtype === t ? 'sel-red' : ''}`} onClick={() => set({ gtype: t })}>{t}</button>)}
                </div>
                <button type="button" className="btn btn-g btn-xs" style={{ alignSelf: 'flex-start' }} onClick={() => setOpenZone(openZone === g.id ? null : g.id)}>
                  📍 {g.field_zone || 'Zona del campo'}{g.goal_zone ? ` · ${g.goal_zone}` : ''}
                </button>
                {zoneEditor(g.id, g.field_zone, g.goal_zone, set)}
              </div>
            );
          })}
          <button className="btn btn-g btn-sm" onClick={() => {
            setConceded([...conceded, { id: uid(), min: null, gtype: 'Jugada elaborada', field_zone: '', goal_zone: '' }]);
            if (conceded.length + 1 > (Number(ga) || 0)) setGa(String(conceded.length + 1));
          }}>+ Añadir gol encajado</button>
        </div>
      )}

      {tab === 'cards' && (
        <div style={{ padding: '0 var(--pad)' }}>
          {cards.map((c, i) => {
            const set = (patch: Partial<CardEvent>) => setCards(cards.map((x, j) => (j === i ? { ...x, ...patch } : x)));
            return (
              <div className="event-card" key={c.id}>
                <div className="top">
                  <select value={c.pid} onChange={(e) => set({ pid: e.target.value })} aria-label="Jugador">{playerOptions('— Jugador —')}</select>
                  <select value={c.type} onChange={(e) => set({ type: e.target.value as CardEvent['type'] })} style={{ width: 76, flex: 'none' }} aria-label="Tarjeta">
                    <option value="Y">🟨</option>
                    <option value="R">🟥</option>
                  </select>
                  <input className="min-input" type="number" inputMode="numeric" placeholder="min" aria-label="Minuto" value={c.min ?? ''} onChange={(e) => set({ min: numOrNull(e.target.value) })} />
                  <button className="icon-btn danger" onClick={() => setCards(cards.filter((_, j) => j !== i))} aria-label="Quitar tarjeta">×</button>
                </div>
              </div>
            );
          })}
          {!cards.length && <p className="hint" style={{ padding: 0 }}>Sin tarjetas.</p>}
          <button className="btn btn-g btn-sm" onClick={() => setCards([...cards, { id: uid(), pid: '', type: 'Y', min: null }])}>+ Añadir tarjeta</button>
        </div>
      )}

      {picker && (
        <PosPicker
          label={picker.label}
          current={assign[picker.key]}
          players={roster.filter((p) => !starters.includes(p.id) || assign[picker.key] === p.id)}
          onPick={pickPlayer}
          onClose={() => setPicker(null)}
        />
      )}
    </Sheet>
  );
}

function PosPicker({ label, current, players, onPick, onClose }: { label: string; current?: string; players: Player[]; onPick: (pid: string | null) => void; onClose: () => void }) {
  return (
    <div className="overlay" style={{ zIndex: 200 }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={`Posición ${label}`} style={{ maxHeight: '70dvh' }}>
        <div className="handle" />
        <div className="sh-title"><span>Posición {label}</span><button className="icon-btn" onClick={onClose} aria-label="Cerrar">×</button></div>
        {current && (
          <button className="row" onClick={() => onPick(null)}>
            <div className="avatar" style={{ background: 'var(--bg3)', color: 'var(--text3)' }}>–</div>
            <div className="ri"><div className="rn">Vaciar posición</div></div>
          </button>
        )}
        {players.map((p) => (
          <button className="row" key={p.id} onClick={() => onPick(p.id)} aria-pressed={p.id === current}>
            <div className="avatar">{playerTag(p)}</div>
            <div className="ri"><div className="rn">{p.name}</div><div className="rm">{p.position}</div></div>
            {p.id === current && <span className="badge b-green">Actual</span>}
          </button>
        ))}
        {!players.length && <p className="hint">No quedan jugadores disponibles.</p>}
      </div>
    </div>
  );
}
