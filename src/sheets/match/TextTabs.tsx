import { Field } from '../../components/Sheet';
import type { AttackPlan, DefensePlan, RivalInfo } from '../../lib/types';
import type { TabProps } from './common';

const T = ({ label, value, onChange, ph }: { label: string; value: string; onChange: (v: string) => void; ph?: string }) => (
  <Field label={label}><textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={ph} maxLength={3000} style={{ minHeight: 72 }} /></Field>
);

export function RivalTab({ draft, set }: TabProps) {
  const r = draft.rival_info;
  const up = (patch: Partial<RivalInfo>) => set({ rival_info: { ...r, ...patch } });
  return (
    <>
      <p className="hint">Información para preparar el partido. Se guarda en la ficha de este partido.</p>
      <T label="Observaciones generales" value={r.general} onChange={(v) => up({ general: v })} ph="Nivel, clasificación, cómo juegan, resultado del último enfrentamiento…" />
      <T label="Características del rival" value={r.traits} onChange={(v) => up({ traits: v })} ph="Estilo de juego, ritmo, físico, actitud…" />
      <T label="Fortalezas" value={r.strengths} onChange={(v) => up({ strengths: v })} />
      <T label="Debilidades" value={r.weaknesses} onChange={(v) => up({ weaknesses: v })} />
      <T label="Sistema utilizado" value={r.system} onChange={(v) => up({ system: v })} ph="4-4-2 con dos puntas, línea de 5 en defensa…" />
      <T label="Jugadores relevantes" value={r.key_players} onChange={(v) => up({ key_players: v })} ph="Dorsal 10: organiza el juego. Dorsal 9: rápido…" />
      <T label="Otra información útil" value={r.other} onChange={(v) => up({ other: v })} />
    </>
  );
}

export function PlanTab({ draft, set }: TabProps) {
  const { attack: a, defense: d } = draft.plan;
  const upA = (patch: Partial<AttackPlan>) => set({ plan: { ...draft.plan, attack: { ...a, ...patch } } });
  const upD = (patch: Partial<DefensePlan>) => set({ plan: { ...draft.plan, defense: { ...d, ...patch } } });
  return (
    <>
      <div className="sec-label" style={{ paddingTop: 2 }}>Planteamiento en ataque</div>
      <T label="Objetivos ofensivos" value={a.objectives} onChange={(v) => upA({ objectives: v })} />
      <T label="Salida de balón" value={a.buildup} onChange={(v) => upA({ buildup: v })} />
      <T label="Progresión" value={a.progression} onChange={(v) => upA({ progression: v })} />
      <T label="Ataque" value={a.attack} onChange={(v) => upA({ attack: v })} />
      <T label="Ocupación de espacios" value={a.spaces} onChange={(v) => upA({ spaces: v })} />
      <T label="Principios ofensivos" value={a.principles} onChange={(v) => upA({ principles: v })} />
      <T label="Indicaciones específicas para este rival" value={a.specific} onChange={(v) => upA({ specific: v })} />
      <div className="sec-label">Planteamiento en defensa</div>
      <T label="Organización defensiva" value={d.organization} onChange={(v) => upD({ organization: v })} />
      <T label="Presión" value={d.press} onChange={(v) => upD({ press: v })} />
      <T label="Bloque defensivo" value={d.block} onChange={(v) => upD({ block: v })} />
      <T label="Marcajes" value={d.marking} onChange={(v) => upD({ marking: v })} />
      <T label="Vigilancias" value={d.vigilance} onChange={(v) => upD({ vigilance: v })} />
      <T label="Objetivos defensivos" value={d.objectives} onChange={(v) => upD({ objectives: v })} />
      <T label="Indicaciones específicas para este rival" value={d.specific} onChange={(v) => upD({ specific: v })} />
    </>
  );
}
