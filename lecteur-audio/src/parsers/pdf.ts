import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import type { PDFDocumentProxy } from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { Chapter } from '../db';
import { toParagraphs } from '../segment';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

const PAGES_PER_CHAPTER = 10;

async function pageParagraphs(pdf: PDFDocumentProxy, pageNumber: number): Promise<string[]> {
  const page = await pdf.getPage(pageNumber);
  const content = await page.getTextContent();
  const lines: string[] = [];
  let line = '';
  for (const item of content.items) {
    if (!('str' in item)) continue;
    line += item.str;
    if (item.hasEOL) {
      lines.push(line);
      line = '';
    }
  }
  if (line) lines.push(line);

  const paragraphs: string[] = [];
  let current = '';
  for (const raw of lines) {
    const l = raw.replace(/\s+/g, ' ').trim();
    if (!l) {
      if (current) paragraphs.push(current);
      current = '';
      continue;
    }
    if (/^\d{1,4}$/.test(l)) continue; // numéros de page
    if (current.endsWith('-') && /^[a-zà-ÿ]/.test(l)) {
      current = current.slice(0, -1) + l; // césure en fin de ligne
    } else {
      current = current ? current + ' ' + l : l;
    }
    // Fin de paragraphe probable : ligne qui se termine par une ponctuation forte.
    if (/[.!?…:»"”]$/.test(l) && l.length < 60) {
      paragraphs.push(current);
      current = '';
    }
  }
  if (current) paragraphs.push(current);
  page.cleanup();
  return paragraphs;
}

/** Utilise la table des matières du PDF si elle existe : renvoie [titre, page de début]. */
async function outlineStarts(pdf: PDFDocumentProxy): Promise<{ title: string; page: number }[]> {
  try {
    const outline = await pdf.getOutline();
    if (!outline?.length) return [];
    const starts: { title: string; page: number }[] = [];
    for (const item of outline) {
      let dest = item.dest;
      if (typeof dest === 'string') dest = await pdf.getDestination(dest);
      if (!Array.isArray(dest) || !dest[0]) continue;
      const ref = dest[0];
      const index = typeof ref === 'number' ? ref : await pdf.getPageIndex(ref);
      starts.push({ title: item.title.trim() || 'Section', page: index + 1 });
    }
    starts.sort((a, b) => a.page - b.page);
    return starts;
  } catch {
    return [];
  }
}

export async function parsePdf(data: ArrayBuffer, onProgress?: (p: number) => void) {
  const task = pdfjs.getDocument({ data });
  const pdf = await task.promise;
  const meta = await pdf.getMetadata().catch(() => null);
  const info = meta?.info as { Title?: string; Author?: string } | undefined;
  let coverCanvas: HTMLCanvasElement | undefined;
  try {
    const first = await pdf.getPage(1);
    const vp = first.getViewport({ scale: 1 });
    const viewport = first.getViewport({ scale: 480 / vp.width });
    coverCanvas = document.createElement('canvas');
    coverCanvas.width = Math.round(viewport.width);
    coverCanvas.height = Math.round(viewport.height);
    await first.render({ canvasContext: coverCanvas.getContext('2d')!, viewport }).promise;
  } catch {
    coverCanvas = undefined;
  }

  const pages: string[][] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    pages.push(await pageParagraphs(pdf, i));
    onProgress?.(i / pdf.numPages);
  }

  let ranges = await outlineStarts(pdf);
  if (ranges.length === 0 || ranges[0].page > 1) {
    ranges.unshift({ title: ranges.length ? 'Début' : '', page: 1 });
  }
  if (ranges.length === 1 && pdf.numPages > PAGES_PER_CHAPTER) {
    ranges = [];
    for (let p = 1; p <= pdf.numPages; p += PAGES_PER_CHAPTER) {
      const end = Math.min(p + PAGES_PER_CHAPTER - 1, pdf.numPages);
      ranges.push({ title: `Pages ${p}–${end}`, page: p });
    }
  }

  if (ranges.length === 1) ranges[0].title = 'Document';
  const chapters: Chapter[] = ranges.map((r, i) => {
    const end = i + 1 < ranges.length ? ranges[i + 1].page - 1 : pdf.numPages;
    return { title: r.title || `Pages ${r.page}–${end}`, ...toParagraphs(pages.slice(r.page - 1, end).flat()) };
  });
  await task.destroy();
  return {
    title: info?.Title?.trim() || undefined,
    author: info?.Author?.trim() || undefined,
    chapters: chapters.filter((c) => c.segments.length),
    coverCanvas,
  };
}
