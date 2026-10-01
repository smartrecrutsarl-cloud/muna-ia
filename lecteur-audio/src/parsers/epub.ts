import JSZip from 'jszip';
import type { Chapter } from '../db';
import { toSegments } from '../segment';
import { htmlToParagraphs } from './html';

function resolvePath(base: string, href: string): string {
  const parts = (base.includes('/') ? base.slice(0, base.lastIndexOf('/') + 1) : '').concat(href).split('/');
  const out: string[] = [];
  for (const p of parts) {
    if (p === '..') out.pop();
    else if (p && p !== '.') out.push(p);
  }
  return decodeURIComponent(out.join('/'));
}

function parseXml(text: string, type: DOMParserSupportedType = 'application/xml'): Document {
  const doc = new DOMParser().parseFromString(text, type);
  if (doc.querySelector('parsererror') && type !== 'text/html') {
    return new DOMParser().parseFromString(text, 'text/html');
  }
  return doc;
}

/** Récupère les titres de la table des matières (EPUB 3 nav ou EPUB 2 NCX). */
async function tocTitles(zip: JSZip, opf: Document, opfPath: string): Promise<Map<string, string>> {
  const titles = new Map<string, string>();
  const items = Array.from(opf.getElementsByTagName('item'));
  const nav = items.find((i) => (i.getAttribute('properties') ?? '').split(' ').includes('nav'));
  const ncx = items.find((i) => i.getAttribute('media-type') === 'application/x-dtbncx+xml');
  try {
    if (nav) {
      const path = resolvePath(opfPath, nav.getAttribute('href')!);
      const doc = parseXml(await zip.file(path)!.async('string'), 'application/xhtml+xml');
      for (const a of Array.from(doc.getElementsByTagName('a'))) {
        const href = a.getAttribute('href');
        const label = a.textContent?.replace(/\s+/g, ' ').trim();
        if (href && label) {
          const key = resolvePath(path, href.split('#')[0]);
          if (!titles.has(key)) titles.set(key, label);
        }
      }
    } else if (ncx) {
      const path = resolvePath(opfPath, ncx.getAttribute('href')!);
      const doc = parseXml(await zip.file(path)!.async('string'));
      for (const np of Array.from(doc.getElementsByTagName('navPoint'))) {
        const label = np.getElementsByTagName('text')[0]?.textContent?.trim();
        const src = np.getElementsByTagName('content')[0]?.getAttribute('src');
        if (label && src) {
          const key = resolvePath(path, src.split('#')[0]);
          if (!titles.has(key)) titles.set(key, label);
        }
      }
    }
  } catch {
    /* table des matières illisible : on se contentera des titres internes */
  }
  return titles;
}

export async function parseEpub(data: ArrayBuffer, onProgress?: (p: number) => void) {
  const zip = await JSZip.loadAsync(data);
  const container = parseXml(await zip.file('META-INF/container.xml')!.async('string'));
  const opfPath = container.getElementsByTagName('rootfile')[0]?.getAttribute('full-path');
  if (!opfPath || !zip.file(opfPath)) throw new Error('EPUB invalide : fichier OPF introuvable.');
  const opf = parseXml(await zip.file(opfPath)!.async('string'));

  const title = opf.getElementsByTagName('dc:title')[0]?.textContent?.trim()
    || opf.getElementsByTagNameNS('*', 'title')[0]?.textContent?.trim();

  const manifest = new Map<string, string>();
  for (const item of Array.from(opf.getElementsByTagName('item'))) {
    manifest.set(item.getAttribute('id')!, resolvePath(opfPath, item.getAttribute('href')!));
  }
  const titles = await tocTitles(zip, opf, opfPath);

  const spine = Array.from(opf.getElementsByTagName('itemref'))
    .filter((r) => r.getAttribute('linear') !== 'no')
    .map((r) => manifest.get(r.getAttribute('idref')!))
    .filter((p): p is string => !!p && !!zip.file(p));

  const chapters: Chapter[] = [];
  for (let i = 0; i < spine.length; i++) {
    const path = spine[i];
    const doc = parseXml(await zip.file(path)!.async('string'), 'application/xhtml+xml');
    const body = doc.getElementsByTagName('body')[0] ?? doc.documentElement;
    const segments = toSegments(htmlToParagraphs(body));
    onProgress?.((i + 1) / spine.length);
    if (!segments.length) continue;
    const heading = body.querySelector('h1,h2,h3')?.textContent?.replace(/\s+/g, ' ').trim();
    chapters.push({ title: titles.get(path) || heading || `Chapitre ${chapters.length + 1}`, segments });
  }
  return { title, chapters };
}
