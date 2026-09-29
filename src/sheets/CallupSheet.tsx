import { ArrowRight, CalendarPlus } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { posBadge } from '../components/bits';
import { Field, Sheet } from '../components/Sheet';
import { COMPETITIONS } from '../lib/constants';
import { todayISO } from '../lib/dates';
import { activePlayers, matchOfCallup, sortPlayers } from '../lib/stats';
import type { Arrival, CallupEntry, CallupStatus, Venue } from '../lib/types';
import { ArrivalEditor } from '../components/ArrivalEditor';
import { saveCallup } from '../store/actions';
import { useStore } from '../store/store';
import { toast } from '../store/ui';

export function CallupSheet({ id, onClose }: { id?: string; onClose: () => void }) {
  const data = useStore((s) => s.data);
  const nav = useNavigate();
  const c = id ? data.callups.find((x) => x.id === id) : undefined;
  const match = c ? matchOfCallup(data, c.id) : undefined;
  const [rival, setRival] = useState(c?.rival ?? '');
  const [date, setDate] = useState(c?.date ?? todayISO());
  const [meet, setMeet] = useState(c?.meet_time ?? '');
  const [place, setPlace] = useState(c?.place ?? '');
  const [venue, setVenue] = useState<Venue>(match?.venue ?? 'L');
  const [competition, setCompetition] = useState(match?.competition ?? '');
  // Copia local: cancelar no modifica la convocatoria guardada.
  const [state, setState] = useState<CallupEntry[]>(() => (c?.players ?? []).map((x) => ({ ...x })));
  const inCallup = new Set((c?.players ?? []).map((p) => p.pid));
  const roster = sortPlayers(data.players.filter((p) => !p.archived_at || inCallup.has(p.id)));
  const statusOf = (pid: string): CallupStatus => state.find((x) => x.pid === pid)?.status ?? 'pending';
  const setStatus = (pid: string, s: CallupStatus) => {
    const next = statusOf(pid) === s ? 'pending' : s;
    setState([...state.filter((x) => x.pid !== pid), { ...state.find((x) => x.pid === pid), pid, status: next }]);
  };
  const setArrival = (pid: string, arrival: Arrival | null) => setState(state.map((x) => (x.pid === pid ? { ...x, arrival } : x)));
  const called = state.filter((x) => x.status === 'confirmed').length;
  const allActive = activePlayers(data);

  const save = () => {
    if (!rival.trim()) return toast('Escribe el rival');
    const { match: m } = saveCallup({
      id: c?.id, rival: rival.trim(), date: date || todayISO(), meet_time: meet.trim(), place: place.trim(), venue,
      competition: competition.trim(), players: state,
    });
    toast(c ? 'Convocatoria actualizada ✓' : 'Convocatoria creada y partido añadido ✓');
    onClose();
    if (!c) nav(`/partidos/${m.id}`);
  };

  return (
    <Sheet title={c ? 'Editar convocatoria' : 'Nueva convocatoria'} onClose={onClose}
      actions={<><button className="btn btn-g" style={{ flex: 1 }} onClick={onClose}>Cancelar</button><button className="btn btn-p" style={{ flex: 2 }} onClick={save}>Guardar</button></>}>
      {c && match ? (
        <button className="info-box" style={{ width: 'calc(100% - 2 * var(--pad))', border: 'none', textAlign: 'left', display: 'flex', gap: 8, alignItems: 'center' }} onClick={() => { onClose(); nav(`/partidos/${match.id}`); }}>
          <ArrowRight className="ico-sm" /> Partido asociado: vs {match.rival} — abrir ficha
        </button>
      ) : (
        <div className="info-box" style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}><CalendarPlus className="ico-sm" style={{ marginTop: 2 }} /> Al guardar se crea automáticamente el partido en «Partidos» con estos convocados; después solo tienes que completar su ficha.</div>
      )}
      <div className="frow">
        <Field label="Rival" className=""><input value={rival} onChange={(e) => setRival(e.target.value)} placeholder="Nombre del rival" maxLength={80} autoFocus={!c} /></Field>
        <Field label="Fecha" className=""><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      </div>
      <div className="frow">
        <Field label="Hora de citación" className=""><input value={meet} onChange={(e) => setMeet(e.target.value)} placeholder="10:00" maxLength={40} /></Field>
        <Field label="Lugar" className=""><input value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Campo municipal" maxLength={120} /></Field>
      </div>
      <div className="frow">
        <Field label="Local / visitante" className="">
          <select value={venue} onChange={(e) => setVenue(e.target.value as Venue)}><option value="L">Local</option><option value="V">Visitante</option></select>
        </Field>
        <Field label="Competición" className=""><input list="competitions" value={competition} onChange={(e) => setCompetition(e.target.value)} placeholder="Liga, copa…" maxLength={80} /><datalist id="competitions">{COMPETITIONS.map((x) => <option key={x} value={x} />)}</datalist></Field>
      </div>
      <div className="sec-label">
        <span>Convocados · {called}</span>
        <span className="row-flex">
          <button className="link" onClick={() => setState(allActive.map((p) => ({ pid: p.id, status: statusOf(p.id) === 'declined' ? 'declined' : 'confirmed' })))}>Todos</button>
          <button className="link" onClick={() => setState(state.map((x) => ({ ...x, status: 'pending' })))}>Ninguno</button>
        </span>
      </div>
      {roster.map((p) => {
        const st = statusOf(p.id);
        return (
          <div className="check-row" key={p.id}>
            <div className="grow"><div className="bold small">{p.number != null ? `${p.number}. ` : ''}{p.name}</div><div><span className={`badge ${posBadge[p.position]}`} style={{ fontSize: 10 }}>{p.position}</span></div></div>
            <button className={`chip ${st === 'confirmed' ? 'sel' : ''}`} onClick={() => setStatus(p.id, 'confirmed')} aria-pressed={st === 'confirmed'} aria-label={`Convocar a ${p.name}`}>Convocado</button>
            <button className={`chip ${st === 'declined' ? 'sel-red' : ''}`} onClick={() => setStatus(p.id, 'declined')} aria-pressed={st === 'declined'} aria-label={`Baja de ${p.name}`}>Baja</button>
          </div>
        );
      })}
      {!roster.length && <p className="hint">Primero añade jugadores a la plantilla.</p>}
      {c && called > 0 && (
        <>
          <div className="sec-label"><span>Puntualidad el día del partido</span></div>
          <p className="hint" style={{ padding: '0 var(--pad) 6px' }}>Opcional: se suma al historial de puntualidad de cada jugador.</p>
          {roster.filter((p) => statusOf(p.id) === 'confirmed').map((p) => (
            <div className="att-row" key={p.id}>
              <div className="who"><span className="bold">{p.number != null ? `${p.number}. ` : ''}{p.name}</span></div>
              <ArrivalEditor name={p.name} value={state.find((x) => x.pid === p.id)?.arrival} onChange={(a) => setArrival(p.id, a)} />
            </div>
          ))}
        </>
      )}
    </Sheet>
  );
}
