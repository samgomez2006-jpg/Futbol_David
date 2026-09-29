import { BarChart3, ClipboardCheck, Layers, PenTool, Trophy, Users } from 'lucide-react';
import { IconBadge, TopBar } from '../components/bits';
import { FORMATS, useExporter } from '../components/ExportButton';
import { SCOPE_LABEL, type Scope } from '../lib/export';

const SCOPES: { scope: Scope; icon: typeof Users; sub: string }[] = [
  { scope: 'todo', icon: Layers, sub: 'Plantilla, partidos, goles, minutos, convocatorias, asistencia y analíticas' },
  { scope: 'plantilla', icon: Users, sub: 'Datos de los jugadores, minutos y estadísticas' },
  { scope: 'partidos', icon: Trophy, sub: 'Resultados, goles con zona y tipo, minutos jugados' },
  { scope: 'asistencia', icon: ClipboardCheck, sub: 'Entrenamientos y convocatorias' },
  { scope: 'analiticas', icon: BarChart3, sub: 'Indicadores, hallazgos y zonas de gol' },
  { scope: 'jugadas', icon: PenTool, sub: 'Lista de jugadas y ejercicios (las imágenes se exportan desde Mis jugadas)' },
];

export default function Export() {
  const { run, busy } = useExporter();
  return (
    <div className="page">
      <TopBar back="Equipo" backTo="/equipo" title="Exportar datos" subtitle="Excel, CSV y PDF" />
      <div className="page-inner" style={{ paddingTop: 12 }}>
        {SCOPES.map(({ scope, icon, sub }) => (
          <div className="card" key={scope}>
            <div className="row-flex" style={{ marginBottom: 12 }}>
              <IconBadge icon={icon} />
              <div><div className="bold">{SCOPE_LABEL[scope]}</div><div className="xs muted">{sub}</div></div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {FORMATS.map(({ f, label, icon: Icon }) => (
                <button key={f} className="btn btn-g btn-sm" style={{ flex: 1 }} disabled={!!busy} onClick={() => void run(scope, f)}>
                  <Icon className="ico-sm" /> {busy === `${scope}-${f}` ? '…' : label.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>
        ))}
        <div className="spacer" />
      </div>
    </div>
  );
}
