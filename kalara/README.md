# 🎧 Kalara — vos documents, racontés

Produit distinct de Muna IA. Deux parties indépendantes :

| Dossier | Rôle | Hébergement |
|---|---|---|
| [`app/`](app/) | Application (PWA) : lecture audio hors ligne de PDF, Word, EPUB | Netlify |
| [`api/`](api/) | API d'abonnement Premium : pass Mobile Money (CinetPay), licences signées | Railway |
| [`api/schema.sql`](api/schema.sql) | Schéma de la base | Supabase (projet Kalara) |

Modèle économique, fonctionnalités et performances : voir [`app/README.md`](app/README.md).

## Mettre en service l'abonnement

1. **Supabase (projet Kalara)** → SQL Editor : exécuter `api/schema.sql`.
2. **Railway** → *New Service* → *GitHub Repo* (ce dépôt) → *Settings* → **Root Directory : `kalara/api`**.
3. Variables du service (modèle : `api/.env.example`) :
   - `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` : projet **Kalara** (Project Settings → API, clé `service_role`) ;
   - `CINETPAY_API_KEY`, `CINETPAY_SITE_ID` ;
   - `CINETPAY_NOTIFY_URL` = `https://<api-kalara>/webhook/cinetpay` ;
   - `APP_URL` = `https://<api-kalara>` ; `KALARA_APP_URL` = adresse de l'application ;
   - `KALARA_LICENSE_PRIVATE_KEY` : clé privée de signature (`npm run keys` dans `api/` pour en générer une nouvelle,
     puis reporter la clé publique dans `app/src/premium.ts`) ;
   - facultatif : `WATI_API_URL`, `WATI_API_TOKEN` pour envoyer le code de restauration par WhatsApp.
4. *Settings* → *Networking* → **Generate Domain** : c'est l'adresse `<api-kalara>`.
5. Construire l'application avec `VITE_KALARA_API=https://<api-kalara>/api/kalara` et la déployer.

## API

| Méthode | Route | Rôle |
|---|---|---|
| GET | `/health` | État du service |
| GET | `/api/kalara/plans` | Formules : 7 jours (500 FCFA), 1 mois (1 500 FCFA), 1 an (12 000 FCFA) |
| POST | `/api/kalara/checkout` `{ plan, phone }` | Crée le paiement CinetPay → `{ paymentUrl, transactionId }` |
| GET/POST | `/api/kalara/return` | Retour depuis CinetPay → redirige vers l'application (`?payment=…`) |
| GET | `/api/kalara/license/:transactionId` | Vérifie le paiement auprès de CinetPay, renvoie la licence signée |
| POST | `/api/kalara/restore` `{ code }` | Restaure un abonnement avec le code `KAL-XXXX-XXXX` |
| POST | `/webhook/cinetpay` | Notification CinetPay (vérifiée auprès de CinetPay avant activation) |

- Activation **idempotente** (`payments.processed_at`) : webhook et application peuvent la déclencher en même temps.
- Un nouveau pass acheté avec le même numéro **prolonge** la licence (même code).
- Licence = JSON signé ECDSA P-256, vérifiée **hors ligne** par l'application.
