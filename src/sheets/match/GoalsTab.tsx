import { MapPin, Plus, X } from 'lucide-react';
import { useState } from 'react';
import { GoalGrid } from '../../components/Pitch';
import { ZonePicker } from '../../components/Zones';
import { BODY_PARTS, CORE_GOAL_TYPES, GOAL_TYPES } from '../../lib/constants';
import { uid } from '../../lib/id';
import type { ConcededGoal, ScoredGoal } from '../../lib/types';
import { zoneLabel } from '../../lib/zones';
import { NumInput, playerLabel, type TabProps } from './common';

interface GoalPatch { field_zone?: string; goal_zone?: string; gtype?: string; min?: number | null }

function TypeChips({ value, onChange, tone }: { value: string; onChange: (t: string) => void; tone: 'for' | 'against' }) {
  const [more, setMore] = useState(!CORE_GOAL_TYPES.includes(value) && !!value);
  const list = more ? GOAL_TYPES : CORE_GOAL_TYPES;
  return (
    <div className="chips" role="radiogroup" aria-label="Tipo de gol">
      {list.map((t) => (
        <button type="button" key={t} role="radio" aria-checked={value === t} className={`chip ${value === t ? (tone === 'for' ? 'sel' : 'sel-red') : ''}`} onClick={() => onChange(t)}>{t}</button>
      ))}
      {!more && <button type="button" className="chip" onClick={() => setMore(true)}>Más…</button>}
    </div>
  );
}

function ZoneField({ open, onToggle, zone, goalZone, tone, onPatch }: { open: boolean; onToggle: () => void; zone: string; goalZone: string; tone: 'for' | 'against'; onPatch: (p: GoalPatch) => void }) {
  const [mouth, setMouth] = useState(false);
  return (
    <>
      <button type="button" className={`btn btn-xs ${zone ? 'btn-p' : 'btn-g'}`} style={{ alignSelf: 'flex-start' }} onClick={onToggle}>
        <MapPin className="ico-sm" /> {zone ? zoneLabel(zone) : 'Zona del gol'}{goalZone ? ` · ${goalZone}` : ''}
      </button>
      {open && (
        <div>
          <p className="xs muted" style={{ marginBottom: 6 }}>{tone === 'for' ? 'Toca la zona desde la que marcamos (portería rival arriba).' : 'Toca la zona desde la que nos marcan (nuestra portería arriba).'}</p>
          <ZonePicker value={zone} tone={tone} onChange={(id) => { onPatch({ field_zone: id }); if (id) onToggle(); }} />
          <button type="button" className="linkbtn" onClick={() => setMouth(!mouth)}>{mouth ? 'Ocultar' : 'Añadir'} zona de la portería (opcional)</button>
          {mouth && <GoalGrid selected={goalZone} onSelect={(z) => onPatch({ goal_zone: z })} />}
        </div>
      )}
    </>
  );
}

export function GoalsTab({ draft, set, roster }: TabProps) {
  const [openZone, setOpenZone] = useState<string | null>(null);
  const played = draft.status === 'played';

  const setGoal = (i: number, patch: Partial<ScoredGoal>) => set({ goals: draft.goals.map((g, j) => (j === i ? { ...g, ...patch } : g)) });
  const setConc = (i: number, patch: Partial<ConcededGoal>) => set({ conceded: draft.conceded.map((g, j) => (j === i ? { ...g, ...patch } : g)) });
  const opts = (ph: string) => (
    <>
      <option value="">{ph}</option>
      {roster.map((p) => <option key={p.id} value={p.id}>{playerLabel(p)}</option>)}
    </>
  );

  return (
    <div style={{ padding: '0 var(--pad)' }}>
      {!played && <div className="info-box" style={{ margin: '0 0 12px' }}>Los goles se registran cuando el partido está marcado como «Jugado».</div>}
      <div className="lbl">Goles a favor · {draft.goals.length}/{draft.gf}</div>
      {draft.goals.map((g, i) => (
        <div className="event-card" key={g.id}>
          <div className="top">
            <select value={g.pid ?? ''} onChange={(e) => setGoal(i, { pid: e.target.value || null })} aria-label="Goleador">{opts(g.gtype === 'Propia puerta' ? 'Propia puerta rival' : 'Goleador')}</select>
            <NumInput className="min-input" label="Minuto" placeholder="min" value={g.min} min={1} max={150} onChange={(v) => setGoal(i, { min: v })} />
            <button className="icon-btn danger" onClick={() => set({ goals: draft.goals.filter((_, j) => j !== i) })} aria-label="Quitar gol"><X className="ico" /></button>
          </div>
          {g.gtype !== 'Propia puerta' && <select value={g.apid ?? ''} onChange={(e) => setGoal(i, { apid: e.target.value || null })} aria-label="Asistente">{opts('Sin asistencia')}</select>}
          <TypeChips value={g.gtype} tone="for" onChange={(t) => setGoal(i, { gtype: t, ...(t === 'Propia puerta' ? { pid: null, apid: null } : {}) })} />
          <div className="chips">
            {BODY_PARTS.map((b) => <button type="button" key={b} className={`chip ${g.body === b ? 'sel' : ''}`} onClick={() => setGoal(i, { body: b })}>{b}</button>)}
          </div>
          <ZoneField open={openZone === g.id} onToggle={() => setOpenZone(openZone === g.id ? null : g.id)} zone={g.field_zone} goalZone={g.goal_zone} tone="for" onPatch={(p) => setGoal(i, p)} />
        </div>
      ))}
      <button className="btn btn-g btn-sm" onClick={() => {
        const g: ScoredGoal = { id: uid(), pid: null, apid: null, min: null, gtype: 'Jugada', body: 'Pie derecho', field_zone: '', goal_zone: '' };
        set({ goals: [...draft.goals, g], gf: Math.max(draft.gf, draft.goals.length + 1) });
        setOpenZone(g.id);
      }}><Plus className="ico-sm" /> Añadir gol</button>

      <div className="lbl" style={{ margin: '24px 0 8px' }}>Goles en contra · {draft.conceded.length}/{draft.ga}</div>
      {draft.conceded.map((g, i) => (
        <div className="event-card" key={g.id}>
          <div className="top">
            <span className="grow small bold muted">Gol encajado</span>
            <NumInput className="min-input" label="Minuto" placeholder="min" value={g.min} min={1} max={150} onChange={(v) => setConc(i, { min: v })} />
            <button className="icon-btn danger" onClick={() => set({ conceded: draft.conceded.filter((_, j) => j !== i) })} aria-label="Quitar gol encajado"><X className="ico" /></button>
          </div>
          <TypeChips value={g.gtype} tone="against" onChange={(t) => setConc(i, { gtype: t })} />
          <ZoneField open={openZone === g.id} onToggle={() => setOpenZone(openZone === g.id ? null : g.id)} zone={g.field_zone} goalZone={g.goal_zone} tone="against" onPatch={(p) => setConc(i, p)} />
        </div>
      ))}
      <button className="btn btn-g btn-sm" onClick={() => {
        const g: ConcededGoal = { id: uid(), min: null, gtype: 'Jugada', field_zone: '', goal_zone: '' };
        set({ conceded: [...draft.conceded, g], ga: Math.max(draft.ga, draft.conceded.length + 1) });
        setOpenZone(g.id);
      }}><Plus className="ico-sm" /> Añadir gol en contra</button>
    </div>
  );
}
