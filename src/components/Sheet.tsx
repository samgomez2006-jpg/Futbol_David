import { useEffect, useId, useRef, type ReactNode } from 'react';

interface Props {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  actions?: ReactNode;
}

/** Hoja inferior accesible: Esc y toque fuera cierran, el foco entra en la hoja. */
export function Sheet({ title, onClose, children, actions }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, [onClose]);
  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} ref={ref}>
        <div className="handle" />
        <div className="sh-title" id={titleId}>
          <span>{title}</span>
          <button className="icon-btn" onClick={onClose} aria-label="Cerrar">×</button>
        </div>
        {children}
        {actions && <div className="f-actions">{actions}</div>}
      </div>
    </div>
  );
}

export function Field({ label, children, className = 'fg' }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={className} style={{ display: 'block' }}>
      <span className="lbl">{label}</span>
      {children}
    </label>
  );
}
