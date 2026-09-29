import { Circle, Download, Eraser, FileText, Image as ImageIcon, MousePointer2, MoreHorizontal, Move, Pause, Play, Redo2, Route, Save, Shield, Target, Trash2, Triangle, Type, Undo2, User, UserCog, Waves, Zap } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { useNavigate, useParams } from 'react-router';
import { BoardSvg } from '../components/BoardSvg';
import { Field, Sheet } from '../components/Sheet';
import { TopBar } from '../components/bits';
import { clampToPitch, newItem, PITCH_LABEL, pathLength, pointAlong, simplify, snapItem, type Pt } from '../lib/board';
import { slug, svgToPng } from '../lib/boardExport';
import { uid } from '../lib/id';
import { saveBlob, saveTextFile } from '../lib/platform';
import { emptyBoard, type BoardData, type BoardItemType, type BoardLine, type BoardLineKind, type BoardPitch, type PlayKind } from '../lib/types';
import { useStore } from '../store/store';
import { confirmDialog, toast } from '../store/ui';

type Tool = 'select' | BoardLineKind;
type Sel = { kind: 'item' | 'line'; id: string } | null;
const KINDS: [PlayKind, string][] = [['jugada', 'Jugada'], ['ejercicio', 'Ejercicio'], ['situacion', 'Situación de partido']];
const KIND_LABEL = Object.fromEntries(KINDS) as Record<PlayKind, string>;

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

export default function Board() {
  const { id } = useParams();
  const nav = useNavigate();
  const plays = useStore((s) => s.data.plays);
  const team = useStore((s) => s.team);
  const upsert = useStore((s) => s.upsert);
  const saved = id ? plays.find((p) => p.id === id) : undefined;

  const [data, setData] = useState<BoardData>(() => (saved ? clone(saved.data) : emptyBoard()));
  const [past, setPast] = useState<BoardData[]>([]);
  const [future, setFuture] = useState<BoardData[]>([]);
  const [tool, setTool] = useState<Tool>('select');
  const [sel, setSel] = useState<Sel>(null);
  const [draft, setDraft] = useState<BoardLine | null>(null);
  const [overrides, setOverrides] = useState<Record<string, Pt> | undefined>();
  const [playing, setPlaying] = useState(false);
  const [meta, setMeta] = useState({ title: saved?.title ?? '', kind: (saved?.kind ?? 'jugada') as PlayKind, description: saved?.description ?? '' });
  const [sheet, setSheet] = useState<'save' | 'options' | null>(null);
  const [baseline, setBaseline] = useState(() => JSON.stringify(saved?.data ?? emptyBoard()));

  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ id: string; dx: number; dy: number; moved: boolean } | null>(null);
  const draftRef = useRef<BoardLine | null>(null);
  const raf = useRef(0);
  const dirty = useMemo(() => JSON.stringify(data) !== baseline, [data, baseline]);

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  // Si se abre una jugada que no existe (borrada), vuelve a una pizarra nueva.
  useEffect(() => {
    if (id && !saved) nav('/pizarra', { replace: true });
  }, [id, saved, nav]);

  const commit = (next: BoardData) => {
    setPast((p) => [...p.slice(-40), data]);
    setFuture([]);
    setData(next);
  };
  const undo = () => {
    const prev = past[past.length - 1];
    if (!prev) return;
    setFuture((f) => [data, ...f]);
    setPast(past.slice(0, -1));
    setData(prev);
    setSel(null);
  };
  const redo = () => {
    const nxt = future[0];
    if (!nxt) return;
    setPast((p) => [...p, data]);
    setFuture(future.slice(1));
    setData(nxt);
    setSel(null);
  };

  const point = (e: RPointerEvent): Pt => {
    const svg = svgRef.current!;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    return [p.x, p.y];
  };

  const add = (type: BoardItemType) => {
    if (playing) return;
    const it = newItem(type, data);
    commit({ ...data, items: [...data.items, it] });
    setSel({ kind: 'item', id: it.id });
    setTool('select');
  };

  const onItemDown = (e: RPointerEvent, it: BoardData['items'][number]) => {
    if (playing || tool !== 'select') return;
    e.stopPropagation();
    const [x, y] = point(e);
    drag.current = { id: it.id, dx: x - it.x, dy: y - it.y, moved: false };
    setSel({ kind: 'item', id: it.id });
    svgRef.current?.setPointerCapture(e.pointerId);
  };
  const onLineDown = (e: RPointerEvent, l: BoardLine) => {
    if (playing || tool !== 'select') return;
    e.stopPropagation();
    setSel({ kind: 'line', id: l.id });
  };
  const onBackgroundDown = (e: RPointerEvent) => {
    if (playing) return;
    if (tool === 'select') {
      setSel(null);
      return;
    }
    const p = point(e);
    const from = snapItem(data.items, p);
    const start: Pt = from ? [from.x, from.y] : clampToPitch(data.pitch, p[0], p[1]);
    const d: BoardLine = { id: uid(), kind: tool, points: [start], from: from?.id };
    draftRef.current = d;
    setDraft(d);
    svgRef.current?.setPointerCapture(e.pointerId);
  };
  const onMove = (e: RPointerEvent) => {
    const d = drag.current;
    if (d) {
      const [x, y] = point(e);
      const [nx, ny] = clampToPitch(data.pitch, x - d.dx, y - d.dy);
      if (!d.moved) {
        d.moved = true;
        setPast((p) => [...p.slice(-40), data]);
        setFuture([]);
      }
      setData((cur) => ({ ...cur, items: cur.items.map((i) => (i.id === d.id ? { ...i, x: nx, y: ny } : i)) }));
      return;
    }
    const dr = draftRef.current;
    if (dr) {
      const p = clampToPitch(data.pitch, ...point(e));
      const last = dr.points[dr.points.length - 1];
      if (Math.hypot(p[0] - last[0], p[1] - last[1]) > 8) {
        const next = { ...dr, points: [...dr.points, p] };
        draftRef.current = next;
        setDraft(next);
      }
    }
  };
  const onUp = () => {
    drag.current = null;
    const dr = draftRef.current;
    if (!dr) return;
    draftRef.current = null;
    setDraft(null);
    const pts = simplify(dr.points);
    if (pathLength(pts) < 30) return;
    const line: BoardLine = { ...dr, points: pts };
    commit({ ...data, lines: [...data.lines, line] });
    setSel({ kind: 'line', id: line.id });
  };

  const selItem = sel?.kind === 'item' ? data.items.find((i) => i.id === sel.id) : undefined;
  const remove = () => {
    if (!sel) return;
    if (sel.kind === 'item') commit({ ...data, items: data.items.filter((i) => i.id !== sel.id), lines: data.lines.filter((l) => l.from !== sel.id) });
    else commit({ ...data, lines: data.lines.filter((l) => l.id !== sel.id) });
    setSel(null);
  };
  const setLabel = (label: string) => setData((cur) => ({ ...cur, items: cur.items.map((i) => (i.id === sel?.id ? { ...i, label } : i)) }));
  const resize = (delta: number) => selItem && commit({ ...data, items: data.items.map((i) => (i.id === selItem.id ? { ...i, size: Math.min(260, Math.max(50, (i.size ?? 110) + delta)) } : i)) });
  const setPitch = (pitch: BoardPitch) => {
    const items = data.items.map((i) => ({ ...i, ...(() => { const [x, y] = clampToPitch(pitch, i.x, i.y); return { x, y }; })() }));
    commit({ ...data, pitch, items });
  };

  // --- reproducir: los elementos que salen de una línea se desplazan por ella --------------------
  const animated = data.lines.filter((l) => l.from && data.items.some((i) => i.id === l.from));
  const play = () => {
    if (playing) {
      cancelAnimationFrame(raf.current);
      setPlaying(false);
      setOverrides(undefined);
      return;
    }
    if (!animated.length) return toast('Dibuja una línea que salga de un jugador o del balón para animarla');
    setSel(null);
    setPlaying(true);
    const DURATION = 3000;
    const t0 = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - t0) / DURATION, 1);
      const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      const o: Record<string, Pt> = {};
      for (const l of animated) o[l.from!] = pointAlong(l.points, ease);
      setOverrides(o);
      if (t < 1) raf.current = requestAnimationFrame(tick);
      else
        setTimeout(() => {
          setPlaying(false);
          setOverrides(undefined);
        }, 600);
    };
    raf.current = requestAnimationFrame(tick);
  };

  // --- guardar / exportar --------------------------------------------------------------------------
  const save = (m = meta) => {
    if (!m.title.trim()) return false;
    const playId = saved?.id ?? uid();
    upsert('plays', { id: playId, team_id: team.id, title: m.title.trim(), kind: m.kind, description: m.description.trim(), data });
    setBaseline(JSON.stringify(data));
    toast(saved ? 'Jugada actualizada ✓' : 'Jugada guardada ✓');
    if (!saved) nav(`/pizarra/${playId}`, { replace: true });
    return true;
  };
  const exportPng = async () => {
    const png = await svgToPng(svgRef.current!, 2);
    await saveBlob(`${slug(meta.title || 'pizarra')}.png`, png);
    toast('Imagen exportada ✓');
  };
  const exportPdf = async () => {
    const png = await svgToPng(svgRef.current!, 2);
    const vb = svgRef.current!.viewBox.baseVal;
    const { buildPlayPdf } = await import('../lib/pdf');
    const pdf = await buildPlayPdf({ title: meta.title || 'Pizarra táctica', kind: KIND_LABEL[meta.kind], description: meta.description, team: team.name, png, aspect: vb.width / vb.height });
    await saveBlob(`${slug(meta.title || 'pizarra')}.pdf`, pdf);
    toast('PDF exportado ✓');
  };
  const exportJson = async () => {
    await saveTextFile(`${slug(meta.title || 'pizarra')}.json`, JSON.stringify({ app: 'mi-equipo-fc', kind: 'play', title: meta.title, type: meta.kind, description: meta.description, data }, null, 2));
    toast('Jugada exportada ✓');
  };
  const back = async () => {
    if (dirty && data.items.length + data.lines.length > 0 && !(await confirmDialog({ title: 'Salir sin guardar', message: 'Hay cambios sin guardar en la pizarra.', ok: 'Salir', danger: true }))) return;
    nav(-1);
  };
  const wrap = (fn: () => Promise<void>) => () => {
    setSheet(null);
    void fn().catch((e) => toast(e instanceof Error ? e.message : 'No se pudo exportar'));
  };

  const T = ({ id: tid, icon: Icon, label }: { id: Tool; icon: typeof Move; label: string }) => (
    <button className={`tool-btn ${tool === tid ? 'on' : ''}`} onClick={() => setTool(tid)} aria-pressed={tool === tid} disabled={playing}><Icon className="ico" />{label}</button>
  );
  const A = ({ type, icon: Icon, label }: { type: BoardItemType; icon: typeof Move; label: string }) => (
    <button className="tool-btn" onClick={() => add(type)} disabled={playing} aria-label={`Añadir ${label}`}><Icon className="ico" />{label}</button>
  );

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', paddingBottom: 0 }}>
      <TopBar
        title={meta.title || 'Pizarra táctica'}
        subtitle={saved ? `${KIND_LABEL[meta.kind]}${dirty ? ' · cambios sin guardar' : ''}` : 'Nueva jugada'}
        right={
          <div className="row-flex">
            <button className="icon-btn" onClick={() => setSheet('options')} aria-label="Opciones y exportar"><MoreHorizontal className="ico" /></button>
            <button className="btn btn-p btn-sm" onClick={() => (meta.title.trim() ? save() : setSheet('save'))}><Save className="ico-sm" /> Guardar</button>
          </div>
        }
      />
      <div style={{ padding: '0 var(--pad)' }}>
        <button className="back-btn" onClick={() => void back()}>← Volver</button>
      </div>
      <div className="board-stage">
        <BoardSvg
          className="board-svg" svgRef={svgRef} data={data} selected={sel} overrides={overrides} draft={draft}
          onItemDown={onItemDown} onLineDown={onLineDown} onBackgroundDown={onBackgroundDown} onMove={onMove} onUp={onUp}
        />
      </div>
      <div className="board-bar">
        {(selItem && ['player', 'rival', 'gk', 'text'].includes(selItem.type)) || selItem?.type === 'area' || sel ? (
          <div className="row-flex" style={{ minHeight: 40 }}>
            {selItem && ['player', 'rival', 'gk', 'text'].includes(selItem.type) && (
              <input value={selItem.label ?? ''} maxLength={selItem.type === 'text' ? 30 : 3} onFocus={() => setPast((p) => [...p.slice(-40), data])} onChange={(e) => setLabel(e.target.value)} aria-label={selItem.type === 'text' ? 'Texto' : 'Dorsal'} style={{ maxWidth: 120, minHeight: 38 }} placeholder={selItem.type === 'text' ? 'Texto' : 'Nº'} />
            )}
            {selItem?.type === 'area' && (
              <>
                <button className="btn btn-g btn-sm" onClick={() => resize(-20)}>Menor</button>
                <button className="btn btn-g btn-sm" onClick={() => resize(20)}>Mayor</button>
              </>
            )}
            <span className="grow small muted">{sel?.kind === 'line' ? 'Línea seleccionada' : 'Arrastra para mover'}</span>
            <button className="btn btn-danger btn-sm" onClick={remove}><Trash2 className="ico-sm" /> Borrar</button>
          </div>
        ) : (
          <div className="small muted" style={{ minHeight: 40, display: 'flex', alignItems: 'center' }}>
            {tool === 'select' ? 'Añade elementos, arrástralos y dibuja trayectorias. Una línea que sale de un jugador o del balón se anima con ▶.' : 'Dibuja sobre el campo con el dedo. Empieza junto a un jugador o el balón para animarlo.'}
          </div>
        )}
        <div className="board-tools" role="toolbar" aria-label="Herramientas de la pizarra">
          <T id="select" icon={MousePointer2} label="Mover" />
          <T id="move" icon={Route} label="Movimiento" />
          <T id="pass" icon={Zap} label="Pase" />
          <T id="dribble" icon={Waves} label="Conducción" />
          <span style={{ width: 1, background: 'var(--border)', flexShrink: 0 }} />
          <A type="player" icon={User} label="Jugador" />
          <A type="rival" icon={UserCog} label="Rival" />
          <A type="gk" icon={Shield} label="Portero" />
          <A type="ball" icon={Circle} label="Balón" />
          <A type="cone" icon={Triangle} label="Cono" />
          <A type="goal" icon={Target} label="Portería" />
          <A type="area" icon={Eraser} label="Zona" />
          <A type="text" icon={Type} label="Texto" />
          <span style={{ width: 1, background: 'var(--border)', flexShrink: 0 }} />
          <button className="tool-btn" onClick={undo} disabled={!past.length || playing} aria-label="Deshacer"><Undo2 className="ico" />Deshacer</button>
          <button className="tool-btn" onClick={redo} disabled={!future.length || playing} aria-label="Rehacer"><Redo2 className="ico" />Rehacer</button>
          <button className={`tool-btn ${playing ? 'on' : ''}`} onClick={play} aria-label={playing ? 'Detener' : 'Reproducir'}>{playing ? <Pause className="ico" /> : <Play className="ico" />}{playing ? 'Parar' : 'Animar'}</button>
        </div>
      </div>

      {sheet === 'save' && (
        <Sheet title="Guardar jugada" onClose={() => setSheet(null)}
          actions={<><button className="btn btn-g" style={{ flex: 1 }} onClick={() => setSheet(null)}>Cancelar</button><button className="btn btn-p" style={{ flex: 2 }} disabled={!meta.title.trim()} onClick={() => save() && setSheet(null)}>Guardar</button></>}>
          <Field label="Título"><input value={meta.title} onChange={(e) => setMeta({ ...meta, title: e.target.value })} placeholder="Ej: Salida de balón con 3" maxLength={120} autoFocus /></Field>
          <div className="fg">
            <span className="lbl">Tipo</span>
            <div className="chips">{KINDS.map(([k, l]) => <button key={k} className={`chip ${meta.kind === k ? 'sel' : ''}`} onClick={() => setMeta({ ...meta, kind: k })}>{l}</button>)}</div>
          </div>
          <Field label="Descripción"><textarea value={meta.description} onChange={(e) => setMeta({ ...meta, description: e.target.value })} placeholder="Objetivo, normas, series, indicaciones…" maxLength={4000} /></Field>
        </Sheet>
      )}

      {sheet === 'options' && (
        <Sheet title="Pizarra" onClose={() => setSheet(null)}>
          <div className="fg">
            <span className="lbl">Campo</span>
            <div className="seg">{(['full', 'half', 'blank'] as BoardPitch[]).map((p) => <button key={p} className={data.pitch === p ? 'on' : ''} onClick={() => setPitch(p)}>{PITCH_LABEL[p]}</button>)}</div>
          </div>
          <div className="fg">
            <span className="lbl">Datos de la jugada</span>
            <button className="btn btn-g btn-block" onClick={() => setSheet('save')}>Título, tipo y descripción</button>
          </div>
          <div className="fg">
            <span className="lbl">Exportar</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button className="btn btn-g" onClick={wrap(exportPng)}><ImageIcon className="ico-sm" /> Imagen PNG</button>
              <button className="btn btn-g" onClick={wrap(exportPdf)}><FileText className="ico-sm" /> PDF</button>
              <button className="btn btn-g" onClick={wrap(exportJson)}><Download className="ico-sm" /> Archivo de la jugada (.json)</button>
            </div>
          </div>
          <div className="fg">
            <button className="btn btn-danger btn-block" onClick={async () => {
              if (await confirmDialog({ title: 'Limpiar pizarra', message: 'Se quitarán todos los elementos (puedes deshacerlo).', ok: 'Limpiar', danger: true })) {
                commit({ ...data, items: [], lines: [] });
                setSheet(null);
              }
            }}><Trash2 className="ico-sm" /> Limpiar pizarra</button>
          </div>
        </Sheet>
      )}
    </div>
  );
}
