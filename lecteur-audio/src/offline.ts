import { audioCache, type LibraryDoc } from './db';
import { cacheKey, cachePrefix, synthesizeAt, type Pos } from './player';
import { settings, voiceSignature } from './settings';

function* positions(doc: LibraryDoc, chapters?: number[]): Generator<Pos> {
  for (const chapter of chapters ?? doc.chapters.map((_, i) => i)) {
    for (let segment = 0; segment < doc.chapters[chapter].segments.length; segment++) yield { chapter, segment };
  }
}

export function charCount(doc: LibraryDoc, chapters?: number[]): number {
  let n = 0;
  for (const p of positions(doc, chapters)) n += doc.chapters[p.chapter].segments[p.segment].length;
  return n;
}

export async function preparedRatio(doc: LibraryDoc): Promise<number> {
  return (await audioCache.countPrefix(cachePrefix(doc.id, voiceSignature()))) / doc.totalSegments;
}

/** Génère et enregistre l'audio de tout le document (ou de certains chapitres) pour l'écoute hors ligne. */
export async function prepareOffline(
  doc: LibraryDoc,
  onProgress: (done: number, total: number) => void,
  signal: AbortSignal,
  chapters?: number[],
) {
  const all = [...positions(doc, chapters)];
  let done = 0;
  for (const p of all) {
    if (signal.aborted) return;
    await synthesizeAt(doc, p, { store: true });
    onProgress(++done, all.length);
  }
}

/** Assemble l'audio préparé en un seul fichier (MP3 pour ElevenLabs, WAV pour Piper). */
export async function exportAudio(doc: LibraryDoc, chapters?: number[]): Promise<Blob> {
  const sig = voiceSignature();
  const blobs: Blob[] = [];
  for (const p of positions(doc, chapters)) {
    const b = await audioCache.get(cacheKey(doc.id, sig, p));
    if (!b) throw new Error("Tout le contenu n'est pas encore préparé : lancez d'abord « Préparer hors ligne ».");
    blobs.push(b);
  }
  if (settings.engine === 'elevenlabs') return new Blob(blobs, { type: 'audio/mpeg' });
  return mergeWav(blobs);
}

async function mergeWav(blobs: Blob[]): Promise<Blob> {
  const first = await blobs[0].arrayBuffer();
  const header = new DataView(first.slice(0, 44));
  const parts = await Promise.all(blobs.map((b) => b.slice(44).arrayBuffer()));
  const dataLength = parts.reduce((n, p) => n + p.byteLength, 0);
  header.setUint32(4, 36 + dataLength, true);
  header.setUint32(40, dataLength, true);
  return new Blob([header.buffer, ...parts], { type: 'audio/wav' });
}
