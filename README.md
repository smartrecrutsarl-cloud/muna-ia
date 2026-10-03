# 🤖 Muna IA — Backend

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
