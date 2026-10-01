import { download, stored, remove, voices as listVoices, HF_BASE, PATH_MAP } from '@mintplex-labs/piper-tts-web';
import type { Voice as PiperVoice } from '@mintplex-labs/piper-tts-web';

export interface PiperVoiceInfo {
  id: string;
  name: string;
  langCode: string;
  language: string;
  quality: string;
  sizeMb: number;
}

/** Voix françaises mises en avant (enregistrées à partir de vraies voix humaines). */
export const RECOMMENDED = ['fr_FR-siwis-medium', 'fr_FR-tom-medium', 'fr_FR-upmc-medium', 'fr_FR-gilles-low'];
export const DEFAULT_PIPER_VOICE = 'fr_FR-siwis-medium';

let cachedList: PiperVoiceInfo[] | null = null;

export async function piperVoices(): Promise<PiperVoiceInfo[]> {
  if (cachedList) return cachedList;
  const all: PiperVoice[] = await listVoices();
  cachedList = all
    .filter((v) => v.key in PATH_MAP)
    .map((v) => {
      const onnx = Object.entries(v.files).find(([k]) => k.endsWith('.onnx'));
      return {
        id: v.key,
        name: v.name.replace(/_/g, ' '),
        langCode: v.language.code,
        language: `${v.language.name_native} (${v.language.country_english})`,
        quality: v.quality,
        sizeMb: Math.round((onnx?.[1].size_bytes ?? 0) / 1e6),
      };
    })
    .sort((a, b) => {
      const fa = a.langCode.startsWith('fr') ? 0 : 1;
      const fb = b.langCode.startsWith('fr') ? 0 : 1;
      return fa - fb || a.langCode.localeCompare(b.langCode) || a.name.localeCompare(b.name);
    });
  return cachedList;
}

function modelUrl(id: string) {
  return `${HF_BASE}/${PATH_MAP[id]}`;
}

export async function downloadedVoices(): Promise<Set<string>> {
  const result = new Set<string>();
  try {
    for (const id of await stored()) result.add(id);
  } catch {
    /* OPFS indisponible */
  }
  // Le service worker garde aussi une copie (utile sur Safari).
  if ('caches' in self) {
    for (const id of RECOMMENDED.concat(Object.keys(PATH_MAP))) {
      if (!result.has(id) && (await caches.match(modelUrl(id)))) result.add(id);
    }
  }
  return result;
}

export async function downloadVoice(id: string, onProgress: (ratio: number) => void) {
  await download(id, (p) => p.total && onProgress(p.loaded / p.total));
}

export async function deleteVoice(id: string) {
  await remove(id);
  if ('caches' in self) {
    const cache = await caches.open('piper-voices');
    await cache.delete(modelUrl(id));
    await cache.delete(modelUrl(id) + '.json');
  }
}

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, { resolve: (b: Blob) => void; reject: (e: Error) => void }>();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('../piper.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<{ id: number; blob?: Blob; error?: string }>) => {
      const p = pending.get(e.data.id);
      if (!p) return;
      pending.delete(e.data.id);
      if (e.data.blob) p.resolve(e.data.blob);
      else p.reject(new Error(e.data.error ?? 'Erreur de synthèse Piper'));
    };
  }
  return worker;
}

export function piperSynthesize(text: string, voiceId: string): Promise<Blob> {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    getWorker().postMessage({ type: 'speak', id, text, voiceId });
  });
}
