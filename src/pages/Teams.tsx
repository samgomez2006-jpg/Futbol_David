import { Check, Pencil, Plus, Trash2, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Empty, TopBar } from '../components/bits';
import { currentSeason } from '../lib/dates';
import { useAuth } from '../store/auth';
import { useStore } from '../store/store';
import { addTeam, removeTeam, switchTeam, teamCounts, type MyTeam } from '../store/sync';
import { confirmDialog, openSheet, toast } from '../store/ui';

const LABELS: [string, string, string][] = [
  ['players', 'jugador', 'jugadores'],
  ['matches', 'partido', 'partidos'],
  ['callups', 'convocatoria', 'convocatorias'],
  ['trainings', 'entrenamiento', 'entrenamientos'],
  ['evaluations', 'evaluación', 'evaluaciones'],
  ['objectives', 'objetivo', 'objetivos'],
  ['plays', 'jugada', 'jugadas'],
];

/** Mis equipos: crear, cambiar de equipo activo, editar y eliminar. Cada equipo tiene sus datos totalmente separados. */
export default function Teams() {
  const { userId, teams, reloadTeams } = useAuth();
  const active = useStore((s) => s.team);
  const mode = useStore((s) => s.mode);
  const nav = useNavigate();
  const [busy, setBusy] = useState<string | null>(null);
  const [form, setForm] = useState(false);
  const [name, setName] = useState('');
  const [season, setSeason] = useState(currentSeason());
  const [category, setCategory] = useState('');

  useEffect(() => void reloadTeams(), [reloadTeams]);

  const list: MyTeam[] = (teams ?? []).map((t) => (t.id === active.id ? { ...t, ...active } : t));
  if (!list.some((t) => t.id === active.id) && mode === 'cloud' && teams) list.unshift({ ...active, role: 'owner' });

  const guard = async (key: string, fn: () => Promise<unknown>, ok?: string) => {
    setBusy(key);
    try {
      await fn();
      if (ok) toast(ok);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo completar');
    } finally {
      setBusy(null);
    }
  };

  const open = (t: MyTeam) => guard(t.id, async () => { await switchTeam(t); nav('/'); }, `Equipo «${t.name}» activo`);

  const create = () =>
    guard('new', async () => {
      await addTeam({ name: name.trim(), season: season.trim(), category: category.trim() });
      await reloadTeams();
      setForm(false);
      setName('');
      setCategory('');
      nav('/');
    }, 'Equipo creado ✓');

  const del = async (t: MyTeam) => {
    const owner = t.role === 'owner';
    let counts: Record<string, number> | null = null;
    try {
      counts = await teamCounts(t.id);
    } catch {
      /* sin conexión: se avisa igualmente de forma genérica */
    }
    const parts = counts ? LABELS.filter(([k]) => counts![k] > 0).map(([k, one, many]) => `${counts![k]} ${counts![k] === 1 ? one : many}`) : [];
    const hasData = !counts || parts.length > 0;
    const isActive = t.id === active.id;
    const message = owner
      ? `Se eliminará el equipo «${t.name}» y TODOS sus datos${parts.length ? `: ${parts.join(', ')}` : counts ? '' : ' (no se ha podido comprobar cuántos hay)'}. Esta acción no se puede deshacer y afecta también a los demás entrenadores del equipo.`
      : `Dejarás de ver «${t.name}» y sus datos. El equipo y su información seguirán existiendo para el resto del cuerpo técnico.`;
    if (!(await confirmDialog({ title: owner ? '¿Eliminar equipo?' : '¿Salir del equipo?', message, ok: owner ? 'Eliminar' : 'Salir', danger: true }))) return;
    if (owner && hasData && !(await confirmDialog({ title: 'Última confirmación', message: `Vas a borrar definitivamente «${t.name}» con todos sus datos. ¿Seguro?`, ok: 'Sí, eliminar todo', danger: true }))) return;
    await guard(t.id, async () => {
      const next = await removeTeam(t, userId!);
      await reloadTeams();
      if (isActive && next) nav('/');
    }, owner ? 'Equipo eliminado' : 'Has salido del equipo');
  };

  return (
    <div className="page">
      <TopBar back="Equipo" backTo="/equipo" title="Mis equipos" subtitle={`${list.length} ${list.length === 1 ? 'equipo' : 'equipos'} · datos independientes`} right={mode === 'cloud' && <button className="btn btn-p btn-sm" onClick={() => setForm(true)}><Plus className="ico-sm" /> Nuevo</button>} />
      <div className="page-inner" style={{ paddingTop: 14 }}>
        {mode !== 'cloud' ? (
          <Empty icon={Users}>Para gestionar varios equipos inicia sesión con tu cuenta.</Empty>
        ) : (
          <>
            {form && (
              <div className="card">
                <div className="bold" style={{ marginBottom: 10 }}>Nuevo equipo</div>
                <div className="fg"><label className="lbl" htmlFor="nt-n">Nombre del equipo</label><input id="nt-n" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoFocus placeholder="Ej: CD Sagrat Cor B" /></div>
                <div className="frow" style={{ padding: 0 }}>
                  <div><label className="lbl" htmlFor="nt-s">Temporada</label><input id="nt-s" value={season} onChange={(e) => setSeason(e.target.value)} maxLength={20} /></div>
                  <div><label className="lbl" htmlFor="nt-c">Categoría</label><input id="nt-c" value={category} onChange={(e) => setCategory(e.target.value)} maxLength={60} placeholder="Cadete A" /></div>
                </div>
                <div className="row-flex" style={{ marginTop: 12 }}>
                  <button className="btn btn-g" style={{ flex: 1 }} onClick={() => setForm(false)}>Cancelar</button>
                  <button className="btn btn-p" style={{ flex: 2 }} disabled={!name.trim() || busy === 'new'} onClick={() => void create()}>Crear equipo</button>
                </div>
              </div>
            )}
            {!teams && <div className="hint" style={{ textAlign: 'center' }}>Cargando equipos…</div>}
            {list.map((t) => {
              const isActive = t.id === active.id;
              return (
                <div className="card" key={t.id} style={isActive ? { borderColor: 'var(--accent)' } : undefined}>
                  <div className="between">
                    <div style={{ minWidth: 0 }}>
                      <div className="bold" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</div>
                      <div className="xs muted">{[t.season, t.category].filter(Boolean).join(' · ') || 'Sin categoría'} · {t.role === 'owner' ? 'Propietario' : 'Cuerpo técnico'}</div>
                    </div>
                    {isActive && <span className="chip sel"><Check className="ico-sm" /> Activo</span>}
                  </div>
                  <div className="row-flex" style={{ marginTop: 10 }}>
                    {isActive ? (
                      <button className="btn btn-g btn-sm" onClick={() => openSheet({ kind: 'team' })}><Pencil className="ico-sm" /> Editar</button>
                    ) : (
                      <button className="btn btn-p btn-sm" disabled={busy !== null} onClick={() => void open(t)}>{busy === t.id ? 'Abriendo…' : 'Abrir este equipo'}</button>
                    )}
                    <button className="btn btn-danger btn-sm" disabled={busy !== null} onClick={() => void del(t)}><Trash2 className="ico-sm" /> {t.role === 'owner' ? 'Eliminar' : 'Salir'}</button>
                  </div>
                </div>
              );
            })}
          </>
        )}
        <div className="spacer" />
      </div>
    </div>
  );
}
