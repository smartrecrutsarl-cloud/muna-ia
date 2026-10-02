# 🤖 Muna IA — Backend

> 🎧 Ce dépôt contient aussi **[Kalara](lecteur-audio/)** : l'application qui raconte vos PDF, Word et EPUB avec des voix naturelles, hors ligne. Son abonnement Premium (pass Mobile Money) est servi par ce backend : voir « API Kalara » plus bas.

> Assistant recrutement intelligent via WhatsApp · Cameroun & CEMAC

---

## 🏗️ Architecture

```
WhatsApp (candidat/recruteur)
        ↓
     WATI API
        ↓ webhook
  [Ce serveur Node.js]
   ├── Flow Recruteur (FSM)
   ├── Flow Candidat (FSM)
   ├── Claude AI (scoring CV)
   ├── CinetPay (MTN MoMo / Orange)
   └── Job Scorer (cron 30min)
        ↓
     Supabase (DB)
```

---

## 📦 Installation locale

```bash
# 1. Cloner / copier le projet
cd muna-ia

# 2. Installer les dépendances
npm install

# 3. Configurer les variables d'environnement
cp .env.example .env
# → Ouvrir .env et remplir TOUTES les valeurs

# 4. Lancer en développement
npm run dev
```

Le serveur démarre sur `http://localhost:3000`

---

## 🗄️ Configuration Supabase

1. Créer un projet sur https://app.supabase.com (gratuit)
2. Aller dans **SQL Editor** → **New Query**
3. Coller le contenu de `supabase-schema.sql` et exécuter
4. Récupérer vos clés dans **Settings → API** :
   - `SUPABASE_URL` = Project URL
   - `SUPABASE_SERVICE_KEY` = service_role key (⚠️ pas la anon key)

---

## 📱 Configuration WATI

1. Créer un compte sur https://wati.io (plan Starter ~40$/mois)
2. Connecter votre numéro WhatsApp Business
3. Récupérer votre `WATI_API_URL` et `WATI_API_TOKEN` dans les paramètres
4. **Après déploiement Railway**, configurer le webhook :
   - Settings → Webhook URL : `https://votre-app.railway.app/webhook/wati`

---

## 🤖 Configuration Claude API

1. Créer un compte sur https://console.anthropic.com
2. API Keys → Create Key
3. Copier la clé dans `ANTHROPIC_API_KEY`

---

## 💳 Configuration CinetPay

1. Créer un compte marchand sur https://cinetpay.com
2. Récupérer `CINETPAY_API_KEY` et `CINETPAY_SITE_ID`
3. Configurer le webhook dans le dashboard CinetPay :
   - Notify URL : `https://votre-app.railway.app/webhook/cinetpay`

---

## 🚀 Déploiement Railway

```bash
# 1. Installer Railway CLI
npm install -g @railway/cli

# 2. Se connecter
railway login

# 3. Créer le projet
railway new

# 4. Déployer
railway up

# 5. Configurer les variables d'environnement
# → Dashboard Railway → Variables → Ajouter toutes les vars du .env

# 6. Récupérer l'URL publique
# → Dashboard Railway → Settings → Domains
```

**Ou via l'interface web :**
1. Aller sur https://railway.app
2. New Project → Deploy from GitHub
3. Connecter votre repo
4. Variables → copier toutes les valeurs de `.env`
5. Railway déploie automatiquement

---

## 📡 Endpoints

| Route | Méthode | Description |
|-------|---------|-------------|
| `/webhook/wati` | POST | Réception messages WhatsApp |
| `/webhook/cinetpay` | POST | Confirmation paiements |
| `/dashboard` | GET | Dashboard admin |
| `/api/stats` | GET | Statistiques JSON |
| `/api/offers` | GET | Liste des offres |
| `/api/payments` | GET | Liste des paiements |
| `/health` | GET | Health check |

---

## 💬 Flows WhatsApp

### Recruteur
```
Recruteur → "RECRUTER"
Bot → "Quel poste ?"
Recruteur → "Caissière"
Bot → "Dans quelle ville ?"
Recruteur → "Douala"
Bot → "Rémunération ?"
Recruteur → "100 000 FCFA"
Bot → "Offre créée ! Code: MUNA-AB12CD · Partagez ce lien..."
--- 48h plus tard ---
Bot → "Top 5 prêt ! Payez 3000 FCFA pour le rapport PDF..."
Recruteur paye via MTN MoMo
Bot → [Envoie le PDF]
```

### Candidat
```
Candidat reçoit le lien → clique → envoie "MUNA-AB12CD"
Bot → "Poste: Caissière à Douala. Votre nom ?"
Candidat → "Marie Nguesso"
Bot → "Envoyez votre CV (photo ou PDF)"
Candidat → [Envoie photo CV]
Bot → "Candidature enregistrée ! Boostez pour 500 FCFA..."
```

---

## 🔧 Structure des fichiers

```
src/
├── index.js          # Point d'entrée, démarrage serveur
├── app.js            # Configuration Express
├── config.js         # Variables d'environnement centralisées
├── db.js             # Toutes les requêtes Supabase
├── services/
│   ├── wati.js       # Envoi messages WhatsApp
│   ├── claude.js     # Scoring IA, OCR, feedback
│   ├── cinetpay.js   # Liens de paiement Mobile Money
│   └── pdf.js        # Génération rapport PDF Top 5
├── flows/
│   ├── router.js     # Détecte recruteur vs candidat
│   ├── recruiter.js  # Machine à états recruteur
│   └── candidate.js  # Machine à états candidat
├── routes/
│   ├── wati-webhook.js      # Webhook messages entrants
│   ├── cinetpay-webhook.js  # Webhook paiements
│   └── dashboard.js         # API + page dashboard
└── jobs/
    └── scorer.js     # Cron 48h → score + envoie rapport
public/
└── dashboard.html    # Dashboard admin (HTML pur)
```

---

## ⚠️ Points d'attention

- **WhatsApp API** : La vérification Meta peut prendre **2-4 semaines**. Lancer la demande dès le jour 1.
- **Loi 2024/017** : Ajouter une mention de consentement dans le premier message candidat.
- **Taxe Mobile Money** : 4 FCFA/transaction intégrée automatiquement par CinetPay.
- **Scoring IA** : Tester sur des CVs camerounais réels avant lancement.

---

*Muna IA — Juin 2026*


---

## 🎧 API Kalara (abonnement Premium du lecteur audio)

Routes publiques (CORS ouvert), montées sur `/api/kalara` :

| Méthode | Route | Rôle |
|---|---|---|
| GET | `/plans` | Formules : 7 jours (500 FCFA), 1 mois (1 500 FCFA), 1 an (12 000 FCFA) |
| POST | `/checkout` `{ plan, phone }` | Crée le paiement CinetPay (Mobile Money) → `{ paymentUrl, transactionId }` |
| GET/POST | `/return` | Retour depuis CinetPay → redirige vers l'application (`?payment=…`) |
| GET | `/license/:transactionId` | Vérifie le paiement **auprès de CinetPay** et renvoie la licence signée |
| POST | `/restore` `{ code }` | Restaure un abonnement avec le code `KAL-XXXX-XXXX` |

- Le webhook `/webhook/cinetpay` reconnaît les transactions `KAL-…` et active la licence.
- L'activation est **idempotente** (colonne `payments.processed_at`) : webhook et application peuvent la
  déclencher en même temps sans double prolongation.
- Un nouveau pass acheté avec le même numéro **prolonge** la licence existante (même code).
- Le code est aussi envoyé par WhatsApp (au mieux : WATI n'accepte les messages de session que si
  l'utilisateur a écrit dans les 24 h) ; il est toujours affiché dans l'application.

Variables d'environnement supplémentaires :

```
KALARA_LICENSE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n…\n-----END PRIVATE KEY-----
KALARA_APP_URL=https://lecteur-audio-muna.netlify.app
```

Base de données : exécuter `supabase-kalara.sql` dans Supabase. Nouvelle paire de clés : `node scripts/kalara-keys.js`
(mettre alors la clé publique dans `lecteur-audio/src/premium.ts`).
