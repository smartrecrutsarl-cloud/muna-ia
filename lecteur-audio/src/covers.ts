// Couvertures : image extraite du livre si possible, sinon couverture générée.

const W = 360;
const H = 540;

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Palettes sobres et élégantes pour les couvertures générées. */
const PALETTES: [string, string, string][] = [
  ['#1F3A5F', '#4A7BA7', '#F3E9D2'],
  ['#5B2A3A', '#B4505F', '#F7E7DA'],
  ['#1E4D3A', '#4F8F6B', '#EEF2E6'],
  ['#3D2C5E', '#7A5BA6', '#F1EAF7'],
  ['#6B3A1E', '#C2703D', '#FBEFE3'],
  ['#203540', '#3F7C85', '#E6F0EF'],
  ['#4A3B2A', '#A68A5B', '#F6EEDD'],
  ['#2B2D42', '#8D99AE', '#EDF2F4'],
];

export function paletteFor(title: string) {
  return PALETTES[hash(title) % PALETTES.length];
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const t = line ? `${line} ${w}` : w;
    if (ctx.measureText(t).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else line = t;
  }
  if (line) lines.push(line);
  return lines;
}

export async function generatedCover(title: string, author: string | undefined, format: string): Promise<{ cover: string; color: string }> {
  const [dark, mid, light] = paletteFor(title);
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, mid);
  g.addColorStop(1, dark);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // Motif : arcs concentriques discrets.
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 2;
  const cx = W * (0.2 + (hash(title + 'x') % 60) / 100);
  for (let r = 40; r < 700; r += 34) {
    ctx.beginPath();
    ctx.arc(cx, H * 0.95, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = light;
  ctx.fillRect(28, 36, 36, 3);
  try {
    await document.fonts.load('600 40px "Fraunces Variable"');
  } catch {
    /* police indisponible : repli */
  }
  ctx.fillStyle = light;
  ctx.textBaseline = 'top';
  let size = 42;
  let lines: string[];
  do {
    ctx.font = `600 ${size}px "Fraunces Variable", Georgia, serif`;
    lines = wrap(ctx, title, W - 56);
    size -= 2;
  } while (lines.length * size * 1.15 > H * 0.55 && size > 20);
  lines.slice(0, 7).forEach((l, i) => ctx.fillText(l, 28, 58 + i * size * 1.18));
  ctx.font = '500 15px "Inter Variable", system-ui, sans-serif';
  ctx.globalAlpha = 0.85;
  if (author) ctx.fillText(author.slice(0, 40), 28, H - 64);
  ctx.globalAlpha = 0.6;
  ctx.fillText(format.toUpperCase(), 28, H - 40);
  return { cover: c.toDataURL('image/jpeg', 0.86), color: dark };
}

/** Réduit une image (Blob) en couverture JPEG et calcule sa couleur dominante. */
export async function coverFromImage(blob: Blob): Promise<{ cover: string; color: string } | null> {
  try {
    const bmp = await createImageBitmap(blob);
    return fromSource(bmp, bmp.width, bmp.height);
  } catch {
    return null;
  }
}

export function fromSource(src: CanvasImageSource, w: number, h: number): { cover: string; color: string } {
  const scale = Math.min(1, W / w);
  const c = document.createElement('canvas');
  c.width = Math.round(w * scale);
  c.height = Math.round(h * scale);
  const ctx = c.getContext('2d')!;
  ctx.drawImage(src, 0, 0, c.width, c.height);
  return { cover: c.toDataURL('image/jpeg', 0.85), color: dominantColor(ctx, c.width, c.height) };
}

/** Couleur la plus « marquante » de l'image (teinte dominante parmi les pixels colorés), assombrie pour servir de fond. */
function dominantColor(ctx: CanvasRenderingContext2D, w: number, h: number): string {
  const data = ctx.getImageData(0, 0, w, h).data;
  const buckets = new Map<number, { n: number; h: number; s: number }>();
  for (let i = 0; i < data.length; i += 4 * 8) {
    const r = data[i] / 255, g = data[i + 1] / 255, b = data[i + 2] / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (max + min) / 2;
    const d = max - min;
    if (d < 0.08 || l < 0.08 || l > 0.95) continue;
    const sat = d / (1 - Math.abs(2 * l - 1));
    let hue = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    hue = (hue * 60 + 360) % 360;
    const key = Math.round(hue / 20) % 18;
    const e = buckets.get(key) ?? { n: 0, h: 0, s: 0 };
    e.n += sat;
    e.h += hue * sat;
    e.s += sat * sat;
    buckets.set(key, e);
  }
  let best: { n: number; h: number; s: number } | null = null;
  for (const e of buckets.values()) if (!best || e.n > best.n) best = e;
  if (!best || best.n < 1) return '#2B2D42';
  const hue = Math.round(best.h / best.n);
  const sat = Math.round(Math.min(0.55, best.s / best.n) * 100);
  return `hsl(${hue} ${sat}% 26%)`;
}
