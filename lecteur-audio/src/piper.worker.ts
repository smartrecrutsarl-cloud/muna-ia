// Synthèse Piper dans un worker pour ne pas bloquer l'interface.
import { TtsSession } from '@mintplex-labs/piper-tts-web';
// Moteurs WASM servis par l'application elle-même (et mis en cache pour le hors-ligne).
import ortWasm from 'onnxruntime-web/ort-wasm-simd-threaded.wasm?url';
import piperWasm from '@diffusionstudio/piper-wasm/build/piper_phonemize.wasm?url';
import piperData from '@diffusionstudio/piper-wasm/build/piper_phonemize.data?url';

type Msg =
  | { type: 'speak'; id: number; text: string; voiceId: string };

let session: TtsSession | null = null;
let sessionVoice = '';

async function getSession(voiceId: string): Promise<TtsSession> {
  if (session && sessionVoice === voiceId) return session;
  // La bibliothèque garde un singleton : on le réinitialise pour changer de voix.
  TtsSession._instance = null;
  sessionVoice = voiceId;
  session = await TtsSession.create({
    voiceId,
    wasmPaths: {
      // onnxruntime accepte aussi un objet { wasm } à la place d'un préfixe d'URL.
      onnxWasm: { wasm: new URL(ortWasm, self.location.href).href } as unknown as string,
      piperData: new URL(piperData, self.location.href).href,
      piperWasm: new URL(piperWasm, self.location.href).href,
    },
  });
  return session;
}

// Les requêtes sont traitées une par une.
let queue = Promise.resolve();

self.onmessage = (e: MessageEvent<Msg>) => {
  const msg = e.data;
  queue = queue.then(async () => {
    try {
      const s = await getSession(msg.voiceId);
      const blob = await s.predict(msg.text);
      self.postMessage({ id: msg.id, blob });
    } catch (err) {
      session = null;
      self.postMessage({ id: msg.id, error: err instanceof Error ? err.message : String(err) });
    }
  });
};
