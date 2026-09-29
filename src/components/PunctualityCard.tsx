import { Clock } from 'lucide-react';
import { monthLabel, type PunctualityStats } from '../lib/punctuality';
import { IconBadge, Progress } from './bits';

/** Tarjeta de puntualidad de un jugador: totales, % y evolución mensual. Solo con datos registrados. */
export function PunctualityCard({ s }: { s: PunctualityStats }) {
  const sessions = s.trainings.punctual + s.trainings.late + s.trainings.absent + s.callups.punctual + s.callups.late + s.callups.absent;
  const max = Math.max(1, ...s.byMonth.map((m) => m.late));
  return (
    <div className="card">
      <div className="row-flex" style={{ marginBottom: 12 }}>
        <IconBadge icon={Clock} />
        <div className="grow"><div className="bold">Puntualidad</div><div className="xs muted">Entrenos y convocatorias</div></div>
      </div>
      {!sessions ? (
        <p className="small muted">Aún no hay entrenos ni convocatorias con puntualidad registrada.</p>
      ) : (
        <>
          <div className="stat-grid" style={{ padding: 0, gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <div className="stat-box gold"><div className="sv">{s.lates}</div><div className="sl">Retrasos</div></div>
            <div className="stat-box"><div className="sv">{s.trainings.late}</div><div className="sl">En entrenos</div></div>
            <div className="stat-box"><div className="sv">{s.callups.late}</div><div className="sl">En convoc.</div></div>
          </div>
          <div className="between" style={{ margin: '12px 0 6px' }}>
            <span className="small muted">Llega tarde el</span>
            <span className="bold num">{s.pctLate}% <span className="muted" style={{ fontWeight: 400 }}>de {s.attended} asistencias</span></span>
          </div>
          <Progress pct={s.pctLate} tone={s.pctLate <= 10 ? 'green' : s.pctLate <= 25 ? 'gold' : 'red'} />
          <div className="xs muted" style={{ marginTop: 8 }}>
            {s.withMinutes ? `Retraso medio ${s.avgMinutes} min (${s.withMinutes} con minutos anotados)` : s.lates ? 'Sin minutos de retraso anotados' : 'Sin retrasos registrados'}
            {(s.trainings.absent + s.callups.absent) > 0 && ` · ${s.trainings.absent + s.callups.absent} faltas`}
          </div>
          {s.byMonth.length > 1 && (
            <div style={{ marginTop: 14 }}>
              <div className="xs muted bold" style={{ marginBottom: 6 }}>Retrasos por mes</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 70 }} role="img" aria-label={`Retrasos por mes: ${s.byMonth.map((m) => `${monthLabel(m.month)} ${m.late}`).join(', ')}`}>
                {s.byMonth.map((m) => (
                  <div key={m.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                    <span className="xs num bold">{m.late}</span>
                    <div style={{ width: '100%', maxWidth: 34, height: `${Math.max(4, (m.late / max) * 44)}px`, borderRadius: 4, background: m.late ? 'var(--draw)' : 'var(--bg3)' }} />
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                {s.byMonth.map((m) => <span key={m.month} className="xs muted" style={{ flex: 1, textAlign: 'center' }}>{monthLabel(m.month)}</span>)}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
