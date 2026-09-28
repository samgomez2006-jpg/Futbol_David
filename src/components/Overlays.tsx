import { useUI } from '../store/ui';

export function Toast() {
  const msg = useUI((s) => s.toastMsg);
  const key = useUI((s) => s.toastKey);
  if (!msg) return null;
  return (
    <div className="toast" key={key} role="status" aria-live="polite">
      {msg}
    </div>
  );
}

export function ConfirmHost() {
  const spec = useUI((s) => s.confirmSpec);
  const resolve = useUI((s) => s._resolveConfirm);
  if (!spec) return null;
  return (
    <div className="overlay center" onClick={(e) => e.target === e.currentTarget && resolve(false)} style={{ zIndex: 300 }}>
      <div className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="cf-t">
        <h3 id="cf-t">{spec.title}</h3>
        {spec.message && <p>{spec.message}</p>}
        <div className="actions">
          <button className="btn btn-g" onClick={() => resolve(false)}>Cancelar</button>
          <button className={`btn ${spec.danger ? 'btn-danger' : 'btn-p'}`} onClick={() => resolve(true)} autoFocus>
            {spec.ok ?? 'Aceptar'}
          </button>
        </div>
      </div>
    </div>
  );
}
