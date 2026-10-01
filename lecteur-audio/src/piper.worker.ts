// Synthèse vocale Piper exécutée entièrement sur l'appareil, dans un worker.
import * as ort from 'onnxruntime-web/wasm';
import ortWasm from 'onnxruntime-web/ort-wasm-simd-threaded.wasm?url';
import piperWasmUrl from '@diffusionstudio/piper-wasm/build/piper_phonemize.wasm?url';
import piperDataUrl from '@diffusionstudio/piper-wasm/build/piper_phonemize.data?url';
import { createPiperPhonemize } from './vendor/piper-phonemize.js';
import { MODEL_CACHE } from './engines/model-cache';

export interface SpeakRequest {
  id: number;
  text: string;
  modelUrl: string;
  speaker: number;
}

interface ModelConfig {
  audio: { sample_rate: number };
  espeak: { voice: string };
  inference: { noise_scale: number; length_scale: number; noise_w: number };
  num_speakers: number;
  phoneme_id_map: Record<string, number[]>;
}

const abs = (u: string) => new URL(u, self.location.href).href;
ort.env.wasm.wasmPaths = { wasm: abs(ortWasm) };
ort.env.wasm.numThreads = self.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 1) : 1;

/** Pause ajoutée après chaque passage, pour un rythme de livre audio. */
const PAUSE_SECONDS = 0.35;

type Phonemizer = { callMain(args: string[]): number };
let phonemizer: Promise<Phonemizer> | null = null;
let lastLine = '';
let lastError = '';

/** Le phonémiseur (espeak-ng) est chargé une seule fois puis réutilisé. */
function getPhonemizer(): Promise<Phonemizer> {
  phonemizer ??= (async () => {
    const [wasmBinary, data] = await Promise.all([
      fetch(abs(piperWasmUrl)).then((r) => r.arrayBuffer()),
      fetch(abs(piperDataUrl)).then((r) => r.arrayBuffer()),
    ]);
    return createPiperPhonemize({
      wasmBinary,
      getPreloadedPackage: () => data,
      print: (line: string) => {
        lastLine = line;
      },
      printErr: (line: string) => {
        lastError = line;
      },
      locateFile: (u: string) => (u.endsWith('.wasm') ? abs(piperWasmUrl) : u.endsWith('.data') ? abs(piperDataUrl) : u),
    });
  })();
  phonemizer.catch(() => (phonemizer = null));
  return phonemizer;
}

/** Texte → identifiants de phonèmes, avec la table propre au modèle. */
async function phonemeIds(text: string, config: ModelConfig): Promise<number[]> {
  const module = await getPhonemizer();
  lastLine = '';
  module.callMain(['-l', config.espeak.voice, '--input', JSON.stringify([{ text }]), '--espeak_data', '/espeak-ng-data']);
  let phonemes: string[];
  try {
    phonemes = JSON.parse(lastLine).phonemes;
  } catch {
    phonemizer = null;
    throw new Error(lastError || 'Phonémisation impossible.');
  }
  const map = config.phoneme_id_map;
  const ids = [...map['^'], ...map['_']];
  for (const p of phonemes) if (map[p]) ids.push(...map[p], ...map['_']);
  ids.push(...map['$']);
  return ids;
}

async function readModelFile(url: string): Promise<Response> {
  const cache = await caches.open(MODEL_CACHE);
  const hit = await cache.match(url);
  if (hit) return hit;
  // Pas encore téléchargé : on le récupère (et on le garde) si le réseau est disponible.
  const res = await fetch(url);
  if (!res.ok) throw new Error('Voix non téléchargée. Téléchargez-la dans les réglages (connexion requise une fois).');
  await cache.put(url, res.clone());
  return res;
}

let loaded: { url: string; session: ort.InferenceSession; config: ModelConfig } | null = null;

async function loadModel(url: string) {
  if (loaded?.url === url) return loaded;
  const config = (await (await readModelFile(url + '.json')).json()) as ModelConfig;
  const model = await (await readModelFile(url)).arrayBuffer();
  await loaded?.session.release();
  loaded = null;
  const session = await ort.InferenceSession.create(model, { executionProviders: ['wasm'] });
  loaded = { url, session, config };
  return loaded;
}

function toWav(pcm: Float32Array, sampleRate: number): Blob {
  const pause = Math.round(sampleRate * PAUSE_SECONDS);
  const n = pcm.length + pause;
  const view = new DataView(new ArrayBuffer(44 + n * 2));
  const str = (o: number, s: string) => [...s].forEach((c, i) => view.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF');
  view.setUint32(4, 36 + n * 2, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  str(36, 'data');
  view.setUint32(40, n * 2, true);
  for (let i = 0; i < pcm.length; i++) {
    const v = Math.max(-1, Math.min(1, pcm[i]));
    view.setInt16(44 + i * 2, v < 0 ? v * 0x8000 : v * 0x7fff, true);
  }
  return new Blob([view.buffer], { type: 'audio/wav' });
}

async function speak({ text, modelUrl, speaker }: SpeakRequest): Promise<Blob> {
  const { session, config } = await loadModel(modelUrl);
  const ids = await phonemeIds(text, config);
  const { noise_scale, length_scale, noise_w } = config.inference;
  const feeds: Record<string, ort.Tensor> = {
    input: new ort.Tensor('int64', BigInt64Array.from(ids, BigInt), [1, ids.length]),
    input_lengths: new ort.Tensor('int64', BigInt64Array.from([BigInt(ids.length)]), [1]),
    scales: new ort.Tensor('float32', Float32Array.from([noise_scale, length_scale, noise_w]), [3]),
  };
  if (config.num_speakers > 1) feeds.sid = new ort.Tensor('int64', BigInt64Array.from([BigInt(speaker)]), [1]);
  const { output } = await session.run(feeds);
  return toWav(output.data as Float32Array, config.audio.sample_rate);
}

// Les requêtes sont traitées une par une.
let queue = Promise.resolve();
self.onmessage = (e: MessageEvent<SpeakRequest>) => {
  const req = e.data;
  queue = queue.then(async () => {
    try {
      self.postMessage({ id: req.id, blob: await speak(req) });
    } catch (err) {
      self.postMessage({ id: req.id, error: err instanceof Error ? err.message : String(err) });
    }
  });
};
