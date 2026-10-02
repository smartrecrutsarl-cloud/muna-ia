import { MODEL_CACHE } from './model-cache';
import PIPER_VOICES from './piper-voices.json';
import { CATALOG } from '../voices';

/** Une voix jouable : un modèle Piper et, s'il en contient plusieurs, un locuteur. */
export interface VoiceRef {
  key: string;
  model: string;
  speaker: number;
  label: string;
}

export interface PiperVoiceInfo {
  id: string;
  name: string;
  language: string;
  quality: string;
  speakers: number;
  sizeMb: number;
  /** Chemin sur le miroir de secours. */
  mirror: string;
}

export const ALL_VOICES = PIPER_VOICES as PiperVoiceInfo[];
const KNOWN = new Set([...ALL_VOICES.map((v) => v.id), ...CATALOG.map((c) => c.model)]);

/** Voix par défaut : une des deux voix gratuites. */
export const DEFAULT_VOICE = 'fr-jessica';

/** `key` est soit l'id d'une voix du catalogue, soit `modèle` ou `modèle#locuteur`. */
export function resolveVoice(key: string): VoiceRef {
  const c = CATALOG.find((v) => v.id === key);
  if (c) return { key, model: c.model, speaker: c.speaker ?? 0, label: c.name };
  const [model, spk] = key.split('#');
  if (KNOWN.has(model)) {
    const name = model.split('-')[1] ?? model;
    return { key, model, speaker: Number(spk ?? 0), label: name.charAt(0).toUpperCase() + name.slice(1).replace(/_/g, ' ') };
  }
  return resolveVoice(DEFAULT_VOICE);
}

/** Dépôt officiel des voix Piper. */
const VOICES_BASE = 'https://huggingface.co/rhasspy/piper-voices/resolve/main';
const MIRROR_BASE = 'https://huggingface.co/diffusionstudio/piper-voices/resolve/main';

/** `fr_FR-siwis-medium` → `…/fr/fr_FR/siwis/medium/fr_FR-siwis-medium.onnx` */
export function modelUrl(model: string) {
  const [locale, name, quality] = model.split('-');
  return `${VOICES_BASE}/${locale.split('_')[0]}/${locale}/${encodeURIComponent(name)}/${quality}/${encodeURIComponent(model)}.onnx`;
}

/** Sources de téléchargement, dans l'ordre : dépôt officiel, puis miroir. */
function modelSources(model: string): string[] {
  const sources = [modelUrl(model)];
  const mirror = ALL_VOICES.find((v) => v.id === model)?.mirror;
  if (mirror) sources.push(`${MIRROR_BASE}/${mirror}`);
  return sources;
}

async function fetchWithProgress(url: string, onProgress?: (ratio: number) => void): Promise<Blob> {
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
    if (total && onProgress) onProgress(loaded / total);
  }
  return new Blob(chunks as BlobPart[]);
}

export async function isModelDownloaded(model: string): Promise<boolean> {
  const cache = await caches.open(MODEL_CACHE);
  return !!(await cache.match(modelUrl(model))) && !!(await cache.match(modelUrl(model) + '.json'));
}

export async function downloadedModels(): Promise<Set<string>> {
  const cache = await caches.open(MODEL_CACHE);
  const urls = new Set((await cache.keys()).map((r) => r.url));
  return new Set([...KNOWN].filter((m) => urls.has(modelUrl(m)) && urls.has(modelUrl(m) + '.json')));
}

const inFlight = new Map<string, { promise: Promise<void>; listeners: Set<(r: number) => void> }>();

/** Téléchargements en cours (pour afficher la progression partout). */
export const downloadProgress = new Map<string, number>();
const progressListeners = new Set<() => void>();
export function onDownloadProgress(fn: () => void) {
  progressListeners.add(fn);
  return () => progressListeners.delete(fn);
}
const notifyProgress = () => progressListeners.forEach((fn) => fn());

function explain(err: unknown, source: string): string {
  const host = new URL(source).host;
  if (err instanceof TypeError) return `${host} injoignable (connexion coupée ou site bloqué par le réseau)`;
  if (err instanceof Error && err.name === 'QuotaExceededError') return 'espace de stockage insuffisant sur l’appareil';
  return `${host} : ${err instanceof Error ? err.message : String(err)}`;
}

/** Télécharge un modèle une seule fois, même si plusieurs écrans le demandent en même temps. */
export function downloadModel(model: string, onProgress?: (ratio: number) => void): Promise<void> {
  const running = inFlight.get(model);
  if (running) {
    if (onProgress) running.listeners.add(onProgress);
    return running.promise;
  }
  const listeners = new Set<(r: number) => void>(onProgress ? [onProgress] : []);
  downloadProgress.set(model, 0);
  notifyProgress();
  const promise = (async () => {
    const cache = await caches.open(MODEL_CACHE);
    const key = modelUrl(model);
    const errors: string[] = [];
    for (const source of modelSources(model)) {
      try {
        const json = await fetchWithProgress(source + '.json');
        const onnx = await fetchWithProgress(source, (r) => {
          downloadProgress.set(model, r);
          notifyProgress();
          listeners.forEach((l) => l(r));
        });
        // Toujours rangé sous l'adresse officielle, quelle que soit la source utilisée.
        await cache.put(key + '.json', new Response(json, { headers: { 'Content-Type': 'application/json' } }));
        await cache.put(key, new Response(onnx, { headers: { 'Content-Type': 'application/octet-stream' } }));
        return;
      } catch (err) {
        errors.push(explain(err, source));
      }
    }
    throw new Error(`Téléchargement de la voix impossible — ${[...new Set(errors)].join(' ; ')}.`);
  })().finally(() => {
    inFlight.delete(model);
    downloadProgress.delete(model);
    notifyProgress();
  });
  inFlight.set(model, { promise, listeners });
  return promise;
}

export async function deleteModel(model: string) {
  const cache = await caches.open(MODEL_CACHE);
  await cache.delete(modelUrl(model));
  await cache.delete(modelUrl(model) + '.json');
  notifyProgress();
}

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, { resolve: (b: Blob | null) => void; reject: (e: Error) => void }>();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('../piper.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<{ id: number; blob?: Blob; error?: string }>) => {
      const p = pending.get(e.data.id);
      if (!p) return;
      pending.delete(e.data.id);
      if (e.data.error) p.reject(new Error(e.data.error));
      else p.resolve(e.data.blob ?? null);
    };
  }
  return worker;
}

function send(msg: Record<string, unknown>): Promise<Blob | null> {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    getWorker().postMessage({ ...msg, id });
  });
}

export async function synthesize(text: string, voiceKey: string): Promise<Blob> {
  const v = resolveVoice(voiceKey);
  return (await send({ type: 'speak', text, modelUrl: modelUrl(v.model), speaker: v.speaker }))!;
}

/** Précharge le modèle et le phonémiseur pour que la première phrase parte tout de suite. */
export async function warmUp(voiceKey: string) {
  const v = resolveVoice(voiceKey);
  if (!(await isModelDownloaded(v.model))) return;
  await send({ type: 'warm', modelUrl: modelUrl(v.model) }).catch(() => {});
}
