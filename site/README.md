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

### 3. Créer la boîte contact@ — et trancher l'incohérence avec Facebook

L'adresse `contact@baobablabs.cm` est affichée en page d'accueil, dans les mentions
légales et dans la politique de confidentialité. **Elle doit exister et être relevée
avant de soumettre le dossier Meta Business** : une adresse affichée mais inactive
est un motif de rejet. Si vous préférez une autre adresse, remplacez-la de la même
manière que le domaine.

**Incohérence à lever avant la soumission Meta** : la page Facebook Baobab Labs
affiche `baobablabs.officiel@gmail.com` comme adresse de contact, alors que le site
affiche `contact@baobablabs.cm`. Meta compare ces informations d'une source à
l'autre. Alignez les deux : soit la page Facebook adopte l'adresse du domaine, soit
le site reprend l'adresse Gmail — la première option est nettement plus solide face
aux partenaires bancaires.

De la même façon, la page Facebook affiche `+237 6 75 68 32 47` en téléphone et
`+237 6 80 55 41 32` en WhatsApp ; le site n'affiche que le second. Ce n'est pas une
contradiction, mais vérifiez que le numéro de téléphone déclaré dans le portefeuille
Meta Business correspond bien à l'un des deux.

Enfin, les profils sociaux indiquent « Douala, Cameroun » tandis que le siège
enregistré au RCCM est à Biyem-Assi, Yaoundé. Le site affiche le siège légal, ce qui
est correct ; l'adresse déclarée dans Meta Business doit être celle du RCCM.

---

## Déploiement sur Netlify

Le site est publié depuis ce dépôt ; aucune commande de build n'est exécutée.

1. Netlify → **Add new site** → **Import an existing project** → ce dépôt GitHub.
2. Branche à publier : celle de votre choix (`main` une fois la revue faite).
3. Les réglages sont lus depuis `netlify.toml` — laissez les champs *Build command*
   et *Publish directory* tels que proposés :
   - build command : vide
   - publish directory : `site`
4. **Domain settings** → ajoutez le domaine et activez le HTTPS (certificat
   Let's Encrypt automatique).

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

| Réseau | Compte | Remarque |
| --- | --- | --- |
| Instagram | `@baobab.labs.officiel` | Compte actif, alimenté. |
| TikTok | `@vendly.cm` | Voir la réserve ci-dessous. |
| Facebook | — | Non référencé : l'URL de la page n'a pas été fournie. |

**Réserve sur le compte TikTok.** Il porte le nom d'affichage « BAOBAB LABS » mais
son identifiant est `@vendly.cm`, sa biographie décrit Vendly (« Ta boutique répond
et vend sur WhatsApp ») et il ne comptait aucune publication ni aucun abonné au
moment de l'intégration. Deux problèmes sur un site dont l'objet est d'établir la
crédibilité de la société mère : c'est un compte **produit** et non un compte
d'entreprise, et un profil vide dessert davantage qu'il ne sert. Il a sa place sur
vendly.cm, pas ici. Retirez-le du bloc réseaux et du `sameAs` tant qu'il n'est pas
alimenté, ou laissez-le si vous préférez assumer la présence.

**Facebook manque.** C'est le réseau le plus utile ici : la page est rattachée au
portefeuille Meta Business, et la faire figurer dans le `sameAs` renforce
directement le dossier de vérification. Ajoutez l'URL de la page dès que vous
l'avez, aux trois mêmes endroits.

## Points à faire valider

- Les pages *Mentions légales* et *Politique de confidentialité* sont rédigées sur la
  base des pratiques usuelles. La politique renvoie à « la réglementation
  camerounaise applicable » sans citer de texte précis : faites confirmer par un
  conseil juridique la référence légale exacte à mentionner.
- Le directeur de la publication est désigné par sa fonction (« le représentant légal
  d'ETS BAOBAB LABS »). Vous pouvez y substituer un nom dans
  `mentions-legales.html`.
