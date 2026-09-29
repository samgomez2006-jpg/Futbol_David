import type { Arrival, Punctuality } from '../lib/types';

const OPTIONS: [Punctuality, string, string][] = [['punctual', 'Puntual', 'sel'], ['late', 'Tarde', 'sel-gold'], ['absent', 'Falta', 'sel-red']];
const QUICK = [5, 10, 15, 20];

/** Tres estados (puntual / tarde / falta) y, si llega tarde, minutos de retraso, hora de llegada y observación. */
export function ArrivalEditor({ value, onChange, name }: { value: Arrival | null | undefined; onChange: (a: Arrival | null) => void; name: string }) {
  const status = value?.status ?? null;
  const set = (s: Punctuality) => onChange(status === s ? null : s === 'late' ? { status: 'late', minutes_late: null } : { status: s });
  return (
    <div className="arrival">
      <div className="chips" role="group" aria-label={`Puntualidad de ${name}`}>
        {OPTIONS.map(([s, label, cls]) => (
          <button key={s} type="button" className={`chip ${status === s ? cls : ''}`} aria-pressed={status === s} aria-label={`${label}: ${name}`} onClick={() => set(s)}>{label}</button>
        ))}
      </div>
      {value?.status === 'late' && (
        <div className="arrival-late">
          <div className="chips" style={{ marginBottom: 8 }}>
            {QUICK.map((m) => (
              <button key={m} type="button" className={`chip ${value.minutes_late === m ? 'sel' : ''}`} onClick={() => onChange({ ...value, minutes_late: value.minutes_late === m ? null : m })}>{m}'</button>
            ))}
          </div>
          <div className="frow" style={{ padding: 0 }}>
            <div>
              <label className="lbl">Minutos de retraso</label>
              <input type="number" inputMode="numeric" min={0} max={240} value={value.minutes_late ?? ''} placeholder="Opcional" aria-label={`Minutos de retraso de ${name}`}
                onChange={(e) => onChange({ ...value, minutes_late: e.target.value === '' ? null : Number(e.target.value) })} />
            </div>
            <div>
              <label className="lbl">Hora de llegada</label>
              <input type="time" value={value.arrival_time ?? ''} aria-label={`Hora de llegada de ${name}`} onChange={(e) => onChange({ ...value, arrival_time: e.target.value })} />
            </div>
          </div>
          <input value={value.note ?? ''} placeholder="Observación (opcional)" maxLength={300} aria-label={`Observación de ${name}`} style={{ marginTop: 8 }} onChange={(e) => onChange({ ...value, note: e.target.value })} />
        </div>
      )}
    </div>
  );
}
