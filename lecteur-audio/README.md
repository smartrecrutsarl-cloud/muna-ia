# 🎧 Lecteur Audio — PDF, Word, EPUB

Application web installable (PWA) qui lit à voix haute vos **PDF**, documents **Word (.docx)** et livres **EPUB**,
**y compris hors ligne**.

## Les 3 types de voix

| Moteur | Qualité | Hors ligne | Coût |
|---|---|---|---|
| **Piper** (par défaut) | Voix neuronales naturelles, entraînées sur de vraies voix humaines (FR : Siwis, Tom, UPMC, Gilles… + 100 voix dans 35 langues) | ✅ Oui, après un téléchargement unique de la voix (~60 Mo) | Gratuit |
| **ElevenLabs** | Voix premium, y compris vos voix clonées ou celles de la Voice Library | ✅ Oui, **après préparation** : l'audio est généré en ligne puis stocké sur l'appareil | Crédits ElevenLabs (votre clé API) |
| **Voix de l'appareil** | Dépend du téléphone / ordinateur | ✅ Le plus souvent | Gratuit |

> ℹ️ ElevenLabs ne peut pas générer de voix sans Internet (le modèle tourne sur leurs serveurs).
> Le bouton **« Préparer hors ligne »** génère tout le livre à l'avance (en Wi-Fi) et l'enregistre sur l'appareil :
> ensuite l'écoute se fait sans connexion. Tout passage déjà écouté en ligne est aussi gardé, pour ne jamais payer deux fois.

## Fonctionnalités

- Import PDF, DOCX, EPUB (et TXT) par bouton ou glisser-déposer — les fichiers restent sur l'appareil.
- Découpage automatique en chapitres (table des matières EPUB/PDF, titres Word).
- Texte affiché avec le passage en cours surligné ; touchez une phrase pour y sauter.
- Reprise automatique là où vous vous êtes arrêté, pour chaque document.
- Vitesse 0,75× à 2×, chapitre/passage précédent-suivant, raccourcis clavier (Espace, ← →).
- Contrôles sur l'écran verrouillé / casque (Media Session).
- **Export** du livre complet en un seul fichier audio (MP3 pour ElevenLabs, WAV pour Piper).
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
3. Au premier lancement (avec Internet), téléchargez une voix Piper dans ⚙︎ Réglages.
   Ensuite, l'application, la voix et vos documents fonctionnent **en mode avion**.

## Utiliser ElevenLabs

1. Créez une clé sur [elevenlabs.io](https://elevenlabs.io) → *Developers* → *API Keys*.
2. ⚙︎ Réglages → ElevenLabs → collez la clé → **Charger mes voix** → choisissez une voix et un modèle.
3. Ouvrez un document → **Préparer hors ligne** (l'app affiche le nombre de caractères avant de consommer des crédits).
4. Une fois « Prêt hors ligne ✓ », vous pouvez écouter sans connexion ou **Exporter l'audio** en MP3.

La clé API est stockée uniquement dans le navigateur de l'appareil.

## Limites connues

- PDF scannés (images sans texte) : il faut d'abord les passer à l'OCR.
- Anciens fichiers Word `.doc` : enregistrez-les en `.docx`.
- Piper génère la voix sur l'appareil : sur un téléphone ancien, le premier passage peut prendre quelques secondes
  (les passages suivants sont préparés en avance pendant la lecture).

## Architecture

```
src/
├── main.ts              Interface (bibliothèque, lecteur, réglages)
├── player.ts            Lecture enchaînée, préchargement, cache, Media Session
├── offline.ts           Préparation hors ligne et export audio
├── parsers/             Extraction du texte : pdf.ts (pdf.js), docx.ts (mammoth), epub.ts (JSZip)
├── engines/
│   ├── piper.ts         Voix Piper (onnxruntime-web, WASM) — exécutées dans piper.worker.ts
│   └── elevenlabs.ts    API ElevenLabs (text-to-speech)
├── db.ts                IndexedDB : documents + audio préparé
└── settings.ts          Préférences (localStorage)
```

Le service worker (vite-plugin-pwa / Workbox) met en cache l'application et les moteurs WASM ;
les modèles de voix Piper sont stockés dans l'OPFS du navigateur et dans le cache du service worker.
