import { PATH_MAP, voices as listVoices } from '@mintplex-labs/piper-tts-web';
import type { Voice as PiperVoice } from '@mintplex-labs/piper-tts-web';
import { MODEL_CACHE } from './model-cache';
import { CATALOG, type CatalogVoice } from '../voices';

/** Une voix jouable : un modèle Piper et, s'il en contient plusieurs, un locuteur. */
export interface VoiceRef {
  key: string;
  model: string;
  speaker: number;
  label: string;
}

export const DEFAULT_VOICE = CATALOG[0].id;

/** `key` est soit l'id d'une voix du catalogue, soit `modèle` ou `modèle#locuteur`. */
export function resolveVoice(key: string): VoiceRef {
  const c = CATALOG.find((v) => v.id === key);
  if (c) return { key, model: c.model, speaker: c.speaker ?? 0, label: c.name };
  const [model, spk] = key.split('#');
  if (model in PATH_MAP || CATALOG.some((c) => c.model === model)) return { key, model, speaker: Number(spk ?? 0), label: model.split('-')[1] ?? model };
  return resolveVoice(DEFAULT_VOICE);
}

/** Dépôt officiel des voix Piper. */
const VOICES_BASE = 'https://huggingface.co/rhasspy/piper-voices/resolve/main';

/** `fr_FR-siwis-medium` → `…/fr/fr_FR/siwis/medium/fr_FR-siwis-medium.onnx` */
export function modelUrl(model: string) {
  const [locale, name, quality] = model.split('-');
  return `${VOICES_BASE}/${locale.split('_')[0]}/${locale}/${encodeURIComponent(name)}/${quality}/${encodeURIComponent(model)}.onnx`;
}

export interface OtherVoice {
  id: string;
  name: string;
  language: string;
  quality: string;
  sizeMb: number;
}

let otherList: OtherVoice[] | null = null;

/** Toutes les voix Piper (plus de 100, une trentaine de langues). */
export async function allPiperVoices(): Promise<OtherVoice[]> {
  if (otherList) return otherList;
  const all: PiperVoice[] = await listVoices();
  otherList = all
    .filter((v) => v.key in PATH_MAP)
    .map((v) => {
      const onnx = Object.entries(v.files).find(([k]) => k.endsWith('.onnx'));
      return {
        id: v.key,
        name: v.name.replace(/_/g, ' '),
        language: `${v.language.name_native} (${v.language.country_english})`,
        quality: v.quality,
        sizeMb: Math.round((onnx?.[1].size_bytes ?? 0) / 1e6),
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
  return otherList;
}

export async function isModelDownloaded(model: string): Promise<boolean> {
  const cache = await caches.open(MODEL_CACHE);
  return !!(await cache.match(modelUrl(model))) && !!(await cache.match(modelUrl(model) + '.json'));
}

export async function downloadedModels(): Promise<Set<string>> {
  const cache = await caches.open(MODEL_CACHE);
  const urls = new Set((await cache.keys()).map((r) => r.url));
  return new Set([...Object.keys(PATH_MAP), ...CATALOG.map((c) => c.model)].filter((m) => urls.has(modelUrl(m)) && urls.has(modelUrl(m) + '.json')));
}

export async function downloadModel(model: string, onProgress: (ratio: number) => void) {
  const cache = await caches.open(MODEL_CACHE);
  const url = modelUrl(model);
  const json = await fetch(url + '.json');
  if (!json.ok) throw new Error(`HTTP ${json.status}`);
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
  const total = Number(res.headers.get('Content-Length') ?? 0);
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    if (total) onProgress(loaded / total);
  }
  await cache.put(url + '.json', json);
  await cache.put(url, new Response(new Blob(chunks as BlobPart[]), { headers: { 'Content-Type': 'application/octet-stream' } }));
}

export async function deleteModel(model: string) {
  const cache = await caches.open(MODEL_CACHE);
  await cache.delete(modelUrl(model));
  await cache.delete(modelUrl(model) + '.json');
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
      else p.reject(new Error(e.data.error ?? 'Erreur de synthèse vocale'));
    };
  }
  return worker;
}

export function synthesize(text: string, voiceKey: string): Promise<Blob> {
  const v = resolveVoice(voiceKey);
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    getWorker().postMessage({ id, text, modelUrl: modelUrl(v.model), speaker: v.speaker });
  });
}

export type { CatalogVoice };
