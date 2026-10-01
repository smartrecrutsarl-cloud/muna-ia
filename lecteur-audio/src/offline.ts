import type { LibraryDoc } from './db';
import { synthesizeAt } from './player';

/**
 * Génère l'audio d'un chapitre sur l'appareil et l'assemble en un seul fichier WAV
 * (pratique pour l'écouter dans un autre lecteur ou le copier sur une clé USB).
 */
export async function exportChapter(
  doc: LibraryDoc,
  chapter: number,
  onProgress: (done: number, total: number) => void,
  signal: AbortSignal,
): Promise<Blob | null> {
  const total = doc.chapters[chapter].segments.length;
  const parts: Blob[] = [];
  for (let segment = 0; segment < total; segment++) {
    if (signal.aborted) return null;
    parts.push(await synthesizeAt(doc, { chapter, segment }));
    onProgress(segment + 1, total);
  }
  return mergeWav(parts);
}

async function mergeWav(blobs: Blob[]): Promise<Blob> {
  const header = new DataView((await blobs[0].arrayBuffer()).slice(0, 44));
  const parts = await Promise.all(blobs.map((b) => b.slice(44).arrayBuffer()));
  const dataLength = parts.reduce((n, p) => n + p.byteLength, 0);
  header.setUint32(4, 36 + dataLength, true);
  header.setUint32(40, dataLength, true);
  return new Blob([header.buffer, ...parts], { type: 'audio/wav' });
}
