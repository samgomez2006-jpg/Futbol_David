import { Download, FileSpreadsheet, FileText, Table2 } from 'lucide-react';
import { useState } from 'react';
import { runExport, type Format } from '../lib/doExport';
import type { Scope } from '../lib/export';
import type { Match } from '../lib/types';
import { useStore } from '../store/store';
import { toast } from '../store/ui';
import { Sheet } from './Sheet';

export function useExporter() {
  const data = useStore((s) => s.data);
  const team = useStore((s) => s.team);
  const [busy, setBusy] = useState<string | null>(null);
  const run = async (scope: Scope, format: Format, match?: Match) => {
    setBusy(`${scope}-${format}`);
    try {
      await runExport(scope, format, data, team, match);
      toast('Archivo exportado ✓');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo exportar');
    } finally {
      setBusy(null);
    }
  };
  return { run, busy };
}

export const FORMATS: { f: Format; label: string; sub: string; icon: typeof Download }[] = [
  { f: 'xlsx', label: 'Excel (.xlsx)', sub: 'Una hoja por tabla, listo para filtrar', icon: FileSpreadsheet },
  { f: 'csv', label: 'CSV', sub: 'Compatible con cualquier hoja de cálculo', icon: Table2 },
  { f: 'pdf', label: 'PDF', sub: 'Informe para imprimir o enviar', icon: FileText },
];

/** Botón que abre un selector de formato para exportar los datos de la sección donde está. */
export function ExportButton({ scope, match, label = 'Exportar', title }: { scope: Scope; match?: Match; label?: string; title?: string }) {
  const [open, setOpen] = useState(false);
  const { run, busy } = useExporter();
  const formats = match ? FORMATS.filter((x) => x.f === 'pdf') : FORMATS;
  return (
    <>
      <button className="btn btn-g btn-sm" aria-label={title ?? 'Exportar'} onClick={() => setOpen(true)}><Download className="ico-sm" /> {label}</button>
      {open && (
        <Sheet title={title ?? 'Exportar datos'} onClose={() => setOpen(false)}>
          <div style={{ padding: '0 var(--pad)' }}>
            {formats.map(({ f, label: l, sub, icon: Icon }) => (
              <button key={f} className="option-card" disabled={!!busy} onClick={async () => { await run(scope, f, match); setOpen(false); }}>
                <Icon className="ico-lg" />
                <span><span className="ot">{l}</span><br /><span className="os">{busy === `${scope}-${f}` ? 'Generando…' : sub}</span></span>
              </button>
            ))}
          </div>
        </Sheet>
      )}
    </>
  );
}
