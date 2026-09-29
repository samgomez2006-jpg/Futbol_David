import { ArrowLeft, Mail, MailCheck } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { requestPasswordReset, resendConfirmation, sendCode, setNewPassword, signInPassword, signUpPassword, useAuth, verifyCode } from '../store/auth';

type View = 'in' | 'up' | 'code' | 'code-verify' | 'reset' | 'reset-sent' | 'confirm';

function Brand({ subtitle }: { subtitle: string }) {
  return (
    <div className="brand">
      <img className="logo" src="/icon.svg" alt="" width={64} height={64} />
      <h1>Mi Equipo FC</h1>
      <p>{subtitle}</p>
    </div>
  );
}

export function AuthScreen() {
  const notice = useAuth((s) => s.notice);
  const setNotice = useAuth((s) => s.setNotice);
  const [view, setView] = useState<View>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const go = (v: View) => {
    setView(v);
    setError(null);
    setInfo(null);
    setNotice(null);
  };
  const run = async (fn: () => Promise<{ ok: true; needsConfirm?: boolean } | { ok: false; error: string }>, onOk?: (needsConfirm?: boolean) => void) => {
    setBusy(true);
    setError(null);
    setInfo(null);
    const r = await fn();
    setBusy(false);
    if (r.ok) onOk?.(r.needsConfirm);
    else setError(r.error);
  };
  const validEmail = /^\S+@\S+\.\S+$/.test(email.trim());
  const needEmail = () => !validEmail && (setError('Escribe un email válido.'), true);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (needEmail()) return;
    if (view === 'in') void run(() => signInPassword(email, password));
    else if (view === 'up') void run(() => signUpPassword(email, password), (nc) => nc && go('confirm'));
    else if (view === 'code') void run(() => sendCode(email), () => setView('code-verify'));
    else if (view === 'code-verify') void run(() => verifyCode(email, code));
    else if (view === 'reset') void run(() => requestPasswordReset(email), () => setView('reset-sent'));
  };

  const tabs = view === 'in' || view === 'up';

  return (
    <div className="auth">
      <Brand subtitle="La herramienta del entrenador de fútbol" />
      <div className="auth-card">
        {notice && <div className={notice.kind === 'ok' ? 'ok-box' : 'error-box'} style={{ margin: '0 0 14px' }} role="alert">{notice.text}</div>}

        {tabs && (
          <div className="seg" role="tablist">
            <button role="tab" aria-selected={view === 'in'} className={view === 'in' ? 'on' : ''} onClick={() => go('in')}>Entrar</button>
            <button role="tab" aria-selected={view === 'up'} className={view === 'up' ? 'on' : ''} onClick={() => go('up')}>Crear cuenta</button>
          </div>
        )}

        {view === 'confirm' ? (
          <>
            <h2 style={{ display: 'flex', gap: 8, alignItems: 'center' }}><MailCheck className="ico" /> Verifica tu email</h2>
            <p className="sub">Te hemos enviado un correo a <b>{email}</b>.</p>
            <ol className="steps">
              <li><span>Abre el correo y pulsa el enlace de verificación.</span></li>
              <li><span>Si el enlace te lleva a una página que no carga o a otra dirección, <b>no pasa nada</b>: tu email ya queda verificado.</span></li>
              <li><span>Vuelve aquí y pulsa «Ya he verificado mi email».</span></li>
            </ol>
            {error && <div className="error-box" style={{ margin: '0 0 12px' }} role="alert">{error}</div>}
            {info && <div className="ok-box" style={{ margin: '0 0 12px' }} role="status">{info}</div>}
            <button className="btn btn-p btn-block" disabled={busy} onClick={() => void run(() => signInPassword(email, password))}>Ya he verificado mi email</button>
            <div className="between" style={{ marginTop: 10 }}>
              <button className="linkbtn" disabled={busy} onClick={() => void run(() => resendConfirmation(email), () => setInfo('Correo reenviado. Revisa también la carpeta de spam.'))}>Reenviar el correo</button>
              <button className="linkbtn" onClick={() => go('up')}>Cambiar email</button>
            </div>
          </>
        ) : view === 'reset-sent' ? (
          <>
            <h2 style={{ display: 'flex', gap: 8, alignItems: 'center' }}><MailCheck className="ico" /> Revisa tu email</h2>
            <p className="sub">Si existe una cuenta con <b>{email}</b>, recibirás un enlace para elegir una contraseña nueva.</p>
            <button className="btn btn-g btn-block" onClick={() => go('in')}>Volver a entrar</button>
          </>
        ) : (
          <form onSubmit={submit} noValidate>
            {(view === 'code' || view === 'code-verify' || view === 'reset') && (
              <>
                <button type="button" className="back-btn" onClick={() => go('in')} style={{ marginBottom: 8 }}><ArrowLeft className="ico" /> Volver</button>
                <h2>{view === 'reset' ? 'Recuperar contraseña' : 'Entrar con un código'}</h2>
                <p className="sub">{view === 'reset' ? 'Te enviaremos un enlace para crear una contraseña nueva.' : 'Te enviamos un código de 6 dígitos al email. Sin contraseña.'}</p>
              </>
            )}
            <div className="fg">
              <label className="lbl" htmlFor="a-email">Email</label>
              <input id="a-email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="entrenador@email.com" disabled={view === 'code-verify'} />
            </div>
            {(view === 'in' || view === 'up') && (
              <div className="fg">
                <label className="lbl" htmlFor="a-pass">Contraseña</label>
                <input id="a-pass" type="password" autoComplete={view === 'in' ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={view === 'up' ? 'Mínimo 8 caracteres' : '••••••••'} />
              </div>
            )}
            {view === 'code-verify' && (
              <div className="fg">
                <label className="lbl" htmlFor="a-code">Código</label>
                <input id="a-code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="123456" style={{ textAlign: 'center', letterSpacing: 6, fontSize: 22 }} autoFocus />
              </div>
            )}
            {error && <div className="error-box" style={{ margin: '0 0 12px' }} role="alert">{error}</div>}
            <button className="btn btn-p btn-block" type="submit" disabled={busy || (view === 'code-verify' && code.length < 6)}>
              {busy ? 'Un momento…' : view === 'in' ? 'Entrar' : view === 'up' ? 'Crear cuenta' : view === 'code' ? 'Enviar código' : view === 'code-verify' ? 'Entrar' : 'Enviar enlace'}
            </button>
            {view === 'in' && (
              <div className="between" style={{ marginTop: 8 }}>
                <button type="button" className="linkbtn" onClick={() => go('reset')}>¿Olvidaste tu contraseña?</button>
                <button type="button" className="linkbtn" onClick={() => go('code')}><Mail className="ico-sm" style={{ verticalAlign: '-2px' }} /> Código por email</button>
              </div>
            )}
            {view === 'up' && <p className="hint" style={{ padding: '12px 0 0' }}>Tus equipos, jugadores y partidos quedan vinculados a tu cuenta y solo tú (y tu cuerpo técnico) podéis verlos.</p>}
          </form>
        )}
      </div>
    </div>
  );
}

export function NewPassword() {
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const r = await setNewPassword(pw);
    setBusy(false);
    if (!r.ok) setError(r.error);
  };
  return (
    <div className="auth">
      <Brand subtitle="Elige una contraseña nueva" />
      <form className="auth-card" onSubmit={submit}>
        <div className="fg">
          <label className="lbl" htmlFor="np">Contraseña nueva</label>
          <input id="np" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Mínimo 8 caracteres" autoFocus />
        </div>
        {error && <div className="error-box" style={{ margin: '0 0 12px' }} role="alert">{error}</div>}
        <button className="btn btn-p btn-block" disabled={busy || pw.length < 8}>{busy ? 'Guardando…' : 'Guardar contraseña'}</button>
      </form>
    </div>
  );
}
