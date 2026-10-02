import { DEFAULT_VOICE } from './engines/piper';

export type EngineId = 'piper' | 'system';
export type Theme = 'auto' | 'light' | 'sepia' | 'dark';

export interface Settings {
  engine: EngineId;
  rate: number;
  /** Voix du catalogue (id) ou voix Piper libre (`modèle` / `modèle#locuteur`). */
  piperVoice: string;
  systemVoice: string;
  theme: Theme;
  /** Taille du texte de lecture (1 = normale). */
  fontScale: number;
  /** Faire défiler le texte pour suivre la lecture. */
  follow: boolean;
  onboarded: boolean;
}

const KEY = 'lecteur-audio:settings';

const defaults: Settings = {
  engine: 'piper',
  rate: 1,
  piperVoice: DEFAULT_VOICE,
  systemVoice: '',
  theme: 'auto',
  fontScale: 1,
  follow: true,
  onboarded: false,
};

function load(): Settings {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    const s = { ...defaults, ...saved };
    if (s.engine !== 'piper' && s.engine !== 'system') s.engine = 'piper';
    return s;
  } catch {
    return { ...defaults };
  }
}

export const settings: Settings = load();

const listeners = new Set<() => void>();
export function onSettings(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function saveSettings(patch: Partial<Settings>) {
  Object.assign(settings, patch);
  listeners.forEach((fn) => fn());
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    /* stockage indisponible */
  }
}

/** Signature du moteur/voix utilisée pour les clés du cache audio. */
export function voiceSignature(s: Settings = settings): string {
  return s.engine === 'piper' ? `piper:${s.piperVoice}` : `sys:${s.systemVoice}`;
}
