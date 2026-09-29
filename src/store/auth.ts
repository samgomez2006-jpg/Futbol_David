import type { Session } from '@supabase/supabase-js';
import { create } from 'zustand';
import { cloudEnabled, supabase } from '../lib/supabase';
import { useStore } from './store';
import { adoptTeam, hasLocalData, myTeams, resetLocal, syncNow, type MyTeam } from './sync';

// Estado de la sesión. La app exige sesión cuando Supabase está configurado; sin Supabase funciona en local.

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn' | 'recovery';

interface AuthState {
  status: AuthStatus;
  userId: string | null;
  email: string | null;
  /** Equipos del usuario en la nube (null = todavía sin cargar). */
  teams: MyTeam[] | null;
  teamsError: string | null;
  /** Mensaje para mostrar en la pantalla de acceso (p. ej. resultado de un enlace del email). */
  notice: { kind: 'ok' | 'error'; text: string } | null;
  setNotice: (n: AuthState['notice']) => void;
  reloadTeams: () => Promise<void>;
}

export const useAuth = create<AuthState>((set, get) => ({
  status: cloudEnabled ? 'loading' : 'signedOut',
  userId: null,
  email: null,
  teams: null,
  teamsError: null,
  notice: null,
  setNotice: (notice) => set({ notice }),
  async reloadTeams() {
    const { userId } = get();
    if (!userId || !supabase) return;
    set({ teamsError: null });
    try {
      set({ teams: await myTeams(userId) });
    } catch (e) {
      set({ teamsError: e instanceof Error ? e.message : 'No se pudo cargar tu equipo' });
    }
  },
}));

/** Traduce los errores de Supabase Auth a mensajes claros. */
export function authMessage(err: { message?: string; code?: string; status?: number } | null | undefined): string {
  const m = (err?.message ?? '').toLowerCase();
  const c = err?.code ?? '';
  if (c === 'invalid_credentials' || m.includes('invalid login credentials')) return 'Email o contraseña incorrectos.';
  if (c === 'email_not_confirmed' || m.includes('email not confirmed')) return 'Tu email aún no está verificado. Abre el correo que te enviamos y pulsa el enlace.';
  if (c === 'user_already_exists' || m.includes('already registered')) return 'Ya existe una cuenta con ese email. Entra con tu contraseña o recupérala.';
  if (c === 'over_email_send_rate_limit' || err?.status === 429 || m.includes('rate limit')) return 'Se han enviado demasiados emails seguidos. Espera unos minutos y vuelve a intentarlo.';
  if (c === 'weak_password' || m.includes('password should')) return 'La contraseña debe tener al menos 8 caracteres.';
  if (m.includes('token has expired') || m.includes('otp_expired') || c === 'otp_expired') return 'El código ha caducado o no es correcto. Pide uno nuevo.';
  if (m.includes('failed to fetch') || m.includes('network')) return 'Sin conexión. Comprueba tu internet e inténtalo de nuevo.';
  if (m.includes('same password') || c === 'same_password') return 'Elige una contraseña distinta a la anterior.';
  return err?.message || 'No se pudo completar la operación.';
}

/** Lee errores que Supabase añade a la URL cuando un enlace del email falla o caduca. */
function readLinkError(): string | null {
  const params = new URLSearchParams(window.location.search + '&' + window.location.hash.replace(/^#/, ''));
  const code = params.get('error_code');
  const desc = params.get('error_description');
  if (!code && !desc) return null;
  if (code === 'otp_expired') return 'El enlace del email ha caducado o ya se usó. Si acabas de verificar tu email, simplemente entra con tu contraseña.';
  return `El enlace no ha funcionado (${(desc ?? code ?? '').replace(/\+/g, ' ')}). Si verificaste tu email, entra con tu contraseña.`;
}

async function onSession(session: Session | null, recovery = false) {
  const auth = useAuth.getState();
  if (!session) {
    useAuth.setState({ status: 'signedOut', userId: null, email: null, teams: null });
    return;
  }
  const userId = session.user.id;
  const email = session.user.email ?? null;
  const st = useStore.getState();

  // Datos de otra cuenta en este dispositivo: nunca se muestran.
  if (st.mode === 'cloud' && st.ownerId && st.ownerId !== userId) resetLocal();

  useAuth.setState({ status: recovery ? 'recovery' : 'signedIn', userId, email, teamsError: null });
  useStore.getState()._set({ userEmail: email });

  const cur = useStore.getState();
  if (cur.mode === 'cloud' && (cur.ownerId === userId || cur.ownerId === null)) {
    // Ya conectado: seguimos (también sin conexión) y sincronizamos en segundo plano.
    if (cur.ownerId === null) useStore.getState()._set({ ownerId: userId });
    void syncNow();
    void auth.reloadTeams();
    return;
  }

  await auth.reloadTeams();
  const teams = useAuth.getState().teams;
  // Cuenta con equipo y dispositivo vacío → se abre solo. Si hay datos locales o no hay equipo → pantalla de bienvenida.
  if (teams && teams.length && !hasLocalData()) await adoptTeam({ userId, email }, teams[0], 'discard');
}

let initialized = false;
export async function initAuth() {
  if (!supabase || initialized) return;
  initialized = true;
  const linkError = readLinkError();
  if (linkError) useAuth.setState({ notice: { kind: 'error', text: linkError } });

  supabase.auth.onAuthStateChange((event, session) => {
    // Se difiere para no llamar a Supabase dentro del propio callback (evita bloqueos del cliente).
    setTimeout(() => void onSession(session, event === 'PASSWORD_RECOVERY'), 0);
    if (event === 'SIGNED_IN' && window.location.hash.includes('access_token')) history.replaceState(null, '', window.location.pathname);
  });
  const { data } = await supabase.auth.getSession();
  if (!data.session) useAuth.setState({ status: 'signedOut' });
  // Con sesión, onAuthStateChange (INITIAL_SESSION) llama a onSession.
}

// --- operaciones de acceso ---------------------------------------------------------------------
type Res = { ok: true; needsConfirm?: boolean } | { ok: false; error: string };
const redirect = () => window.location.origin + '/';

export async function signInPassword(email: string, password: string): Promise<Res> {
  const { error } = await supabase!.auth.signInWithPassword({ email: email.trim(), password });
  return error ? { ok: false, error: authMessage(error) } : { ok: true };
}

export async function signUpPassword(email: string, password: string): Promise<Res> {
  if (password.length < 8) return { ok: false, error: 'La contraseña debe tener al menos 8 caracteres.' };
  const { data, error } = await supabase!.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: redirect() } });
  if (error) return { ok: false, error: authMessage(error) };
  // Supabase no revela si el email ya existe: devuelve un usuario sin identidades.
  if (data.user && (data.user.identities?.length ?? 0) === 0) return { ok: false, error: authMessage({ code: 'user_already_exists' }) };
  return { ok: true, needsConfirm: !data.session };
}

export async function resendConfirmation(email: string): Promise<Res> {
  const { error } = await supabase!.auth.resend({ type: 'signup', email: email.trim(), options: { emailRedirectTo: redirect() } });
  return error ? { ok: false, error: authMessage(error) } : { ok: true };
}

export async function sendCode(email: string): Promise<Res> {
  const { error } = await supabase!.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true, emailRedirectTo: redirect() } });
  return error ? { ok: false, error: authMessage(error) } : { ok: true };
}

export async function verifyCode(email: string, token: string): Promise<Res> {
  const { error } = await supabase!.auth.verifyOtp({ email: email.trim(), token: token.trim(), type: 'email' });
  return error ? { ok: false, error: authMessage(error) } : { ok: true };
}

export async function requestPasswordReset(email: string): Promise<Res> {
  const { error } = await supabase!.auth.resetPasswordForEmail(email.trim(), { redirectTo: redirect() });
  return error ? { ok: false, error: authMessage(error) } : { ok: true };
}

export async function setNewPassword(password: string): Promise<Res> {
  if (password.length < 8) return { ok: false, error: 'La contraseña debe tener al menos 8 caracteres.' };
  const { error } = await supabase!.auth.updateUser({ password });
  if (error) return { ok: false, error: authMessage(error) };
  useAuth.setState({ status: 'signedIn' });
  return { ok: true };
}
