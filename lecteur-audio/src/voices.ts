// Catalogue des voix de narration proposées par défaut.
// Toutes fonctionnent hors ligne une fois téléchargées (modèles Piper, licences libres).
// Sélection : intelligibilité vérifiée par transcription automatique, rythme et
// timbre mesurés, et rapidité de synthèse suffisante pour une lecture en continu.

export interface CatalogVoice {
  id: string;
  name: string;
  lang: 'fr' | 'en';
  gender: 'f' | 'm';
  accent: string;
  description: string;
  /** Modèle Piper (dépôt rhasspy/piper-voices). */
  model: string;
  /** Locuteur, pour les modèles qui en contiennent plusieurs. */
  speaker?: number;
  sizeMb: number;
}

export const CATALOG: CatalogVoice[] = [
  // ——— Français ———
  {
    id: 'fr-siwis',
    name: 'Siwis',
    lang: 'fr',
    gender: 'f',
    accent: 'Français standard',
    description: 'Voix féminine claire et posée, idéale pour les romans et les essais.',
    model: 'fr_FR-siwis-medium',
    sizeMb: 63,
  },
  {
    id: 'fr-jessica',
    name: 'Jessica',
    lang: 'fr',
    gender: 'f',
    accent: 'Français standard',
    description: 'Voix féminine douce et lumineuse, très nette.',
    model: 'fr_FR-upmc-medium',
    speaker: 0,
    sizeMb: 77,
  },
  {
    id: 'fr-pierre',
    name: 'Pierre',
    lang: 'fr',
    gender: 'm',
    accent: 'Français standard',
    description: 'Voix masculine calme, au débit régulier — parfaite pour les longues lectures.',
    model: 'fr_FR-upmc-medium',
    speaker: 1,
    sizeMb: 77,
  },
  {
    id: 'fr-tom',
    name: 'Tom',
    lang: 'fr',
    gender: 'm',
    accent: 'Français standard',
    description: 'Voix masculine chaleureuse, enregistrée en haute fidélité (44 kHz).',
    model: 'fr_FR-tom-medium',
    sizeMb: 63,
  },
  {
    id: 'fr-miro',
    name: 'Miro',
    lang: 'fr',
    gender: 'm',
    accent: 'Français standard',
    description: 'Voix masculine grave et feutrée, ton de conteur.',
    model: 'fr_FR-miro-high',
    sizeMb: 63,
  },
  // ——— English ———
  {
    id: 'en-cori',
    name: 'Cori',
    lang: 'en',
    gender: 'f',
    accent: 'British English',
    description: 'Voix féminine britannique issue de livres audio LibriVox : narration naturelle.',
    model: 'en_GB-cori-medium',
    sizeMb: 63,
  },
  {
    id: 'en-jenny',
    name: 'Jenny',
    lang: 'en',
    gender: 'f',
    accent: 'British English',
    description: 'Voix féminine britannique chaleureuse et expressive.',
    model: 'en_GB-jenny_dioco-medium',
    sizeMb: 63,
  },
  {
    id: 'en-lessac',
    name: 'Lessac',
    lang: 'en',
    gender: 'f',
    accent: 'American English',
    description: 'Voix féminine américaine, entraînée sur des livres audio — vivante et articulée.',
    model: 'en_US-lessac-medium',
    sizeMb: 63,
  },
  {
    id: 'en-ryan',
    name: 'Ryan',
    lang: 'en',
    gender: 'm',
    accent: 'American English',
    description: 'Voix masculine américaine, naturelle et dynamique.',
    model: 'en_US-ryan-medium',
    sizeMb: 63,
  },
  {
    id: 'en-alan',
    name: 'Alan',
    lang: 'en',
    gender: 'm',
    accent: 'British English',
    description: 'Voix masculine britannique, grave et posée.',
    model: 'en_GB-alan-medium',
    sizeMb: 63,
  },
  // Narrateurs « originaux » sélectionnés parmi les 904 lecteurs LibriVox du modèle LibriTTS-R.
  {
    id: 'en-eleanor',
    name: 'Eleanor',
    lang: 'en',
    gender: 'f',
    accent: 'American English',
    description: 'Narratrice de livres audio, timbre doux et intonation expressive.',
    model: 'en_US-libritts_r-medium',
    speaker: 466,
    sizeMb: 78,
  },
  {
    id: 'en-arthur',
    name: 'Arthur',
    lang: 'en',
    gender: 'm',
    accent: 'American English',
    description: 'Narrateur de livres audio, voix chaude et rassurante.',
    model: 'en_US-libritts_r-medium',
    speaker: 834,
    sizeMb: 78,
  },
];

export const SAMPLE_TEXT = {
  fr: "La maison se dressait au bout d'un chemin tranquille, à moitié cachée par de vieux chênes. Personne ne se souvenait de qui l'avait construite, mais chacun au village avait une histoire à raconter à son sujet.",
  en: 'The house stood at the end of a quiet lane, half hidden by old oak trees. Nobody remembered who had built it, but everyone in the village had a story to tell about it.',
};
