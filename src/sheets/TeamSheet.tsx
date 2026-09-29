import { Plus, X } from 'lucide-react';
import { useState } from 'react';
import { Field, Sheet } from '../components/Sheet';
import { FORMATIONS } from '../lib/constants';
import { uid } from '../lib/id';
import type { StaffMember } from '../lib/types';
import { useStore } from '../store/store';
import { toast } from '../store/ui';

const ROLES = ['Entrenador', 'Segundo entrenador', 'Preparador físico', 'Entrenador de porteros', 'Delegado', 'Fisioterapeuta'];
const OTHER = '__other';

export function TeamSheet({ onClose }: { onClose: () => void }) {
  const team = useStore((s) => s.team);
  const updateTeam = useStore((s) => s.updateTeam);
  const p = team.profile;
  const [name, setName] = useState(team.name);
  const [season, setSeason] = useState(team.season);
  const [category, setCategory] = useState(team.category);
  const [info, setInfo] = useState(p.info);
  const [staff, setStaff] = useState<StaffMember[]>(p.staff);
  const preset = FORMATIONS[p.system] ? p.system : p.system ? OTHER : '';
  const [systemSel, setSystemSel] = useState(preset);
  const [systemCustom, setSystemCustom] = useState(preset === OTHER ? p.system : '');
  const [model, setModel] = useState(p.model);
  const [principles, setPrinciples] = useState(p.principles);
  const [ideas, setIdeas] = useState(p.ideas);
  const [other, setOther] = useState(p.other);

  const save = () => {
    updateTeam({
      name: name.trim() || 'Mi Equipo FC', season: season.trim(), category: category.trim(),
      profile: {
        info: info.trim(), staff: staff.filter((s) => s.name.trim()).map((s) => ({ ...s, name: s.name.trim(), role: s.role.trim() })),
        system: systemSel === OTHER ? systemCustom.trim() : systemSel, model: model.trim(), principles: principles.trim(), ideas: ideas.trim(), other: other.trim(),
      },
    });
    toast('Equipo actualizado ✓');
    onClose();
  };
  const setMember = (id: string, patch: Partial<StaffMember>) => setStaff(staff.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  return (
    <Sheet title="Editar equipo" onClose={onClose}
      actions={<><button className="btn btn-g" style={{ flex: 1 }} onClick={onClose}>Cancelar</button><button className="btn btn-p" style={{ flex: 2 }} onClick={save}>Guardar</button></>}>
      <Field label="Nombre del equipo"><input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} /></Field>
      <div className="frow">
        <Field label="Categoría" className=""><input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Cadete A" maxLength={60} /></Field>
        <Field label="Temporada" className=""><input value={season} onChange={(e) => setSeason(e.target.value)} maxLength={20} /></Field>
      </div>
      <Field label="Información general"><textarea value={info} onChange={(e) => setInfo(e.target.value)} placeholder="Club, campo, horarios de entrenamiento, contexto del grupo…" maxLength={4000} /></Field>

      <div className="field-group">
        <span className="lbl">Cuerpo técnico</span>
        {staff.map((m) => (
          <div key={m.id} className="event-card" style={{ marginBottom: 8 }}>
            <div className="top">
              <input value={m.name} onChange={(e) => setMember(m.id, { name: e.target.value })} placeholder="Nombre" aria-label="Nombre" maxLength={80} />
              <button className="icon-btn danger" onClick={() => setStaff(staff.filter((s) => s.id !== m.id))} aria-label="Quitar"><X className="ico" /></button>
            </div>
            <input list="staff-roles" value={m.role} onChange={(e) => setMember(m.id, { role: e.target.value })} placeholder="Función (entrenador, delegado…)" aria-label="Función" maxLength={60} />
          </div>
        ))}
        <datalist id="staff-roles">{ROLES.map((r) => <option key={r} value={r} />)}</datalist>
        <button className="btn btn-g btn-sm" onClick={() => setStaff([...staff, { id: uid(), name: '', role: '' }])}><Plus className="ico-sm" /> Añadir persona</button>
      </div>

      <div className="frow" style={{ gridTemplateColumns: systemSel === OTHER ? '1fr 1fr' : '1fr' }}>
        <Field label="Sistema de juego habitual" className="">
          <select value={systemSel} onChange={(e) => setSystemSel(e.target.value)}>
            <option value="">Sin definir</option>
            {Object.keys(FORMATIONS).map((f) => <option key={f}>{f}</option>)}
            <option value={OTHER}>Otro…</option>
          </select>
        </Field>
        {systemSel === OTHER && <Field label="¿Cuál?" className=""><input value={systemCustom} onChange={(e) => setSystemCustom(e.target.value)} placeholder="4-1-4-1" maxLength={20} /></Field>}
      </div>
      <Field label="Modelo de juego"><textarea value={model} onChange={(e) => setModel(e.target.value)} placeholder="Cómo quieres que juegue tu equipo con y sin balón…" maxLength={4000} /></Field>
      <Field label="Principios de juego"><textarea value={principles} onChange={(e) => setPrinciples(e.target.value)} placeholder="Principios ofensivos, defensivos y de transición…" maxLength={4000} /></Field>
      <Field label="Ideas y conceptos tácticos"><textarea value={ideas} onChange={(e) => setIdeas(e.target.value)} placeholder="Conceptos que trabajáis: superioridades, basculación, coberturas…" maxLength={4000} /></Field>
      <Field label="Otros aspectos relevantes"><textarea value={other} onChange={(e) => setOther(e.target.value)} placeholder="Valores del grupo, normas, objetivos de la temporada…" maxLength={4000} /></Field>
    </Sheet>
  );
}
