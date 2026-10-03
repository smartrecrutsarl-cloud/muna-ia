import type { LibraryDoc } from '../db';
import { normalize, toParagraphs } from '../segment';
import { coverFromImage, fromSource, generatedCover } from '../covers';

export const ACCEPT = '.pdf,.docx,.epub,.txt';

export async function parseFile(file: File, onProgress?: (p: number) => void): Promise<LibraryDoc> {
  const ext = file.name.toLowerCase().split('.').pop() ?? '';
  const data = await file.arrayBuffer();
  let result: { title?: string; author?: string; chapters: LibraryDoc['chapters']; coverBlob?: Blob; coverCanvas?: HTMLCanvasElement };
  let format: LibraryDoc['format'];

  switch (ext) {
    case 'pdf':
      format = 'pdf';
      result = await (await import('./pdf')).parsePdf(data, onProgress);
      break;
    case 'docx':
      format = 'docx';
      result = await (await import('./docx')).parseDocx(data);
      break;
    case 'epub':
      format = 'epub';
      result = await (await import('./epub')).parseEpub(data, onProgress);
      break;
    case 'txt':
      format = 'txt';
      result = { chapters: [{ title: 'Texte', ...toParagraphs(normalize(new TextDecoder().decode(data)).split(/\n+/)) }] };
      break;
    case 'doc':
      throw new Error('Les anciens fichiers .doc ne sont pas pris en charge : enregistrez-le en .docx depuis Word.');
    default:
      throw new Error(`Format non pris en charge : .${ext}`);
  }

  const chapters = result.chapters.filter((c) => c.segments.length);
  if (!chapters.length) {
    throw new Error("Aucun texte trouvé. S'il s'agit d'un PDF scanné (images), il faut d'abord le passer à l'OCR.");
  }
  const title = result.title || file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ');
  const art =
    (result.coverBlob && (await coverFromImage(result.coverBlob))) ||
    (result.coverCanvas && fromSource(result.coverCanvas, result.coverCanvas.width, result.coverCanvas.height)) ||
    (await generatedCover(title, result.author, format));
  return {
    id: crypto.randomUUID(),
    title,
    author: result.author,
    cover: art.cover,
    color: art.color,
    bookmarks: [],
    format,
    addedAt: Date.now(),
    chapters,
    position: { chapter: 0, segment: 0 },
    totalSegments: chapters.reduce((n, c) => n + c.segments.length, 0),
  };
}
