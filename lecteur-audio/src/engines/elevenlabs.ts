const API = 'https://api.elevenlabs.io/v1';

export interface ElevenVoice {
  id: string;
  name: string;
  description: string;
}

export const ELEVEN_MODELS = [
  { id: 'eleven_multilingual_v2', label: 'Multilingual v2 — meilleure qualité' },
  { id: 'eleven_flash_v2_5', label: 'Flash v2.5 — rapide, moitié prix' },
  { id: 'eleven_v3', label: 'v3 — la plus expressive' },
];

async function check(res: Response) {
  if (res.ok) return res;
  let detail = '';
  try {
    const body = await res.json();
    detail = body?.detail?.message ?? body?.detail?.status ?? JSON.stringify(body?.detail ?? body);
  } catch {
    /* corps non JSON */
  }
  if (res.status === 401) throw new Error('Clé API ElevenLabs refusée. Vérifiez-la dans les réglages.');
  throw new Error(`ElevenLabs (${res.status}) : ${detail || res.statusText}`);
}

export async function elevenVoices(apiKey: string): Promise<ElevenVoice[]> {
  const res = await check(await fetch(`${API}/voices`, { headers: { 'xi-api-key': apiKey } }));
  const data = (await res.json()) as {
    voices: { voice_id: string; name: string; category?: string; labels?: Record<string, string> }[];
  };
  return data.voices.map((v) => ({
    id: v.voice_id,
    name: v.name,
    description: [v.labels?.gender, v.labels?.accent, v.labels?.age, v.category].filter(Boolean).join(' · '),
  }));
}

export async function elevenSynthesize(
  text: string,
  opts: { apiKey: string; voiceId: string; modelId: string; previousText?: string; nextText?: string },
): Promise<Blob> {
  const body: Record<string, unknown> = { text, model_id: opts.modelId };
  // Le contexte améliore l'intonation entre les segments (non supporté par v3).
  if (opts.modelId !== 'eleven_v3') {
    if (opts.previousText) body.previous_text = opts.previousText;
    if (opts.nextText) body.next_text = opts.nextText;
  }
  const res = await check(
    await fetch(`${API}/text-to-speech/${encodeURIComponent(opts.voiceId)}?output_format=mp3_44100_128`, {
      method: 'POST',
      headers: { 'xi-api-key': opts.apiKey, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      body: JSON.stringify(body),
    }),
  );
  return new Blob([await res.arrayBuffer()], { type: 'audio/mpeg' });
}
