import { Plus, X } from 'lucide-react';
import { uid } from '../../lib/id';
import type { CardEvent } from '../../lib/types';
import { NumInput, playerLabel, type TabProps } from './common';

export function IncidentsTab({ draft, set, roster }: TabProps) {
  const setCard = (i: number, patch: Partial<CardEvent>) => set({ cards: draft.cards.map((c, j) => (j === i ? { ...c, ...patch } : c)) });
  return (
    <div style={{ padding: '0 var(--pad)' }}>
      <div className="lbl">Tarjetas</div>
      {draft.cards.map((c, i) => (
        <div className="event-card" key={c.id}>
          <div className="top">
            <select value={c.pid} onChange={(e) => setCard(i, { pid: e.target.value })} aria-label="Jugador">
              <option value="">— Jugador —</option>
              {roster.map((p) => <option key={p.id} value={p.id}>{playerLabel(p)}</option>)}
            </select>
            <select value={c.type} onChange={(e) => setCard(i, { type: e.target.value as CardEvent['type'] })} style={{ width: 76, flex: 'none' }} aria-label="Tarjeta"><option value="Y">🟨</option><option value="R">🟥</option></select>
            <NumInput className="min-input" label="Minuto" placeholder="min" value={c.min} min={1} max={150} onChange={(v) => setCard(i, { min: v })} />
            <button className="icon-btn danger" onClick={() => set({ cards: draft.cards.filter((_, j) => j !== i) })} aria-label="Quitar tarjeta"><X className="ico" /></button>
          </div>
        </div>
      ))}
      <button className="btn btn-g btn-sm" onClick={() => set({ cards: [...draft.cards, { id: uid(), pid: '', type: 'Y', min: null }] })}><Plus className="ico-sm" /> Añadir tarjeta</button>
      <p className="hint" style={{ padding: '8px 0 0' }}>Una tarjeta roja corta automáticamente los minutos del jugador.</p>

      <div className="lbl" style={{ margin: '22px 0 8px' }}>Incidencias del partido</div>
      {draft.incidents.map((inc, i) => (
        <div className="event-card" key={inc.id}>
          <div className="top">
            <input value={inc.text} onChange={(e) => set({ incidents: draft.incidents.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })} placeholder="Lesión, cambio de campo, protesta, árbitro…" aria-label="Incidencia" maxLength={500} />
            <NumInput className="min-input" label="Minuto" placeholder="min" value={inc.min} min={1} max={150} onChange={(v) => set({ incidents: draft.incidents.map((x, j) => (j === i ? { ...x, min: v } : x)) })} />
            <button className="icon-btn danger" onClick={() => set({ incidents: draft.incidents.filter((_, j) => j !== i) })} aria-label="Quitar incidencia"><X className="ico" /></button>
          </div>
        </div>
      ))}
      <button className="btn btn-g btn-sm" onClick={() => set({ incidents: [...draft.incidents, { id: uid(), min: null, text: '' }] })}><Plus className="ico-sm" /> Añadir incidencia</button>
    </div>
  );
}
