import { useState } from 'react';
import { TopBar } from '../components/bits';
import { fmtDate } from '../lib/dates';
import { shareText } from '../lib/platform';
import { cloudEnabled, supabase } from '../lib/supabase';
import { useStore } from '../store/store';
import { connectAccount, hasLocalData, joinWithCode, signOut, syncNow, type LocalStrategy } from '../store/sync';
import { confirmDialog, openSheet, toast } from '../store/ui';

export default function Account() {
  const mode = useStore((s) => s.mode);
  const email = useStore((s) => s.userEmail);
  const team = useStore((s) => s.team);
  const sync = useStore((s) => s.sync);
  const syncError = useStore((s) => s.syncError);
  const pending = useStore((s) => s.outbox.length);
  const lastSyncAt = useStore((s) => s.lastSyncAt);

  return (
    <div className="page">
      <TopBar back="Inicio" backTo="/" title="Cuenta y equipo" />
      <div className="page-inner">
        <div className="sec-label">Equipo</div>
        <div className="card flush">
          <div className="srow"><span className="srl">Nombre</span><span className="srv">{team.name}</span></div>
          <div className="srow"><span className="srl">Temporada</span><span className="srv">{team.season || '—'}</span></div>
          <div className="srow"><span className="srl">Categoría</span><span className="srv">{team.category || '—'}</span></div>
        </div>
        <div style={{ padding: '0 var(--pad)' }}>
          <button className="btn btn-g btn-block" onClick={() => openSheet({ kind: 'settings' })}>⚙️ Editar equipo · copias de seguridad</button>
        </div>

        {!cloudEnabled ? (
          <>
            <div className="sec-label">Nube</div>
            <div className="card small muted">Esta instalación no tiene Supabase configurado: los datos se guardan solo en este dispositivo. Usa Exportar para hacer copias.</div>
          </>
        ) : !email ? (
          <Login />
        ) : mode === 'guest' ? (
          <LinkAccount email={email} />
        ) : (
          <>
            <div className="sec-label">Sincronización</div>
            <div className="card flush">
              <div className="srow"><span className="srl">Cuenta</span><span className="srv" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{email}</span></div>
              <div className="srow"><span className="srl">Estado</span><span className="srv">{{ idle: 'Al día', syncing: 'Sincronizando…', offline: 'Sin conexión', error: 'Error' }[sync]}</span></div>
              <div className="srow"><span className="srl">Cambios pendientes</span><span className="srv num">{pending}</span></div>
              <div className="srow"><span className="srl">Última sincronización</span><span className="srv">{lastSyncAt ? `${fmtDate(lastSyncAt.slice(0, 10))} ${lastSyncAt.slice(11, 16)} UTC` : '—'}</span></div>
            </div>
            {syncError && (
              <div className="error-box" role="alert">
                {syncError}{' '}
                <button className="btn btn-xs btn-g" onClick={() => useStore.getState()._set({ syncError: null, sync: 'idle' })}>Ocultar</button>
              </div>
            )}
            <div style={{ padding: '0 var(--pad)' }}>
              <button className="btn btn-g btn-block" onClick={async () => { await syncNow(); toast('Sincronizado'); }}>🔄 Sincronizar ahora</button>
            </div>

            <div className="sec-label">Cuerpo técnico</div>
            <div className="card">
              <p className="small muted" style={{ marginBottom: 10 }}>Comparte este código con otros entrenadores para que gestionen el mismo equipo desde sus móviles.</p>
              <div className="code">{team.invite_code ?? '········'}</div>
              {team.invite_code && (
                <button className="btn btn-g btn-sm btn-block" style={{ marginTop: 10 }} onClick={async () => {
                  const r = await shareText('Únete a mi equipo', `Únete a ${team.name} en Mi Equipo FC con el código: ${team.invite_code}`);
                  if (r === 'copied') toast('Código copiado ✓');
                }}>📤 Compartir código</button>
              )}
            </div>
            <div style={{ padding: '0 var(--pad)' }}>
              <button className="btn btn-danger btn-block" onClick={async () => {
                const ok = await confirmDialog({
                  title: 'Cerrar sesión',
                  message: pending ? `Hay ${pending} cambios sin subir. Se intentará sincronizar antes; si no hay conexión se perderán.` : 'Los datos siguen guardados en la nube.',
                  ok: 'Cerrar sesión', danger: !!pending,
                });
                if (ok) { await signOut(); toast('Sesión cerrada'); }
              }}>Cerrar sesión</button>
            </div>
          </>
        )}
        <p className="hint" style={{ textAlign: 'center', marginTop: 24 }}>Mi Equipo FC · v{__APP_VERSION__}</p>
        <div className="spacer" />
      </div>
    </div>
  );
}

function Login() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const send = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email)) return toast('Escribe un email válido');
    setBusy(true);
    const { error } = await supabase!.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true, emailRedirectTo: window.location.origin + '/cuenta' },
    });
    setBusy(false);
    if (error) return toast(error.message);
    setSent(true);
    toast('Te hemos enviado un email ✓');
  };
  const verify = async () => {
    setBusy(true);
    const { error } = await supabase!.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
    setBusy(false);
    if (error) toast('Código incorrecto o caducado');
  };

  return (
    <>
      <div className="sec-label">Guardar en la nube</div>
      <div className="card">
        <p className="small muted" style={{ marginBottom: 12, lineHeight: 1.5 }}>
          Ahora mismo tus datos están solo en este dispositivo. Inicia sesión para tener copia en la nube,
          usar la app en varios móviles y compartir el equipo con tu cuerpo técnico.
        </p>
        <label className="lbl" htmlFor="login-email">Email</label>
        <input id="login-email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="entrenador@email.com" disabled={sent} />
        {!sent ? (
          <button className="btn btn-p btn-block" style={{ marginTop: 12 }} onClick={send} disabled={busy}>{busy ? 'Enviando…' : 'Enviar código de acceso'}</button>
        ) : (
          <>
            <p className="xs muted" style={{ margin: '10px 0' }}>Abre el email y escribe el código de 6 dígitos (o pulsa el enlace si estás en este mismo dispositivo).</p>
            <input inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="123456" aria-label="Código" style={{ textAlign: 'center', letterSpacing: 4, fontSize: 20 }} />
            <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
              <button className="btn btn-g" style={{ flex: 1 }} onClick={() => { setSent(false); setCode(''); }}>Cambiar email</button>
              <button className="btn btn-p" style={{ flex: 2 }} onClick={verify} disabled={busy || code.length < 6}>Entrar</button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

/** Con sesión pero el dispositivo sigue en modo invitado: decidir qué equipo usar. */
function LinkAccount({ email }: { email: string }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const local = hasLocalData();

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      toast(ok);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Error');
    } finally {
      setBusy(false);
    }
  };
  const strategy = async (): Promise<LocalStrategy | null> => {
    if (!local) return 'discard';
    const merge = await confirmDialog({ title: 'Datos de este dispositivo', message: '¿Añadir los datos que tienes en este dispositivo al equipo? Si eliges Cancelar se descartarán.', ok: 'Añadir al equipo' });
    return merge ? 'merge' : (await confirmDialog({ title: '¿Descartar datos locales?', message: 'Se borrarán los datos de este dispositivo que no estén en la nube.', ok: 'Descartar', danger: true })) ? 'discard' : null;
  };

  return (
    <>
      <div className="sec-label">Conectar equipo</div>
      <div className="card">
        <p className="small muted" style={{ marginBottom: 12 }}>Sesión iniciada como <b>{email}</b>.</p>
        <button className="btn btn-p btn-block" disabled={busy} onClick={() => run(async () => {
          const { data } = await supabase!.auth.getSession();
          if (!data.session) throw new Error('Sesión caducada');
          const s = await strategy();
          if (s) await connectAccount(data.session, s);
        }, 'Equipo conectado ✓')}>
          {local ? 'Subir mis datos / abrir mi equipo' : 'Abrir mi equipo'}
        </button>
        <div className="lbl" style={{ margin: '16px 0 6px' }}>¿Te han invitado? Código del equipo</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ABCD1234" maxLength={12} aria-label="Código de invitación" />
          <button className="btn btn-g" disabled={busy || code.length < 6} onClick={() => run(async () => {
            const s = await strategy();
            if (s) await joinWithCode(code, s);
          }, 'Te has unido al equipo ✓')}>Unirme</button>
        </div>
      </div>
      <div style={{ padding: '0 var(--pad)' }}>
        <button className="btn btn-g btn-block" onClick={() => void supabase!.auth.signOut()}>Usar otra cuenta</button>
      </div>
    </>
  );
}
