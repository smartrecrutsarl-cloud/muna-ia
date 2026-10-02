# 🎧 Kalara — vos documents, racontés

*Kalara* signifie « livre, papier, lettre » en ewondo. Application installable (PWA) qui transforme vos **PDF**,
documents **Word (.docx)** et livres **EPUB** en livres audio, lus par des voix neuronales naturelles —
**entièrement hors ligne** et **sans que vos fichiers quittent l'appareil**. Une application Muna IA.

🌐 **En ligne : https://lecteur-audio-muna.netlify.app** — ouvrez-la sur votre téléphone puis « Installer l'application ».

## Modèle économique : freemium + pass Mobile Money

| | **Gratuit** | **Kalara Premium** |
|---|---|---|
| Voix | Jessica ♀ et Pierre ♂ (français) + voix de l'appareil | 12 narrateurs + 120 voix (30 langues) |
| Bibliothèque | 3 documents | Illimitée |
| Lecture hors ligne, minuterie, signets, chapitres, recherche | ✅ | ✅ |
| Prix | 0 | **500 FCFA / 7 jours · 1 500 FCFA / mois · 12 000 FCFA / an** |

- **7 jours de Premium offerts** au premier lancement.
- **Pass prépayés**, payés par MTN MoMo ou Orange Money via CinetPay : jamais de prélèvement automatique.
  Un nouveau pass acheté avec le même numéro s'ajoute à la suite du pass en cours.
- **Licence signée** (ECDSA P-256) vérifiée par l'application **hors ligne** ; **code de restauration** `KAL-XXXX-XXXX`
  pour retrouver son abonnement sur un autre téléphone.
- Coût marginal quasi nul : la voix est produite sur le téléphone ; seules la commission CinetPay (≈ 2 %) et
  l'hébergement comptent.
- L'abonnement n'est actif que si l'application est construite avec `VITE_KALARA_API` ; sinon tout est accessible.

### Activer le paiement

1. **Supabase** → SQL Editor : exécuter `supabase-kalara.sql` (à la racine du dépôt).
2. **Railway** (backend Muna IA) → Variables :
   - `KALARA_LICENSE_PRIVATE_KEY` : clé privée qui signe les licences (générée avec `node scripts/kalara-keys.js` ;
     la clé publique correspondante est dans `src/premium.ts`) ;
   - `KALARA_APP_URL` : adresse de l'application (ex. `https://lecteur-audio-muna.netlify.app`) ;
   - `APP_URL` : adresse publique du backend (sert d'adresse de retour après paiement) ;
   - `CINETPAY_API_KEY`, `CINETPAY_SITE_ID`, `CINETPAY_NOTIFY_URL` (déjà utilisés par Muna IA).
3. Construire l'application avec l'adresse de l'API :
   ```bash
   VITE_KALARA_API=https://<votre-backend>.up.railway.app/api/kalara npm run build
   ```

## Ce que l'on obtient

**Écoute**
- 12 narrateurs (5 français, 7 anglais) + plus de 120 voix dans une trentaine de langues ; extrait à écouter avant téléchargement.
- Écran « Lecture en cours » plein écran : couverture, ambiance colorée tirée du livre, position dans le chapitre, temps restant.
- Mini-lecteur toujours accessible, contrôles sur l'écran verrouillé et le casque (pochette incluse).
- Vitesse de 0,5× à 2,5× (instantanée, sans changer la hauteur de la voix).
- Minuterie de sommeil (5 à 60 min ou fin du chapitre) avec fondu du son.
- Reprise automatique là où vous vous étiez arrêté, pour chaque document.

**Lecture**
- Texte mis en page (paragraphes, typographie Literata), passage en cours surligné, défilement qui suit la voix.
- Touchez une phrase pour l'écouter ; bouton « Revenir à la lecture » si vous faites défiler.
- Chapitres avec progression et durée, signets, recherche dans le document.
- Thèmes Clair / Sépia / Sombre / Auto, taille du texte réglable.

**Bibliothèque**
- Vraies couvertures (image de l'EPUB, 1re page du PDF) ou couverture générée élégante.
- Carte « Reprendre », statistiques d'écoute (minutes du jour, jours d'affilée).
- **« Partager → Kalara »** depuis WhatsApp, Gmail ou le gestionnaire de fichiers (Android).
- « Ouvrir avec Kalara » sur ordinateur.

## Performances

- **Synthèse multi-cœurs** : grâce à l'isolation cross-origin (en-têtes `COOP`/`COEP`, fichier `public/_headers`),
  le moteur utilise jusqu'à 4 cœurs — **10 s d'audio générées en ~1 s** au lieu de ~2,8 s.
- La voix et le phonémiseur sont **préchargés** à l'ouverture d'un livre ; passages courts (≤ 260 caractères)
  pour un démarrage rapide ; les 3 passages suivants sont préparés pendant l'écoute.
- Interface légère (≈ 35 Ko compressés) ; les analyseurs PDF/Word/EPUB ne sont chargés qu'à l'import.

## Lancer en local

```bash
cd lecteur-audio
npm install
npm run dev        # développement : http://localhost:5173
npm run build      # version de production dans dist/
npm run preview    # tester la version de production (avec les en-têtes d'isolation)
```

## Mettre en ligne

Déployez le dossier `dist/` sur un hébergement statique **en HTTPS** qui applique le fichier `_headers`
(Netlify le fait automatiquement ; `netlify.toml` contient la même configuration pour un déploiement Git).
Sans ces en-têtes, l'application fonctionne mais la synthèse n'utilise qu'un cœur.

## Les voix

| Langue | Narrateurs |
|---|---|
| 🇫🇷 Français | **Siwis** ♀ · **Jessica** ♀ · **Pierre** ♂ · **Tom** ♂ · **Miro** ♂ |
| 🇬🇧🇺🇸 English | **Cori** ♀ (GB) · **Jenny** ♀ (GB) · **Lessac** ♀ (US) · **Eleanor** ♀ (US) · **Ryan** ♂ (US) · **Alan** ♂ (GB) · **Arthur** ♂ (US) |

Modèles Piper (licences libres), téléchargés une fois (60–80 Mo) depuis `huggingface.co/rhasspy/piper-voices`
avec un miroir de secours, puis conservés sur l'appareil. *Eleanor* et *Arthur* ont été choisis parmi les 904 lecteurs
LibriVox du modèle LibriTTS-R par analyse acoustique.

## Limites connues

- PDF scannés (images sans texte) : il faut d'abord les passer à l'OCR.
- Anciens fichiers Word `.doc` : enregistrez-les en `.docx`.
- Le partage vers l'application est disponible sur Android (Chrome) ; iOS ne le permet pas aux applications web.

## Architecture

```
src/
├── main.tsx             Point d'entrée, fichiers partagés / ouverts avec l'application
├── sw.ts                Service worker : hors ligne + réception des partages
├── ui/                  Interface (Preact) : accueil, lecture, lecteur, feuilles, accueil guidé
├── player.ts            Lecture enchaînée, préchargement, minuterie, estimations, Media Session
├── parsers/             Extraction texte + couverture : pdf.ts (pdf.js), docx.ts (mammoth), epub.ts (JSZip)
├── engines/piper.ts     Téléchargement des voix et synthèse (piper.worker.ts : onnxruntime-web + espeak-ng)
├── covers.ts            Couvertures et couleur d'ambiance
├── stats.ts             Statistiques d'écoute
├── voices.ts            Catalogue des 12 narrateurs
├── premium.ts           Essai, licences signées (vérifiées hors ligne), droits, paiement CinetPay
└── db.ts                IndexedDB : bibliothèque
```
