import { LogOut, RefreshCw, Share2 } from 'lucide-react';
import { TopBar } from '../components/bits';
import { fmtDate } from '../lib/dates';
import { shareText } from '../lib/platform';
import { cloudEnabled } from '../lib/supabase';
import { useAuth } from '../store/auth';
import { useStore } from '../store/store';
import { signOut, syncNow } from '../store/sync';
import { confirmDialog, toast } from '../store/ui';

export default function Account() {
  const email = useAuth((s) => s.email);
  const team = useStore((s) => s.team);
  const mode = useStore((s) => s.mode);
  const sync = useStore((s) => s.sync);
  const syncError = useStore((s) => s.syncError);
  const pending = useStore((s) => s.outbox.length);
  const lastSyncAt = useStore((s) => s.lastSyncAt);

  return (
    <div className="page">
      <TopBar back="Equipo" backTo="/equipo" title="Cuenta y sincronización" />
      <div className="page-inner">
        {!cloudEnabled || mode !== 'cloud' ? (
          <>
            <div className="sec-label">Nube</div>
            <div className="card small muted">Esta instalación no tiene Supabase configurado: los datos se guardan solo en este dispositivo. Usa Exportar para hacer copias.</div>
          </>
        ) : (
          <>
            <div className="sec-label">Sincronización</div>
            <div className="card flush">
              <div className="srow"><span className="srl">Cuenta</span><span className="srv" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{email}</span></div>
              <div className="srow"><span className="srl">Estado</span><span className="srv">{{ idle: 'Al día', syncing: 'Sincronizando…', offline: 'Sin conexión', error: 'Error' }[sync]}</span></div>
              <div className="srow"><span className="srl">Cambios pendientes</span><span className="srv num">{pending}</span></div>
              <div className="srow"><span className="srl">Última sincronización</span><span className="srv">{lastSyncAt ? `${fmtDate(lastSyncAt.slice(0, 10))} ${new Date(lastSyncAt).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}` : '—'}</span></div>
            </div>
            {syncError && (
              <div className="error-box" role="alert">
                {syncError}{' '}
                <button className="btn btn-xs btn-g" onClick={() => useStore.getState()._set({ syncError: null, sync: 'idle' })}>Ocultar</button>
              </div>
            )}
            <div style={{ padding: '0 var(--pad)' }}>
              <button className="btn btn-g btn-block" onClick={async () => { await syncNow(); toast('Sincronizado'); }}><RefreshCw className="ico-sm" /> Sincronizar ahora</button>
            </div>

            <div className="sec-label">Cuerpo técnico</div>
            <div className="card">
              <p className="small muted" style={{ marginBottom: 10 }}>Comparte este código con otros entrenadores para que gestionen el mismo equipo desde sus móviles.</p>
              <div className="code">{team.invite_code ?? '········'}</div>
              {team.invite_code && (
                <button className="btn btn-g btn-sm btn-block" style={{ marginTop: 10 }} onClick={async () => {
                  const r = await shareText('Únete a mi equipo', `Únete a ${team.name} en Mi Equipo FC con el código: ${team.invite_code}`);
                  if (r === 'copied') toast('Código copiado ✓');
                }}><Share2 className="ico-sm" /> Compartir código</button>
              )}
            </div>
            <div style={{ padding: '0 var(--pad)' }}>
              <button className="btn btn-danger btn-block" onClick={async () => {
                const ok = await confirmDialog({
                  title: 'Cerrar sesión',
                  message: pending ? `Hay ${pending} cambios sin subir. Se intentará sincronizar antes; si no hay conexión se perderán.` : 'Los datos siguen guardados en la nube. Al volver a entrar los recuperarás.',
                  ok: 'Cerrar sesión', danger: !!pending,
                });
                if (ok) { await signOut(); toast('Sesión cerrada'); }
              }}><LogOut className="ico-sm" /> Cerrar sesión</button>
            </div>
          </>
        )}
        <p className="hint" style={{ textAlign: 'center', marginTop: 24 }}>Mi Equipo FC · v{__APP_VERSION__}</p>
        <div className="spacer" />
      </div>
    </div>
  );
}
