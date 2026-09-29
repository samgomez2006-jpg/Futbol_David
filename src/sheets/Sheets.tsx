import { Download, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { Field, Sheet } from '../components/Sheet';
import { makeBackup, parseBackup } from '../lib/backup';
import { OBJECTIVE_LABELS, PLAYER_OBJECTIVES, POSITIONS, SKILLS, TEAM_OBJECTIVES } from '../lib/constants';
import { todayISO } from '../lib/dates';
import { uid } from '../lib/id';
import { saveTextFile } from '../lib/platform';
import { activePlayers, sortPlayers } from '../lib/stats';
import type { Arrival, Evaluation, Foot, Objective, ObjectiveCategory, Position } from '../lib/types';
import { normalizeTraining } from '../lib/normalize';
import { ArrivalEditor } from '../components/ArrivalEditor';
import { useStore } from '../store/store';
import { confirmDialog, toast, useUI, type SheetSpec } from '../store/ui';
import { CallupSheet } from './CallupSheet';
import { MatchSheet } from './match/MatchSheet';
import { TeamSheet } from './TeamSheet';

const Cancel = ({ onClose }: { onClose: () => void }) => (
  <button className="btn btn-g" style={{ flex: 1 }} onClick={onClose}>Cancelar</button>
);

// ---------------------------------------------------------------------------
export function PlayerSheet({ id, onClose }: { id?: string; onClose: () => void }) {
  const players = useStore((s) => s.data.players);
  const upsert = useStore((s) => s.upsert);
  const p = id ? players.find((x) => x.id === id) : undefined;
  const [name, setName] = useState(p?.name ?? '');
  const [number, setNumber] = useState(p?.number != null ? String(p.number) : '');
  const [position, setPosition] = useState<Position>(p?.position ?? 'Delantero');
  const [birth, setBirth] = useState(p?.birth ?? '');
  const [foot, setFoot] = useState<Foot>(p?.foot ?? 'D');

  const save = () => {
    const n = name.trim();
    if (!n) return toast('Escribe el nombre');
    const num = number.trim() === '' ? null : Math.min(Math.max(Math.round(Number(number)) || 0, 0), 99);
    const dup = num != null && players.find((x) => x.id !== id && !x.archived_at && x.number === num);
    if (dup) return toast(`El dorsal ${num} ya lo lleva ${dup.name}`);
    upsert('players', { id: p?.id ?? uid(), team_id: '', name: n, number: num, position, birth: birth || null, foot, archived_at: p?.archived_at ?? null });
    toast(p ? 'Jugador actualizado ✓' : 'Jugador añadido ✓');
    onClose();
  };

  return (
    <Sheet title={p ? 'Editar jugador' : 'Añadir jugador'} onClose={onClose}
      actions={<><Cancel onClose={onClose} /><button className="btn btn-p" style={{ flex: 2 }} onClick={save}>Guardar jugador</button></>}>
      <Field label="Nombre completo"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre del jugador" maxLength={80} autoFocus={!p} /></Field>
      <div className="frow">
        <Field label="Dorsal" className=""><input type="number" inputMode="numeric" min={0} max={99} value={number} onChange={(e) => setNumber(e.target.value)} placeholder="10" /></Field>
        <Field label="Posición" className="">
          <select value={position} onChange={(e) => setPosition(e.target.value as Position)}>{POSITIONS.map((x) => <option key={x}>{x}</option>)}</select>
        </Field>
      </div>
      <div className="frow">
        <Field label="F. nacimiento" className=""><input type="date" value={birth} max={todayISO()} onChange={(e) => setBirth(e.target.value)} /></Field>
        <Field label="Pie dominante" className="">
          <select value={foot} onChange={(e) => setFoot(e.target.value as Foot)}>
            <option value="D">Derecho</option><option value="I">Izquierdo</option><option value="A">Ambidiestro</option>
          </select>
        </Field>
      </div>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
export function TrainingSheet({ id, onClose }: { id?: string; onClose: () => void }) {
  const data = useStore((s) => s.data);
  const upsert = useStore((s) => s.upsert);
  const raw = id ? data.trainings.find((x) => x.id === id) : undefined;
  const t = raw ? normalizeTraining(raw) : undefined;
  const [date, setDate] = useState(t?.date ?? todayISO());
  const [notes, setNotes] = useState(t?.notes ?? '');
  const [att, setAtt] = useState<Record<string, Arrival | null>>(() => Object.fromEntries((t?.attendance ?? []).map(({ pid, ...a }) => [pid, a])));
  const roster = sortPlayers(activePlayers(data));
  const count = (s: Arrival['status']) => roster.filter((p) => att[p.id]?.status === s).length;
  const unmarked = roster.length - count('punctual') - count('late') - count('absent');

  const save = () => {
    const rosterIds = new Set(roster.map((p) => p.id));
    // Sin marcar = falta. Se conservan las entradas de jugadores dados de baja.
    const attendance = [
      ...roster.map((p) => ({ pid: p.id, ...(att[p.id] ?? { status: 'absent' as const }) })),
      ...Object.entries(att).filter(([pid, a]) => !rosterIds.has(pid) && a).map(([pid, a]) => ({ pid, ...a! })),
    ];
    const row = normalizeTraining({ id: t?.id ?? uid(), team_id: '', date: date || todayISO(), notes: notes.trim(), present: [], attendance });
    upsert('trainings', row);
    toast(`Entrenamiento guardado · ${row.present.length} asistentes${count('late') ? `, ${count('late')} con retraso` : ''} ✓`);
    onClose();
  };

  return (
    <Sheet title={t ? 'Editar entrenamiento' : 'Asistencia a entrenamiento'} onClose={onClose}
      actions={<><Cancel onClose={onClose} /><button className="btn btn-p" style={{ flex: 2 }} onClick={save}>Guardar</button></>}>
      <Field label="Fecha"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      <div style={{ display: 'flex', gap: 8, padding: '0 var(--pad) 8px' }}>
        <button className="btn btn-g btn-sm" style={{ flex: 2 }} onClick={() => setAtt(Object.fromEntries(roster.map((p) => [p.id, { status: 'punctual' as const }])))}>Todos puntuales</button>
        <button className="btn btn-g btn-sm" style={{ flex: 1 }} onClick={() => setAtt({})}>Limpiar</button>
      </div>
      <Field label="Notas"><input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Trabajo de hoy…" maxLength={2000} /></Field>
      <div className="sec-label">Asistencia · {roster.length} jugadores</div>
      <div className="att-sum">
        <span className="badge b-green">{count('punctual')} puntuales</span>
        <span className="badge b-gold">{count('late')} tarde</span>
        <span className="badge b-red">{count('absent')} {count('absent') === 1 ? 'falta' : 'faltas'}</span>
        {unmarked > 0 && <span className="badge b-gray">{unmarked} sin marcar (= falta)</span>}
      </div>
      {roster.map((p) => (
        <div className="att-row" key={p.id}>
          <div className="who"><span className="bold">{p.number != null ? `${p.number}. ` : ''}{p.name}</span><span className="muted xs">{p.position}</span></div>
          <ArrivalEditor name={p.name} value={att[p.id]} onChange={(a) => setAtt({ ...att, [p.id]: a })} />
        </div>
      ))}
      {!roster.length && <p className="hint">Primero añade jugadores a la plantilla.</p>}
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
export function EvalSheet({ playerId, onClose }: { playerId?: string; onClose: () => void }) {
  const data = useStore((s) => s.data);
  const upsert = useStore((s) => s.upsert);
  const [pid, setPid] = useState(playerId ?? '');
  const [date, setDate] = useState(todayISO());
  const [notes, setNotes] = useState('');
  const [skills, setSkills] = useState<Record<string, number>>(() => Object.fromEntries(SKILLS.map((s) => [s, 5])));
  const roster = sortPlayers(activePlayers(data));

  const save = () => {
    if (!pid) return toast('Selecciona un jugador');
    const e: Evaluation = { id: uid(), team_id: '', player_id: pid, date: date || todayISO(), skills, notes: notes.trim() };
    upsert('evaluations', e);
    toast('Evaluación guardada ✓');
    onClose();
  };

  return (
    <Sheet title="Evaluar jugador" onClose={onClose}
      actions={<><Cancel onClose={onClose} /><button className="btn btn-p" style={{ flex: 2 }} onClick={save}>Guardar evaluación</button></>}>
      <div className="frow">
        <Field label="Jugador" className="">
          <select value={pid} onChange={(e) => setPid(e.target.value)}>
            <option value="">— Seleccionar —</option>
            {roster.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
        <Field label="Fecha" className=""><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      </div>
      <div style={{ padding: '0 var(--pad) 6px' }}>
        {SKILLS.map((sk) => (
          <div key={sk} style={{ marginBottom: 10 }}>
            <div className="between">
              <label htmlFor={`sk-${sk}`} className="small muted">{sk}</label>
              <span className="bold num" style={{ color: 'var(--accent)' }}>{skills[sk]}/10</span>
            </div>
            <input id={`sk-${sk}`} type="range" min={1} max={10} step={1} value={skills[sk]} onChange={(e) => setSkills({ ...skills, [sk]: Number(e.target.value) })} style={{ width: '100%' }} />
          </div>
        ))}
      </div>
      <Field label="Notas del entrenador"><textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observaciones…" maxLength={2000} /></Field>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
export function ObjectiveSheet({ onClose }: { onClose: () => void }) {
  const data = useStore((s) => s.data);
  const upsert = useStore((s) => s.upsert);
  const [title, setTitle] = useState('');
  const [scope, setScope] = useState<Objective['scope']>('team');
  const [pid, setPid] = useState('');
  const [category, setCategory] = useState<ObjectiveCategory>('wins');
  const [target, setTarget] = useState('5');
  const roster = sortPlayers(activePlayers(data));
  const cats = scope === 'team' ? TEAM_OBJECTIVES : PLAYER_OBJECTIVES;

  const save = () => {
    if (!title.trim()) return toast('Escribe un título');
    if (scope === 'player' && !pid) return toast('Elige el jugador');
    const o: Objective = {
      id: uid(), team_id: '', title: title.trim(), scope, player_id: scope === 'player' ? pid : null,
      category, target: Math.max(1, Math.round(Number(target)) || 1), current: 0,
    };
    upsert('objectives', o);
    toast('Objetivo creado ✓');
    onClose();
  };

  return (
    <Sheet title="Nuevo objetivo" onClose={onClose}
      actions={<><Cancel onClose={onClose} /><button className="btn btn-p" style={{ flex: 2 }} onClick={save}>Crear objetivo</button></>}>
      <Field label="Título"><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej: Ganar 5 partidos" maxLength={120} autoFocus /></Field>
      <div className="frow">
        <Field label="Tipo" className="">
          <select value={scope} onChange={(e) => {
            const s = e.target.value as Objective['scope'];
            setScope(s);
            setCategory(s === 'team' ? 'wins' : 'goals');
          }}>
            <option value="team">Equipo</option><option value="player">Jugador</option>
          </select>
        </Field>
        {scope === 'player' ? (
          <Field label="Jugador" className="">
            <select value={pid} onChange={(e) => setPid(e.target.value)}>
              <option value="">— Elegir —</option>
              {roster.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
        ) : <div />}
      </div>
      <div className="frow">
        <Field label="Categoría" className="">
          <select value={category} onChange={(e) => setCategory(e.target.value as ObjectiveCategory)}>
            {cats.map((c) => <option key={c} value={c}>{OBJECTIVE_LABELS[c]}</option>)}
          </select>
        </Field>
        <Field label="Meta" className=""><input type="number" inputMode="numeric" min={1} value={target} onChange={(e) => setTarget(e.target.value)} /></Field>
      </div>
      {category === 'custom' && <p className="hint">El progreso de los objetivos personalizados se actualiza a mano desde la lista de objetivos.</p>}
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
export function BackupSheet({ onClose }: { onClose: () => void }) {
  const team = useStore((s) => s.team);
  const data = useStore((s) => s.data);
  const bulkAdd = useStore((s) => s.bulkAdd);
  const fileRef = useRef<HTMLInputElement>(null);

  const exportData = async () => {
    const file = `${team.name.replace(/[^\w-]+/g, '_')}_${todayISO()}.json`;
    await saveTextFile(file, JSON.stringify(makeBackup(team, data), null, 2));
    toast('Copia exportada ✓');
  };

  const importData = async (f: File) => {
    try {
      const parsed = parseBackup(JSON.parse(await f.text()), team.id);
      const n = parsed.data.players.length, m = parsed.data.matches.length;
      const ok = await confirmDialog({
        title: 'Importar copia',
        message: `Se añadirán ${n} jugadores, ${m} partidos y el resto de registros a este equipo. Los datos actuales se conservan.`,
        ok: 'Importar',
      });
      if (!ok) return;
      bulkAdd(parsed.data);
      toast('Datos importados ✓');
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Archivo no válido');
    }
  };

  return (
    <Sheet title="Copias de seguridad" onClose={onClose}>
      <p className="hint">Exporta un archivo .json con todo el equipo (plantilla, partidos, jugadas…). También puedes importar copias de la versión anterior de la app.</p>
      <div style={{ padding: '0 var(--pad) 6px', display: 'flex', gap: 10 }}>
        <button className="btn btn-g" style={{ flex: 1 }} onClick={exportData}><Download className="ico-sm" /> Exportar</button>
        <button className="btn btn-g" style={{ flex: 1 }} onClick={() => fileRef.current?.click()}><Upload className="ico-sm" /> Importar</button>
      </div>
      <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => {
        const f = e.target.files?.[0];
        if (f) void importData(f);
        e.target.value = '';
      }} />
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
export function SheetHost() {
  const sheets = useUI((s) => s.sheets);
  const close = useUI((s) => s.close);
  return (
    <>
      {sheets.map((s, i) => (
        <SheetFor key={i} spec={s} onClose={close} />
      ))}
    </>
  );
}

function SheetFor({ spec, onClose }: { spec: SheetSpec; onClose: () => void }) {
  switch (spec.kind) {
    case 'player': return <PlayerSheet id={spec.id} onClose={onClose} />;
    case 'match': return <MatchSheet id={spec.id} tab={spec.tab} onClose={onClose} />;
    case 'training': return <TrainingSheet id={spec.id} onClose={onClose} />;
    case 'eval': return <EvalSheet playerId={spec.playerId} onClose={onClose} />;
    case 'objective': return <ObjectiveSheet onClose={onClose} />;
    case 'callup': return <CallupSheet id={spec.id} onClose={onClose} />;
    case 'team': return <TeamSheet onClose={onClose} />;
    case 'backup': return <BackupSheet onClose={onClose} />;
  }
}

