// Découpe le texte en segments lisibles (phrases regroupées, ~350 caractères max).

const MAX = 260;

export function normalize(text: string): string {
  return text
    .replace(/­/g, '') // traits d'union conditionnels
    .replace(/[ \t ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .trim();
}

/** Retire les points de conduite (« ....... ») et soulignements des tables des matières. */
export function cleanText(text: string): string {
  return text
    .replace(/(?:[.·•…_\-–—]\s?){4,}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Découpe un paragraphe en segments sans couper les phrases quand c'est possible. */
export function splitParagraph(paragraph: string): string[] {
  const text = cleanText(paragraph);
  if (!text) return [];
  if (text.length <= MAX) return [text];

  const sentences = text.match(/[^.!?…;:]+[.!?…;:]+["»”’)\]]*\s*|[^.!?…;:]+$/g) ?? [text];
  const out: string[] = [];
  let current = '';
  for (const raw of sentences) {
    const sentence = raw.trim();
    if (!sentence) continue;
    if (sentence.length > MAX) {
      if (current) out.push(current);
      current = '';
      // Phrase trop longue : on coupe sur les virgules puis les mots.
      let piece = '';
      for (const word of sentence.split(' ')) {
        if (piece && (piece + ' ' + word).length > MAX) {
          out.push(piece);
          piece = word;
        } else {
          piece = piece ? piece + ' ' + word : word;
        }
      }
      current = piece;
    } else if (current && (current + ' ' + sentence).length > MAX) {
      out.push(current);
      current = sentence;
    } else {
      current = current ? current + ' ' + sentence : sentence;
    }
  }
  if (current) out.push(current);
  return out;
}

export function toSegments(paragraphs: string[]): string[] {
  return paragraphs.flatMap(splitParagraph);
}

/** Segments + indices des segments qui commencent un nouveau paragraphe. */
export function toParagraphs(paragraphs: string[]): { segments: string[]; breaks: number[] } {
  const segments: string[] = [];
  const breaks: number[] = [];
  for (const p of paragraphs) {
    const parts = splitParagraph(p);
    if (!parts.length) continue;
    breaks.push(segments.length);
    segments.push(...parts);
  }
  return { segments, breaks };
}
