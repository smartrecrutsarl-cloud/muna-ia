// Kalara Premium : essai gratuit, licence signée (vérifiée hors ligne) et droits d'accès.
import { computed, signal } from '@preact/signals';

/** Adresse de l'API (backend Muna IA). Vide = paiement pas encore configuré. */
export const API = String(import.meta.env.VITE_KALARA_API ?? '').replace(/\/$/, '');
/** Sans backend configuré, l'abonnement est désactivé : tout reste accessible. */
export const MONETIZED = API !== '';

/** Clé publique ECDSA P-256 (SPKI, base64) qui vérifie les licences émises par le backend. */
const LICENSE_PUBLIC_KEY =
  'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEoZcNR5b9N5SwyCg1nP66rds5OzcQe/UAfWP27vM1ymnfds1hTGFutuXtU02qNFwAPJQfHwH220bKvHPR6wkcLQ==';

export const FREE_VOICES = new Set(['fr-jessica', 'fr-pierre']);
export const FREE_DOC_LIMIT = 3;
export const TRIAL_DAYS = 7;
const DAY = 86_400_000;

export interface Plan {
  id: 'week' | 'month' | 'year';
  label: string;
  price: number;
  days: number;
  badge?: string;
  perMonth?: string;
}

export const PLANS: Plan[] = [
  { id: 'week', label: '7 jours', price: 500, days: 7 },
  { id: 'month', label: '1 mois', price: 1500, days: 30, badge: 'Le plus choisi' },
  { id: 'year', label: '1 an', price: 12000, days: 365, badge: '−33 %', perMonth: '1 000 FCFA / mois' },
];

export interface License {
  code: string;
  plan: string;
  exp: number;
  iat: number;
}

const KEYS = { license: 'kalara:license', trial: 'kalara:trial', pending: 'kalara:pending' };

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* stockage indisponible */
  }
}

// L'essai démarre au premier lancement.
let trialStart = Number(read(KEYS.trial));
if (!trialStart) {
  trialStart = Date.now();
  write(KEYS.trial, String(trialStart));
}

/** Horloge qui avance chaque minute (pour l'expiration de l'essai ou du pass). */
const now = signal(Date.now());
setInterval(() => (now.value = Date.now()), 60_000);

export const license = signal<License | null>(null);
export const trialEndsAt = trialStart + TRIAL_DAYS * DAY;

export const premium = computed(() => !MONETIZED || (license.value?.exp ?? 0) > now.value || trialEndsAt > now.value);
export const onTrial = computed(() => MONETIZED && !((license.value?.exp ?? 0) > now.value) && trialEndsAt > now.value);
export const daysLeft = computed(() => {
  const end = Math.max(license.value?.exp ?? 0, trialEndsAt);
  return Math.max(0, Math.ceil((end - now.value) / DAY));
});

export function canUseVoice(key: string) {
  return premium.value || FREE_VOICES.has(key);
}

export function canAddDocuments(currentCount: number, adding = 1) {
  return premium.value || currentCount + adding <= FREE_DOC_LIMIT;
}

// ——— Vérification des licences ———

const b64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const b64url = (s: string) => b64(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));

let keyPromise: Promise<CryptoKey> | null = null;
async function verifyLicense(token: string): Promise<License | null> {
  try {
    const [data, sig] = token.split('.');
    if (!data || !sig) return null;
    keyPromise ??= crypto.subtle.importKey('spki', b64(LICENSE_PUBLIC_KEY), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, await keyPromise, b64url(sig), new TextEncoder().encode(data));
    if (!ok) return null;
    const payload = JSON.parse(new TextDecoder().decode(b64url(data)));
    return payload.v === 1 && typeof payload.exp === 'number' ? (payload as License) : null;
  } catch {
    return null;
  }
}

async function installLicense(token: string): Promise<License | null> {
  const lic = await verifyLicense(token);
  if (!lic) return null;
  // On garde la licence qui expire le plus tard (cas d'une restauration d'un ancien code).
  if (!license.value || lic.exp >= license.value.exp) {
    license.value = lic;
    write(KEYS.license, token);
  }
  return lic;
}

/** Chargement de la licence enregistrée (au démarrage). */
export const ready = (async () => {
  const token = read(KEYS.license);
  if (token) await installLicense(token);
})();

// ——— Paiement ———

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  if (!API) throw new Error('Le paiement n’est pas encore activé sur cette version.');
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) } });
  } catch {
    throw new Error('Connexion impossible. Vérifiez votre accès à Internet.');
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Erreur ${res.status}`);
  return body as T;
}

/** Démarre le paiement : redirige vers la page sécurisée CinetPay (MTN MoMo / Orange Money). */
export async function startCheckout(plan: Plan['id'], phone: string) {
  const { paymentUrl, transactionId } = await api<{ paymentUrl: string; transactionId: string }>('/checkout', {
    method: 'POST',
    body: JSON.stringify({ plan, phone }),
  });
  write(KEYS.pending, transactionId);
  location.href = paymentUrl;
}

export type PaymentResult = { status: 'ACTIVE'; license: License; code: string } | { status: 'REFUSED' | 'TIMEOUT' | 'UNKNOWN' };

/** Après retour de CinetPay : attend la confirmation du paiement (jusqu'à 3 minutes). */
export async function waitForPayment(tx: string, signal?: AbortSignal): Promise<PaymentResult> {
  const deadline = Date.now() + 3 * 60_000;
  while (Date.now() < deadline && !signal?.aborted) {
    try {
      const r = await api<{ status: string; license?: string; code?: string }>(`/license/${encodeURIComponent(tx)}`);
      if (r.status === 'ACTIVE' && r.license) {
        const lic = await installLicense(r.license);
        write(KEYS.pending, null);
        if (lic) return { status: 'ACTIVE', license: lic, code: r.code ?? lic.code };
        return { status: 'UNKNOWN' };
      }
      if (r.status === 'REFUSED' || r.status === 'UNKNOWN') {
        write(KEYS.pending, null);
        return { status: r.status };
      }
    } catch {
      /* réseau instable : on réessaie */
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  return { status: 'TIMEOUT' };
}

/** Transaction à vérifier : retour de CinetPay (?payment=…) ou paiement resté en attente. */
export function pendingPayment(): string | null {
  const fromUrl = new URLSearchParams(location.search).get('payment');
  return fromUrl || read(KEYS.pending);
}

export function clearPendingPayment() {
  write(KEYS.pending, null);
}

/** Restauration sur un autre appareil à partir du code KAL-XXXX-XXXX. */
export async function restoreCode(code: string): Promise<License> {
  const r = await api<{ status: string; license?: string; expiresAt?: string }>('/restore', { method: 'POST', body: JSON.stringify({ code }) });
  if (r.status === 'ACTIVE' && r.license) {
    const lic = await installLicense(r.license);
    if (lic) return lic;
  }
  if (r.status === 'EXPIRED') {
    throw new Error(`Ce pass a expiré le ${new Date(r.expiresAt!).toLocaleDateString('fr-FR')}. Rachetez un pass avec le même numéro pour le prolonger.`);
  }
  throw new Error('Code inconnu. Vérifiez-le (format KAL-XXXX-XXXX).');
}

export function formatPrice(n: number) {
  // Espace insécable classique : l'espace fine n'est pas toujours visible.
  return `${n.toLocaleString('fr-FR').replace(/\u202f/g, '\u00a0')}\u00a0FCFA`;
}
