import { useNavigate } from 'react-router';
import { cloudEnabled } from '../lib/supabase';
import { useStore } from '../store/store';

export function SyncPill() {
  const mode = useStore((s) => s.mode);
  const sync = useStore((s) => s.sync);
  const pending = useStore((s) => s.outbox.length);
  const nav = useNavigate();
  if (!cloudEnabled) return null;
  const [dot, text] =
    mode === 'guest' ? ['', 'Solo local']
      : sync === 'syncing' ? ['warn', 'Sincronizando']
      : sync === 'offline' ? ['warn', pending ? `Sin conexión · ${pending}` : 'Sin conexión']
      : sync === 'error' ? ['bad', 'Error']
      : pending ? ['warn', `${pending} pendientes`]
      : ['ok', 'Sincronizado'];
  return (
    <button className="sync-pill" onClick={() => nav('/cuenta')} aria-label={`Estado: ${text}. Abrir cuenta`}>
      <span className={`sync-dot ${dot}`} />{text}
    </button>
  );
}
