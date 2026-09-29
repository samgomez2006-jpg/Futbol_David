import { FileUp, LogOut, Plus, Users } from 'lucide-react';
import { useRef, useState } from 'react';
import { parseBackup } from '../lib/backup';
import { currentSeason } from '../lib/dates';
import { useAuth } from '../store/auth';
import { useStore } from '../store/store';
import { adoptTeam, createCloudTeam, hasLocalData, joinWithCode, signOut } from '../store/sync';
import { toast } from '../store/ui';

/** Primera vez con esta cuenta (o dispositivo con datos locales): elegir a qué equipo conectarse. */
export function Onboarding() {
  const { userId, email, teams, teamsError, reloadTeams } = useAuth();
  const local = useStore((s) => s.data);
  const localTeam = useStore((s) => s.team);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(false);
  const [name, setName] = useState(localTeam.name === 'Mi Equipo FC' ? '' : localTeam.name);
  const [season, setSeason] = useState(localTeam.season || currentSeason());
  const [category, setCategory] = useState(localTeam.category);
  const [code, setCode] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const who = { userId: userId!, email };

  const hasLocal = hasLocalData();
  const active = local.players.filter((p) => !p.archived_at).length;
  const localSummary = `${active} jugadores · ${local.matches.length} partidos`;

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      toast(ok);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo completar');
    } finally {
      setBusy(false);
    }
  };

  const importFile = async (f: File) => {
    try {
      const parsed = parseBackup(JSON.parse(await f.text()), 'tmp');
      await run(
        () => createCloudTeam(who, { name: parsed.team.name, season: parsed.team.season || currentSeason(), category: parsed.team.category }, { keepLocal: false, extra: parsed.data }).then(() => useStore.getState().updateTeam({ profile: parsed.team.profile })),
        `Equipo «${parsed.team.name}» importado ✓`,
      );
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Archivo no válido');
    }
  };

  if (teamsError)
    return (
      <div className="auth">
        <div className="brand"><img className="logo" src="/icon.svg" alt="" width={64} height={64} /><h1>Mi Equipo FC</h1></div>
        <div className="auth-card">
          <div className="error-box" style={{ margin: '0 0 12px' }} role="alert">{teamsError}</div>
          <button className="btn btn-p btn-block" onClick={() => void reloadTeams()}>Reintentar</button>
          <button className="linkbtn" onClick={() => void signOut()} style={{ marginTop: 8 }}>Cerrar sesión</button>
        </div>
      </div>
    );
  if (!teams) return <div className="splash" aria-busy="true">Cargando tu equipo…</div>;

  const existing = teams[0];
  return (
    <div className="auth">
      <div className="brand">
        <img className="logo" src="/icon.svg" alt="" width={64} height={64} />
        <h1>Bienvenido</h1>
        <p>{email}</p>
      </div>
      <div className="auth-card">
        {existing ? (
          <>
            <h2>Tu equipo</h2>
            <p className="sub">Esta cuenta ya tiene un equipo. Los datos de este dispositivo no se han subido todavía.</p>
            <button className="option-card" disabled={busy} onClick={() => void run(() => adoptTeam(who, existing, 'discard'), 'Equipo abierto ✓')}>
              <Users className="ico-lg" />
              <span><span className="ot">Abrir «{existing.name}»</span><br /><span className="os">{[existing.season, existing.category].filter(Boolean).join(' · ') || 'Equipo de tu cuenta'}</span></span>
            </button>
            {hasLocal && (
              <button className="option-card" disabled={busy} onClick={() => void run(() => adoptTeam(who, existing, 'merge'), 'Datos añadidos ✓')}>
                <Plus className="ico-lg" />
                <span><span className="ot">Abrir y añadir los datos de este dispositivo</span><br /><span className="os">{localSummary}</span></span>
              </button>
            )}
          </>
        ) : (
          <>
            <h2>Crea tu equipo</h2>
            <p className="sub">Solo se hace una vez. Después podrás editar toda la información desde la pestaña Equipo.</p>
            {hasLocal && !form && (
              <button className="option-card" disabled={busy} onClick={() => void run(() => createCloudTeam(who, { name: localTeam.name, season: localTeam.season, category: localTeam.category }, { keepLocal: true }), 'Equipo creado con tus datos ✓')}>
                <Users className="ico-lg" />
                <span><span className="ot">Usar los datos de este dispositivo</span><br /><span className="os">«{localTeam.name}» · {localSummary}. Se guardarán en tu cuenta.</span></span>
              </button>
            )}
            {!form ? (
              <button className="option-card" disabled={busy} onClick={() => setForm(true)}>
                <Plus className="ico-lg" />
                <span><span className="ot">Crear un equipo nuevo</span><br /><span className="os">Empieza desde cero.</span></span>
              </button>
            ) : (
              <div>
                <div className="fg"><label className="lbl" htmlFor="o-n">Nombre del equipo</label><input id="o-n" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoFocus placeholder="Ej: CD Sagrat Cor" /></div>
                <div className="frow" style={{ padding: 0 }}>
                  <div><label className="lbl" htmlFor="o-s">Temporada</label><input id="o-s" value={season} onChange={(e) => setSeason(e.target.value)} maxLength={20} /></div>
                  <div><label className="lbl" htmlFor="o-c">Categoría</label><input id="o-c" value={category} onChange={(e) => setCategory(e.target.value)} maxLength={60} placeholder="Cadete A" /></div>
                </div>
                <button className="btn btn-p btn-block" disabled={busy || !name.trim()} onClick={() => void run(() => createCloudTeam(who, { name: name.trim(), season: season.trim(), category: category.trim() }, { keepLocal: false }), 'Equipo creado ✓')}>Crear equipo</button>
                <button className="linkbtn" onClick={() => setForm(false)}>Cancelar</button>
              </div>
            )}
            {!form && (
              <button className="option-card" disabled={busy} onClick={() => fileRef.current?.click()}>
                <FileUp className="ico-lg" />
                <span><span className="ot">Importar una copia de seguridad</span><br /><span className="os">Archivo .json exportado de Mi Equipo FC (también de la versión anterior).</span></span>
              </button>
            )}
          </>
        )}
        {!form && (
          <div style={{ marginTop: 6 }}>
            <label className="lbl" htmlFor="o-code">¿Te han invitado a un equipo?</label>
            <div style={{ display: 'flex', gap: 10 }}>
              <input id="o-code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Código de invitación" maxLength={12} />
              <button className="btn btn-g" disabled={busy || code.length < 6} onClick={() => void run(() => joinWithCode(who, code, 'discard'), 'Te has unido al equipo ✓')}>Unirme</button>
            </div>
          </div>
        )}
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void importFile(f);
          e.target.value = '';
        }} />
        <button className="linkbtn" onClick={() => void signOut()} style={{ marginTop: 14, display: 'inline-flex', alignItems: 'center', gap: 6 }}><LogOut className="ico-sm" /> Cerrar sesión</button>
      </div>
    </div>
  );
}
