import { ExternalLink } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Field, Sheet } from '../components/Sheet';
import { fcfApi } from '../lib/fcf/client';
import { FCF_WEB, type FcfLink, type FcfOption } from '../lib/fcf/types';
import { useFcf } from '../store/fcf';
import { useStore } from '../store/store';
import { toast } from '../store/ui';

/** Duración de parte sugerida según la categoría (el entrenador la puede cambiar). */
function suggestedHalf(label: string): number {
  const l = label.toUpperCase();
  if (/PREBENJAM|BENJAM/.test(l)) return 25;
  if (/ALEV/.test(l)) return 30;
  if (/INFANTIL/.test(l)) return 35;
  if (/CADET/.test(l)) return 40;
  return 45;
}

type Key = 'season' | 'discipline' | 'competition' | 'group' | 'team';

export function FcfLinkSheet({ onClose }: { onClose: () => void }) {
  const team = useStore((s) => s.team);
  const cur = team.profile.fcf ?? null;
  const nav = useNavigate();
  const [lists, setLists] = useState<Record<Key, FcfOption[] | null>>({ season: null, discipline: null, competition: null, group: null, team: null });
  const [sel, setSel] = useState<Partial<Record<Key, FcfOption>>>(cur ? { season: cur.season, discipline: cur.discipline, competition: cur.competition, group: cur.group, team: cur.team } : {});
  const [half, setHalf] = useState(String(cur?.halfMins ?? ''));
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async (k: Key, fn: () => Promise<FcfOption[]>) => {
    setLists((l) => ({ ...l, [k]: null }));
    try {
      const v = await fn();
      setLists((l) => ({ ...l, [k]: v }));
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'No se pudo consultar la FCF');
    }
  };

  useEffect(() => {
    void load('season', fcfApi.seasons);
    void load('discipline', fcfApi.disciplines);
  }, []);
  useEffect(() => {
    if (sel.season && sel.discipline) void load('competition', () => fcfApi.competitions(sel.discipline!.id, sel.season!.id));
  }, [sel.season, sel.discipline]);
  useEffect(() => {
    if (sel.competition) void load('group', () => fcfApi.groups(sel.competition!.id));
  }, [sel.competition]);
  useEffect(() => {
    if (sel.group && sel.season) void load('team', async () => (await fcfApi.group(sel.group!.id, sel.season!.id)).teams.map((t) => ({ id: t.id, label: t.name })));
  }, [sel.group, sel.season]);

  const pick = (k: Key, id: string) => {
    const opt = lists[k]?.find((o) => o.id === id);
    const order: Key[] = ['season', 'discipline', 'competition', 'group', 'team'];
    const next = { ...sel, [k]: opt };
    for (const d of order.slice(order.indexOf(k) + 1)) if (!(k === 'season' && d === 'discipline') && !(k === 'discipline' && d === 'season')) delete next[d];
    if (k === 'competition' && opt && !half) setHalf(String(suggestedHalf(opt.label)));
    setSel(next);
  };

  const select = (k: Key, label: string, placeholder: string) => {
    const list = lists[k];
    const value = sel[k]?.id ?? '';
    const options = list ?? (sel[k] ? [sel[k]!] : []);
    return (
      <Field label={label}>
        <select value={value} onChange={(e) => pick(k, e.target.value)} disabled={!list}>
          <option value="">{list ? placeholder : 'Cargando…'}</option>
          {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      </Field>
    );
  };

  const complete = sel.season && sel.discipline && sel.competition && sel.group && sel.team;
  const halfN = Number(half);
  const save = async () => {
    if (!complete) return;
    if (!(halfN >= 10 && halfN <= 60)) return toast('Indica la duración de cada parte (10–60 min)');
    const sameGroup = cur?.group.id === sel.group!.id && cur?.team.id === sel.team!.id;
    const link: FcfLink = {
      season: sel.season!, discipline: sel.discipline!, competition: sel.competition!, group: sel.group!, team: sel.team!,
      halfMins: halfN, links: sameGroup ? cur!.links : {}, linkedAt: new Date().toISOString(),
    };
    setBusy(true);
    useStore.getState().updateTeam({ profile: { ...team.profile, fcf: link } });
    await useFcf.getState().refresh(team.id, link);
    setBusy(false);
    toast('Competición vinculada ✓');
    onClose();
    nav('/competicion');
  };

  return (
    <Sheet title="Competición FCF" onClose={onClose}
      actions={<><button className="btn btn-g" style={{ flex: 1 }} onClick={onClose}>Cancelar</button><button className="btn btn-p" style={{ flex: 2 }} disabled={!complete || busy} onClick={() => void save()}>{busy ? 'Descargando…' : 'Vincular competición'}</button></>}>
      <div className="info-box">Elige tu competición tal como aparece en la web de la Federació Catalana de Futbol. Los datos oficiales (calendario, resultados, clasificación y goleadores) se descargan de la FCF y se muestran siempre marcados como <b>FCF</b>.</div>
      {err && <div className="error-box" role="alert">{err}</div>}
      <div className="frow">
        {select('season', 'Temporada', 'Elige temporada')}
        {select('discipline', 'Disciplina', 'Elige disciplina')}
      </div>
      {sel.season && sel.discipline && select('competition', 'Categoría / competición', 'Elige competición')}
      {sel.competition && select('group', 'Grupo', 'Elige grupo')}
      {sel.group && select('team', 'Tu equipo en la FCF', 'Elige tu equipo')}
      {sel.competition && (
        <Field label="Duración de cada parte (minutos)">
          <input type="number" inputMode="numeric" min={10} max={60} value={half} onChange={(e) => setHalf(e.target.value)} />
        </Field>
      )}
      {sel.competition && <p className="hint" style={{ padding: '0 var(--pad)' }}>Sirve para repartir por partes los goles de las actas. Revísala: depende de la categoría.</p>}
      <p className="hint" style={{ padding: '4px var(--pad)' }}><a href={FCF_WEB} target="_blank" rel="noreferrer" className="link"><ExternalLink className="ico-sm" /> Ver competiciones en la web de la FCF</a></p>
    </Sheet>
  );
}
