# Site institutionnel Baobab Labs

Vitrine institutionnelle d'**ETS BAOBAB LABS**, société camerounaise de développement
logiciel et de solutions d'intelligence artificielle, éditrice de **Vendly** et
**MUNA AI**.

Le site sert de preuve de légitimité pour la vérification d'entreprise Meta Business,
les partenaires financiers et les prescripteurs. Les mentions légales du pied de page
doivent rester **strictement identiques** à celles du portefeuille Meta Business.

---

## Ce que c'est techniquement

Un site statique sans build, sans framework et sans dépendance : quatre pages HTML,
une feuille de style, un fichier JavaScript, des polices auto-hébergées.

- **Poids au premier chargement** : ~100 Ko non compressés (≈ 40 Ko en gzip).
- **Zéro requête externe** : polices servies depuis le domaine, aucun CDN, aucun
  traceur, aucun cookie.
- **Accessibilité** : contrastes conformes WCAG AA, navigation clavier, lien
  d'évitement, `prefers-reduced-motion` respecté.
- **Sécurité** : Content-Security-Policy stricte (`script-src 'self'`,
  `style-src 'self'`, sans `unsafe-inline`), HSTS, `frame-ancestors 'none'`.

```
site/
├── index.html              Page principale (hero, approche, produits, contact)
├── mentions-legales.html
├── confidentialite.html
├── merci.html              Confirmation après envoi du formulaire
├── 404.html
├── robots.txt
├── sitemap.xml
├── assets/
│   ├── css/styles.css
│   ├── js/main.js          En-tête au défilement, révélations, constellation du hero
│   ├── fonts/              Unbounded 900 + Space Grotesk 400–700 (sous-ensembles latin)
│   └── img/                logo-baobab.svg, favicon.svg, og-image.png, apple-touch-icon.png
└── tools/generate-mark.py  Générateur du logo de secours (voir plus bas)
```

`netlify.toml` se trouve à la racine du dépôt et publie ce dossier.

---

## Avant la mise en ligne — trois points à traiter

### 1. Remplacer le logo par le fichier officiel

Le site affiche `assets/img/logo-baobab.svg` via un masque CSS : **la couleur vient
de la feuille de style**, pas du fichier. Un seul fichier couvre donc les deux
déclinaisons de la charte (indigo sur fond clair, crème sur fond sombre).

Pour installer le logo officiel : écrasez `assets/img/logo-baobab.svg` par votre
fichier, en conservant ce nom. Aucune autre modification n'est nécessaire.

- Format conseillé : SVG. Un PNG à fond transparent fonctionne également (le masque
  utilise la couche alpha, les couleurs du fichier sont ignorées).
- Le fichier livré est un tracé de secours produit par `tools/generate-mark.py`. Il
  reprend le motif baobab + réseau de nœuds mais n'est **pas** le logo officiel.
- `assets/img/favicon.svg` est une version simplifiée destinée aux très petites
  tailles (16–32 px), où le réseau de nœuds complet devient illisible. À adapter si
  vous disposez d'une déclinaison officielle pour ces tailles.

### 2. Fixer le domaine

Le domaine `baobablabs.cm` est utilisé comme valeur par défaut dans les URL
canoniques, les balises Open Graph, `sitemap.xml` et `robots.txt`. Si vous retenez
un autre domaine, remplacez-le partout en une commande :

```bash
grep -rl 'baobablabs.cm' site/ | xargs sed -i 's/baobablabs\.cm/votre-domaine.cm/g'
```

### 3. Créer la boîte contact@

L'adresse `contact@baobablabs.cm` est affichée en page d'accueil, dans les mentions
légales et dans la politique de confidentialité. **Elle doit exister et être relevée
avant de soumettre le dossier Meta Business** : une adresse affichée mais inactive
est un motif de rejet. Si vous préférez une autre adresse, remplacez-la de la même
manière que le domaine.

**Concordance avec la page Facebook.** Les informations affichées sur le site et sur
la page Facebook Baobab Labs sont alignées — Meta recoupe ces sources entre elles :

| Donnée | Site | Page Facebook |
| --- | --- | --- |
| Adresse de contact | `contact@baobablabs.cm` | `contact@baobablabs.cm` |
| Téléphone | `+237 6 75 68 32 47` | `+237 6 75 68 32 47` |
| WhatsApp Business | `+237 6 80 55 41 32` | `+237 6 80 55 41 32` |
| Adresse | Biyem-Assi, Yaoundé, Cameroun | Biyem-assi, Yaoundé, Cameroon |

Les numéros sont écrits selon le même découpage que sur Facebook, volontairement.
Toute modification d'un côté doit être répercutée de l'autre, ainsi que dans le
portefeuille Meta Business.

---

## Déploiement sur Netlify

Le projet Netlify est **déjà créé** et attend son premier déploiement :

| | |
| --- | --- |
| Projet | `baobab-labs` |
| Équipe | `vendly-officiel` |
| Identifiant | `7e384df0-d219-4ae6-96cd-45fa45df4310` |
| Administration | https://app.netlify.com/projects/baobab-labs |
| URL une fois déployé | https://baobab-labs.netlify.app |

Le site est publié depuis ce dépôt ; aucune commande de build n'est exécutée.
Deux façons de procéder.

### Option A — lier le dépôt GitHub (recommandé)

Chaque `git push` redéploie automatiquement. C'est la mise en place à privilégier
sur la durée.

1. https://app.netlify.com/projects/baobab-labs → **Project configuration** →
   **Build & deploy** → **Link repository** → ce dépôt GitHub.
2. Branche de production : `main` une fois la revue faite, ou
   `claude/baobab-labs-website-q5sm89` pour publier immédiatement.
3. Les réglages sont lus depuis `netlify.toml` — laissez les champs *Build command*
   et *Publish directory* tels que proposés :
   - build command : vide
   - publish directory : `site`
4. **Domain settings** → ajoutez le domaine et activez le HTTPS (certificat
   Let's Encrypt automatique).

Le dépôt contenant aussi le backend MUNA IA, Netlify détectera le `package.json`
de la racine et installera ses dépendances avant de constater qu'aucune commande de
build n'est définie. C'est inoffensif, seulement un peu lent. Pour l'éviter, vous
pouvez remplacer le bloc `[build]` de `netlify.toml` par `base = "site"` et
`publish = "."` — à valider par un déploiement de test, la construction du site
n'ayant pas pu être exercée depuis l'environnement de développement.

### Option B — déploiement direct depuis votre machine

Ponctuel, sans lier le dépôt. À exécuter à la racine du dépôt :

```bash
npx -y @netlify/mcp@latest --site-id 7e384df0-d219-4ae6-96cd-45fa45df4310
```

La commande téléverse le dépôt et le construit chez Netlify. Ajoutez `--no-wait`
pour ne pas attendre la fin du déploiement.

### Formulaire de contact

Le formulaire utilise **Netlify Forms** : il est détecté automatiquement au
déploiement, sans code serveur.

- Après le premier déploiement : **Forms** → formulaire `contact` → **Settings and
  usage** → **Form notifications** → ajoutez une notification par e-mail vers
  l'adresse qui doit recevoir les demandes.
- Un champ piège (*honeypot*) `societe-web`, invisible pour les visiteurs, filtre
  les robots.
- Après envoi, le visiteur est redirigé vers `/merci.html`.

---

## Développement local

Aucune installation n'est requise :

```bash
cd site
python3 -m http.server 8788
# puis http://127.0.0.1:8788
```

Servez bien depuis le dossier `site/` : les chemins sont absolus (`/assets/...`).

---

## Régénérer les images

**Logo de secours** — modifie le tracé ; la graine change la disposition du réseau :

```bash
python3 site/tools/generate-mark.py site/assets/img/logo-baobab.svg 23
```

**Image de partage social** (`og-image.png`, 1200 × 630) — elle a été produite par
capture d'une page HTML servie localement. Si vous changez le logo ou le message
principal, régénérez-la, ou remplacez simplement le fichier par une image aux mêmes
dimensions.

---

## Règles éditoriales appliquées

Ces contraintes ont guidé la rédaction ; les conserver en cas de modification.

- **Aucune preuve sociale fabriquée** : pas de témoignage, pas de logo client, pas de
  chiffre inventé. Les seuls chiffres présents sont vérifiables (année de
  constitution, RCCM, NIU, nombre de produits).
- **Nkap n'est pas mentionné** : seuls Vendly et MUNA AI sont présentés.
- **Français** comme unique langue du site (marché CEMAC francophone).
- **Mentions légales inchangées** : `ETS BAOBAB LABS`,
  `RCCM CM-NSI-01-2026-A10-01729`, `NIU P040117214047C`,
  `Biyem-Assi, Yaoundé, Cameroun`.

## Réseaux sociaux

Les liens pointent vers les profils (et non vers une publication), à trois endroits :
la section contact, le bloc réseaux du pied de page, et le champ `sameAs` du JSON-LD
`Organization` — c'est ce dernier qui rattache officiellement les profils à la
société pour les outils de vérification.

| Réseau | Compte | Statut |
| --- | --- | --- |
| Facebook | Page « Baobab Labs » | Référencé via un lien de partage — voir ci-dessous. |
| Instagram | `@baobab.labs.officiel` | Référencé. |
| TikTok | `@vendly.cm` | Retiré du site — voir plus bas. |

**Remplacer le lien Facebook par son URL canonique.** La page est actuellement
référencée par `facebook.com/share/1HuwswRakU/`, un lien de partage : une redirection
opaque, propre au partage, et non l'adresse de la page. Le lien fonctionne, mais deux
raisons de le remplacer dès que possible :

- le champ `sameAs` sert à rattacher la page à la société pour les outils de
  vérification ; une redirection y est nettement moins probante qu'une URL de page ;
- un lien de partage peut être invalidé, contrairement à l'adresse de la page.

L'URL canonique se lit dans la barre d'adresse en ouvrant la page sur ordinateur :
soit `facebook.com/<nom-utilisateur>`, soit `facebook.com/profile.php?id=<identifiant>`
si aucun nom d'utilisateur n'a été défini. Remplacez-la aux trois emplacements
indiqués ci-dessous.

**TikTok a été retiré.** Le compte porte le nom d'affichage « BAOBAB LABS » mais son
identifiant est `@vendly.cm`, sa biographie décrit Vendly (« Ta boutique répond et
vend sur WhatsApp ») et il ne comptait aucune publication ni aucun abonné. C'est un
compte **produit**, pas un compte d'entreprise, et un profil vide dessert un site
dont l'objet est d'établir la crédibilité de la société mère. Sa place est sur
vendly.cm.

Pour le réintégrer une fois alimenté — et sous réserve qu'il soit rebaptisé au nom de
Baobab Labs — il faut le rétablir aux trois emplacements décrits ci-dessous.

**Les trois emplacements** où figure chaque réseau, dans `index.html` :

1. le canal de la section contact (`<a class="channel">`) ;
2. la pastille du bloc réseaux du pied de page (`<div class="social">`) ;
3. le tableau `sameAs` du JSON-LD `Organization`, en tête de page.

Le pied de page des quatre autres pages est une copie de celui d'`index.html` :
après modification, reportez-y le même bloc.

## Points à faire valider

- Les pages *Mentions légales* et *Politique de confidentialité* sont rédigées sur la
  base des pratiques usuelles. La politique renvoie à « la réglementation
  camerounaise applicable » sans citer de texte précis : faites confirmer par un
  conseil juridique la référence légale exacte à mentionner.
- Le directeur de la publication est désigné par sa fonction (« le représentant légal
  d'ETS BAOBAB LABS »). Vous pouvez y substituer un nom dans
  `mentions-legales.html`.
