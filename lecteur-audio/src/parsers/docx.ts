// @ts-expect-error : build navigateur de mammoth, sans typings
import mammoth from 'mammoth/mammoth.browser.js';
import type { Chapter } from '../db';
import { toSegments } from '../segment';
import { htmlToParagraphs } from './html';

export async function parseDocx(data: ArrayBuffer) {
  const { value: html } = await mammoth.convertToHtml({ arrayBuffer: data });
  const body = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html').body;

  // Un nouveau chapitre commence à chaque titre de niveau 1 ou 2.
  const chapters: Chapter[] = [];
  let title = '';
  let buffer: string[] = [];
  const flush = () => {
    const segments = toSegments(buffer);
    if (segments.length) chapters.push({ title: title || 'Début', segments });
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
  return { title: undefined as string | undefined, chapters };
}
