// @ts-expect-error : build navigateur de mammoth, sans typings
import mammoth from 'mammoth/mammoth.browser.js';
import type { Chapter } from '../db';
import { toParagraphs } from '../segment';
import { htmlToParagraphs } from './html';

async function coreProps(data: ArrayBuffer): Promise<{ title?: string; author?: string }> {
  try {
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(data);
    const xml = await zip.file('docProps/core.xml')?.async('string');
    if (!xml) return {};
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    const get = (tag: string) => doc.getElementsByTagNameNS('*', tag)[0]?.textContent?.trim() || undefined;
    return { title: get('title'), author: get('creator') };
  } catch {
    return {};
  }
}

export async function parseDocx(data: ArrayBuffer) {
  const props = await coreProps(data);
  const { value: html } = await mammoth.convertToHtml({ arrayBuffer: data });
  const body = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html').body;

  // Un nouveau chapitre commence à chaque titre de niveau 1 ou 2.
  const chapters: Chapter[] = [];
  let title = '';
  let buffer: string[] = [];
  const flush = () => {
    const { segments, breaks } = toParagraphs(buffer);
    if (segments.length) chapters.push({ title: title || 'Début', segments, breaks });
    buffer = [];
  };
  for (const node of Array.from(body.children)) {
    if (/^H[12]$/.test(node.tagName)) {
      flush();
      title = node.textContent?.trim() || '';
    }
    buffer.push(...htmlToParagraphs(node));
  }
  flush();
  if (chapters.length === 1) chapters[0].title = 'Document';
  return { title: props.title, author: props.author, chapters };
}
