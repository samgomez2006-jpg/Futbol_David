import { Copy, FileText, Image as ImageIcon, PenTool, Plus, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router';
import { BoardSvg } from '../components/BoardSvg';
import { Empty, TopBar } from '../components/bits';
import { slug, svgToPng } from '../lib/boardExport';
import { compareDateDesc } from '../lib/dates';
import { uid } from '../lib/id';
import { saveBlob } from '../lib/platform';
import type { Play, PlayKind } from '../lib/types';
import { useStore } from '../store/store';
import { confirmDialog, toast } from '../store/ui';

const KIND_LABEL: Record<PlayKind, string> = { jugada: 'Jugada', ejercicio: 'Ejercicio', situacion: 'Situación de partido' };

export default function Plays() {
  const plays = useStore((s) => s.data.plays);
  const team = useStore((s) => s.team);
  const upsert = useStore((s) => s.upsert);
  const remove = useStore((s) => s.remove);
  const nav = useNavigate();
  const list = [...plays].sort((a, b) => compareDateDesc({ date: a.updated_at ?? '' }, { date: b.updated_at ?? '' }));

  const svgOf = (id: string) => document.getElementById(`play-${id}`) as unknown as SVGSVGElement;
  const png = async (p: Play) => {
    try {
      await saveBlob(`${slug(p.title)}.png`, await svgToPng(svgOf(p.id), 2));
      toast('Imagen exportada ✓');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo exportar');
    }
  };
  const pdf = async (p: Play) => {
    try {
      const el = svgOf(p.id);
      const vb = el.viewBox.baseVal;
      const { buildPlayPdf } = await import('../lib/pdf');
      const file = await buildPlayPdf({ title: p.title, kind: KIND_LABEL[p.kind], description: p.description, team: team.name, png: await svgToPng(el, 2), aspect: vb.width / vb.height });
      await saveBlob(`${slug(p.title)}.pdf`, file);
      toast('PDF exportado ✓');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo exportar');
    }
  };
  const duplicate = (p: Play) => {
    upsert('plays', { ...p, id: uid(), title: `${p.title} (copia)`, data: JSON.parse(JSON.stringify(p.data)) });
    toast('Jugada duplicada ✓');
  };
  const del = async (p: Play) => {
    if (await confirmDialog({ title: '¿Eliminar jugada?', message: `«${p.title}» se eliminará definitivamente.`, ok: 'Eliminar', danger: true })) {
      remove('plays', p.id);
      toast('Jugada eliminada');
    }
  };

  return (
    <div className="page">
      <TopBar back="Inicio" backTo="/" title="Mis jugadas" subtitle={`${plays.length} guardadas`} right={<button className="btn btn-p btn-sm" onClick={() => nav('/pizarra')}><Plus className="ico-sm" /> Nueva</button>} />
      <div className="page-inner" style={{ paddingTop: 14 }}>
        {!list.length ? (
          <Empty icon={PenTool} action={<button className="btn btn-p" onClick={() => nav('/pizarra')}>Abrir la pizarra</button>}>Aún no has guardado ninguna jugada.<br />Diseña ejercicios y jugadas en la pizarra táctica.</Empty>
        ) : (
          <div className="play-grid">
            {list.map((p) => (
              <div className="play-card" key={p.id}>
                <button className="play-thumb" style={{ border: 'none', width: '100%' }} onClick={() => nav(`/pizarra/${p.id}`)} aria-label={`Abrir ${p.title}`}>
                  <BoardSvg data={p.data} id={`play-${p.id}`} label={p.title} />
                </button>
                <div style={{ padding: 10 }}>
                  <div className="bold small" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</div>
                  <div className="xs muted" style={{ marginBottom: 8 }}>{KIND_LABEL[p.kind]}</div>
                  <div className="row-flex" style={{ gap: 2 }}>
                    <button className="icon-btn" onClick={() => void png(p)} aria-label="Exportar PNG"><ImageIcon className="ico" /></button>
                    <button className="icon-btn" onClick={() => void pdf(p)} aria-label="Exportar PDF"><FileText className="ico" /></button>
                    <button className="icon-btn" onClick={() => duplicate(p)} aria-label="Duplicar"><Copy className="ico" /></button>
                    <button className="icon-btn danger" onClick={() => void del(p)} aria-label="Eliminar"><Trash2 className="ico" /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="spacer" />
      </div>
    </div>
  );
}
