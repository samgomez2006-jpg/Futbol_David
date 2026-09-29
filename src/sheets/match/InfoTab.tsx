import { COMPETITIONS, FORMATIONS } from '../../lib/constants';
import { Field } from '../../components/Sheet';
import type { Match, Venue } from '../../lib/types';
import { NumInput, playerLabel, type TabProps } from './common';

const PRESETS = Object.keys(FORMATIONS);
export const CUSTOM = '__custom';

export function InfoTab({ draft, set, roster, onFormation }: TabProps & { onFormation: (f: string) => void }) {
  const isPreset = PRESETS.includes(draft.tactic);
  const played = draft.status === 'played';
  return (
    <>
      <div style={{ padding: '0 var(--pad) 14px' }}>
        <div className="seg" role="radiogroup" aria-label="Estado del partido">
          <button role="radio" aria-checked={!played} className={!played ? 'on' : ''} onClick={() => set({ status: 'scheduled' })}>Programado</button>
          <button role="radio" aria-checked={played} className={played ? 'on' : ''} onClick={() => set({ status: 'played' })}>Jugado</button>
        </div>
      </div>
      <div className="frow">
        <Field label="Rival" className=""><input value={draft.rival} onChange={(e) => set({ rival: e.target.value })} placeholder="Nombre del rival" maxLength={80} /></Field>
        <Field label="Fecha" className=""><input type="date" value={draft.date} onChange={(e) => set({ date: e.target.value })} /></Field>
      </div>
      <div className="frow">
        <Field label="Local / visitante" className="">
          <select value={draft.venue} onChange={(e) => set({ venue: e.target.value as Venue })}><option value="L">Local</option><option value="V">Visitante</option></select>
        </Field>
        <Field label="Competición" className="">
          <input list="competitions-m" value={draft.competition} onChange={(e) => set({ competition: e.target.value })} placeholder="Liga, copa…" maxLength={80} />
          <datalist id="competitions-m">{COMPETITIONS.map((c) => <option key={c} value={c} />)}</datalist>
        </Field>
      </div>
      {played && (
        <div className="frow3">
          <div><span className="lbl">Goles nuestros</span><NumInput label="Goles nuestros" value={draft.gf} min={0} max={99} onChange={(v) => set({ gf: v ?? 0 })} /></div>
          <div><span className="lbl">Goles rival</span><NumInput label="Goles rival" value={draft.ga} min={0} max={99} onChange={(v) => set({ ga: v ?? 0 })} /></div>
          <div><span className="lbl">Duración</span><NumInput label="Duración en minutos" value={draft.total_mins} min={1} max={150} onChange={(v) => set({ total_mins: v ?? 60 })} /></div>
        </div>
      )}
      {!played && (
        <div className="frow">
          <Field label="Duración (min)" className=""><NumInput label="Duración en minutos" value={draft.total_mins} min={1} max={150} onChange={(v) => set({ total_mins: v ?? 60 })} /></Field>
          <div />
        </div>
      )}
      <div className="frow" style={{ gridTemplateColumns: isPreset ? '1fr' : '1fr 1fr' }}>
        <Field label="Sistema / formación" className="">
          <select value={isPreset ? draft.tactic : CUSTOM} onChange={(e) => onFormation(e.target.value === CUSTOM ? 'Personalizada' : e.target.value)}>
            {PRESETS.map((f) => <option key={f}>{f}</option>)}
            <option value={CUSTOM}>Personalizada</option>
          </select>
        </Field>
        {!isPreset && <Field label="¿Cuál?" className=""><input value={draft.tactic === 'Personalizada' ? '' : draft.tactic} onChange={(e) => set({ tactic: e.target.value.trim().slice(0, 20) || 'Personalizada' })} placeholder="4-1-4-1" maxLength={20} /></Field>}
      </div>
      {played && (
        <Field label="Jugador del partido">
          <select value={draft.motm ?? ''} onChange={(e) => set({ motm: (e.target.value || null) as Match['motm'] })}>
            <option value="">— Sin elegir —</option>
            {roster.map((p) => <option key={p.id} value={p.id}>{playerLabel(p)}</option>)}
          </select>
        </Field>
      )}
      <Field label="Observaciones del partido">
        <textarea value={draft.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="Qué funcionó, qué no, incidencias del juego… Estas observaciones se usan para detectar patrones en Analíticas." maxLength={4000} style={{ minHeight: 120 }} />
      </Field>
    </>
  );
}
