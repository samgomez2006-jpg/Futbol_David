// Generación de PDF (jsPDF + autotable, cargados solo al exportar).

export interface PdfSection {
  title: string;
  head: string[];
  rows: (string | number)[][];
  note?: string;
}

const NAVY: [number, number, number] = [20, 40, 75];

/** jsPDF usa fuentes Latin-1: se quitan emojis y símbolos fuera de rango para no generar basura. */
const clean = (s: string | number) => String(s).replace(/[^\u0020-\u00FF\u20AC\n]/g, '').replace(/\u00A0/g, ' ');

async function libs() {
  const [{ jsPDF }, auto] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  return { jsPDF, autoTable: auto.default };
}

function band(doc: import('jspdf').jsPDF, title: string, subtitle: string) {
  const w = doc.internal.pageSize.getWidth();
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, w, 24, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(clean(title), 14, 12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text(clean(subtitle), 14, 19);
  doc.setTextColor(30, 30, 30);
}

function footer(doc: import('jspdf').jsPDF, team: string) {
  const n = doc.getNumberOfPages();
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120, 130, 150);
    doc.text(clean(`${team} · Mi Equipo FC`), 14, h - 7);
    doc.text(`${i} / ${n}`, w - 14, h - 7, { align: 'right' });
  }
}

export async function buildReportPdf(opts: { title: string; subtitle: string; team: string; sections: PdfSection[]; landscape?: boolean }): Promise<Blob> {
  const { jsPDF, autoTable } = await libs();
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: opts.landscape ? 'landscape' : 'portrait' });
  band(doc, opts.title, opts.subtitle);
  let y = 32;
  for (const s of opts.sections) {
    if (y > doc.internal.pageSize.getHeight() - 40) {
      doc.addPage();
      y = 16;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11.5);
    doc.setTextColor(...NAVY);
    doc.text(clean(s.title), 14, y);
    y += 2;
    if (s.rows.length) {
      autoTable(doc, {
        startY: y + 1, head: [s.head.map(clean)], body: s.rows.map((r) => r.map(clean)), theme: 'striped',
        styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 1.8, textColor: [30, 30, 30] },
        headStyles: { fillColor: NAVY, textColor: 255, fontStyle: 'bold' }, alternateRowStyles: { fillColor: [243, 245, 249] },
        margin: { left: 14, right: 14 },
      });
      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;
    } else {
      y += 4;
    }
    if (s.note) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8.5);
      doc.setTextColor(90, 100, 120);
      const lines = doc.splitTextToSize(clean(s.note), doc.internal.pageSize.getWidth() - 28);
      doc.text(lines, 14, y);
      y += lines.length * 4 + 3;
    }
    y += 4;
  }
  footer(doc, opts.team);
  return doc.output('blob');
}

/** PDF de una jugada de la pizarra: título, descripción y el dibujo. */
export async function buildPlayPdf(opts: { title: string; kind: string; description: string; team: string; png: Blob; aspect: number }): Promise<Blob> {
  const { jsPDF } = await libs();
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  band(doc, opts.title, `${opts.kind} · ${opts.team}`);
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  let y = 32;
  if (opts.description.trim()) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(clean(opts.description), pw - 28);
    doc.text(lines, 14, y);
    y += lines.length * 5 + 4;
  }
  const dataUrl = await new Promise<string>((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.readAsDataURL(opts.png);
  });
  const maxW = pw - 28;
  const maxH = ph - y - 16;
  let w = maxW;
  let h = w / opts.aspect;
  if (h > maxH) {
    h = maxH;
    w = h * opts.aspect;
  }
  doc.addImage(dataUrl, 'PNG', (pw - w) / 2, y, w, h);
  footer(doc, opts.team);
  return doc.output('blob');
}
