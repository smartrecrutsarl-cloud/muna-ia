# 🎧 Lecteur Audio — PDF, Word, EPUB

Application web installable (PWA) qui lit à voix haute vos **PDF**, documents **Word (.docx)** et livres **EPUB**,
**y compris hors ligne**.

🌐 **En ligne : https://lecteur-audio-muna.netlify.app** — ouvrez-la sur votre téléphone puis « Installer l'application ».

## Les voix

L'application propose **12 voix de narration** sélectionnées pour la lecture de livres, qui fonctionnent
**entièrement hors ligne** une fois téléchargées (une seule fois, ~63–78 Mo par voix) :

| Langue | Voix |
|---|---|
| 🇫🇷 Français | **Siwis** ♀ · **Jessica** ♀ · **Pierre** ♂ · **Tom** ♂ · **Miro** ♂ |
| 🇬🇧🇺🇸 English | **Cori** ♀ (GB) · **Jenny** ♀ (GB) · **Lessac** ♀ (US) · **Eleanor** ♀ (US) · **Ryan** ♂ (US) · **Alan** ♂ (GB) · **Arthur** ♂ (US) |

- Chaque voix a un **extrait à écouter avant de la télécharger**.
- *Eleanor* et *Arthur* sont des narrateurs « originaux » choisis parmi les 904 lecteurs de livres audio LibriVox
  du modèle LibriTTS-R, après analyse acoustique de chacun (hauteur, expressivité, netteté).
- L'intelligibilité des voix françaises a été vérifiée par transcription automatique (ElevenLabs Scribe).
- Seuls des modèles assez rapides pour lire en continu sur un téléphone ont été retenus.
- Plus de 100 autres voix (une trentaine de langues) restent accessibles dans « Plus de voix ».
- Les **voix de l'appareil** (Android / iOS / Windows / macOS) sont aussi disponibles, sans téléchargement.

> Pourquoi pas ElevenLabs ? Ses voix sont générées sur ses serveurs : impossible de les utiliser hors ligne
> sans payer d'avance la génération de chaque livre. Les voix ci-dessus tournent directement sur l'appareil, gratuitement.

## Fonctionnalités

- Import PDF, DOCX, EPUB (et TXT) par bouton ou glisser-déposer — les fichiers restent sur l'appareil.
- Découpage automatique en chapitres (table des matières EPUB/PDF, titres Word).
- Texte affiché avec le passage en cours surligné ; touchez une phrase pour y sauter.
- Reprise automatique là où vous vous êtes arrêté, pour chaque document.
- Vitesse 0,75× à 2×, chapitre/passage précédent-suivant, raccourcis clavier (Espace, ← →).
- Contrôles sur l'écran verrouillé / casque (Media Session).
- **Export** d'un chapitre en fichier audio WAV.
- Mode sombre automatique.

## Lancer en local

```bash
cd lecteur-audio
npm install
npm run dev        # développement : http://localhost:5173
npm run build      # version de production dans dist/
npm run preview    # tester la version de production
```

## Mettre en ligne et installer sur téléphone

1. Déployez le dossier `dist/` sur n'importe quel hébergement statique **en HTTPS**
   (Netlify, Vercel, GitHub Pages, Cloudflare Pages…).
2. Ouvrez l'adresse sur le téléphone :
   - **Android (Chrome)** : menu ⋮ → « Installer l'application ».
   - **iPhone (Safari)** : Partager → « Sur l'écran d'accueil ».
3. Au premier lancement (avec Internet), écoutez les extraits et téléchargez une ou plusieurs voix dans ⚙︎ Réglages.
   Ensuite, l'application, la voix et vos documents fonctionnent **en mode avion**.

## Limites connues

- PDF scannés (images sans texte) : il faut d'abord les passer à l'OCR.
- Anciens fichiers Word `.doc` : enregistrez-les en `.docx`.
- La voix est générée sur l'appareil : sur un téléphone ancien, le premier passage peut prendre quelques secondes
  (les passages suivants sont préparés en avance pendant la lecture).
- Les voix sont téléchargées depuis le dépôt officiel Piper (`huggingface.co/rhasspy/piper-voices`).

## Architecture

```
src/
├── main.ts              Interface (bibliothèque, lecteur, réglages)
├── player.ts            Lecture enchaînée, préchargement, cache, Media Session
├── offline.ts           Export audio d'un chapitre
├── voices.ts            Catalogue des 12 voix de narration
├── parsers/             Extraction du texte : pdf.ts (pdf.js), docx.ts (mammoth), epub.ts (JSZip)
├── engines/
│   └── piper.ts         Téléchargement des voix et synthèse (piper.worker.ts : onnxruntime-web + espeak-ng en WASM)
├── db.ts                IndexedDB : bibliothèque de documents
└── settings.ts          Préférences (localStorage)
```

Le service worker (vite-plugin-pwa / Workbox) met en cache l'application et les moteurs WASM ;
les modèles de voix sont stockés dans le Cache Storage du navigateur (`public/samples/` contient les extraits).
