import { DEFAULT_PIPER_VOICE } from './engines/piper';

export type EngineId = 'piper' | 'elevenlabs' | 'system';

export interface Settings {
  engine: EngineId;
  rate: number;
  piperVoice: string;
  systemVoice: string;
  elevenKey: string;
  elevenVoice: string;
  elevenModel: string;
}

const KEY = 'lecteur-audio:settings';

const defaults: Settings = {
  engine: 'piper',
  rate: 1,
  piperVoice: DEFAULT_PIPER_VOICE,
  systemVoice: '',
  elevenKey: '',
  elevenVoice: '',
  elevenModel: 'eleven_multilingual_v2',
};

function load(): Settings {
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return { ...defaults };
  }
}

export const settings: Settings = load();

export function saveSettings(patch: Partial<Settings>) {
  Object.assign(settings, patch);
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    /* stockage indisponible */
  }
}

/** Signature du moteur/voix utilisée pour les clés du cache audio. */
export function voiceSignature(s: Settings = settings): string {
  if (s.engine === 'elevenlabs') return `el:${s.elevenModel}:${s.elevenVoice}`;
  if (s.engine === 'piper') return `piper:${s.piperVoice}`;
  return `sys:${s.systemVoice}`;
}
