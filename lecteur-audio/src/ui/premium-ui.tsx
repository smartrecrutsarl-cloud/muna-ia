import { signal } from '@preact/signals';
import { useState } from 'preact/hooks';
import { Check, Copy, Crown, KeyRound, LoaderCircle, ShieldCheck, Sparkles, X } from 'lucide-preact';
import {
  API,
  MONETIZED,
  clearPendingPayment,
  daysLeft,
  formatPrice,
  license,
  onTrial,
  pendingPayment,
  PLANS,
  premium,
  restoreCode,
  startCheckout,
  waitForPayment,
  type Plan,
} from '../premium';
import { player } from '../player';
import { saveSettings } from '../settings';
import { Sheet } from './common';
import { closeSheet, openSheet, paywallReason, showPaywall, toast } from './store';

type PaymentState =
  | { phase: 'checking' }
  | { phase: 'success'; code: string; exp: number }
  | { phase: 'failed' }
  | { phase: 'timeout' };

/** État du paiement en cours de confirmation (retour depuis CinetPay). */
const payment = signal<PaymentState | null>(null);

const longDate = (t: number) => new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

/** À l'ouverture de l'application : vérifie un paiement revenant de CinetPay ou resté en attente. */
export async function checkPendingPayment() {
  const tx = pendingPayment();
  if (!tx) return;
  if (location.search.includes('payment=')) history.replaceState(null, '', location.pathname);
  payment.value = { phase: 'checking' };
  openSheet('premium');
  const r = await waitForPayment(tx);
  if (r.status === 'ACTIVE') payment.value = { phase: 'success', code: r.code, exp: r.license.exp };
  else if (r.status === 'TIMEOUT') payment.value = { phase: 'timeout' };
  else {
    clearPendingPayment();
    payment.value = { phase: 'failed' };
  }
}

function PaymentStatus({ state }: { state: PaymentState }) {
  if (state.phase === 'checking') {
    return (
      <div class="pay-status">
        <LoaderCircle size={44} class="spin" />
        <h3>Confirmation de votre paiement…</h3>
        <p class="muted">Validez la demande reçue sur votre téléphone (MTN MoMo ou Orange Money) si ce n'est pas déjà fait.</p>
      </div>
    );
  }
  if (state.phase === 'success') {
    return (
      <div class="pay-status">
        <div class="pay-ok">
          <Crown size={34} />
        </div>
        <h3>Bienvenue dans Kalara Premium</h3>
        <p class="muted">Les 12 narrateurs et la bibliothèque illimitée sont disponibles jusqu'au {longDate(state.exp)}.</p>
        <CodeBox code={state.code} />
        <p class="small muted">Gardez ce code : il permet de retrouver votre abonnement sur un autre téléphone.</p>
        <button
          class="btn primary big"
          onClick={() => {
            payment.value = null;
            closeSheet();
          }}
        >
          Commencer à écouter
        </button>
      </div>
    );
  }
  return (
    <div class="pay-status">
      <div class="pay-ko">
        <X size={30} />
      </div>
      <h3>{state.phase === 'timeout' ? 'Paiement en cours de confirmation' : 'Paiement non abouti'}</h3>
      <p class="muted">
        {state.phase === 'timeout'
          ? 'La confirmation de l’opérateur prend plus de temps que prévu. Kalara vérifiera de nouveau à la prochaine ouverture ; si vous avez été débité, votre pass sera activé automatiquement.'
          : 'Aucun montant n’a été prélevé. Vous pouvez réessayer quand vous voulez.'}
      </p>
      <button class="btn primary big" onClick={() => (payment.value = null)}>
        {state.phase === 'timeout' ? 'Compris' : 'Réessayer'}
      </button>
    </div>
  );
}

function CodeBox({ code }: { code: string }) {
  return (
    <button
      class="code-box"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(code);
          toast('Code copié', 'ok');
        } catch {
          /* presse-papiers indisponible */
        }
      }}
      aria-label="Copier le code"
    >
      <KeyRound size={18} />
      <span>{code}</span>
      <Copy size={16} />
    </button>
  );
}

const HEADLINES: Record<string, [string, string]> = {
  voice: ['Cette voix fait partie de Kalara Premium', 'Débloquez les 12 narrateurs et toutes les langues.'],
  docs: ['Votre bibliothèque gratuite est pleine', 'La version gratuite contient jusqu’à 3 documents. Passez à Premium pour en ajouter autant que vous voulez.'],
  manual: ['Kalara Premium', 'Tous les narrateurs, une bibliothèque illimitée.'],
};

export function PremiumSheet() {
  const [plan, setPlan] = useState<Plan['id']>('month');
  const [phone, setPhone] = useState(() => localStorage.getItem('kalara:phone') ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [restoring, setRestoring] = useState(false);
  const [code, setCode] = useState('');

  if (payment.value) {
    return (
      <Sheet title="Kalara Premium" onClose={() => payment.value?.phase !== 'checking' && closeSheet()}>
        <PaymentStatus state={payment.value} />
      </Sheet>
    );
  }

  const selected = PLANS.find((p) => p.id === plan)!;
  const active = license.value && license.value.exp > Date.now();
  const [title, subtitle] = active
    ? ['Prolonger Kalara Premium', `Votre pass court jusqu'au ${longDate(license.value!.exp)}. Les jours achetés s'ajoutent à la suite.`]
    : HEADLINES[paywallReason.value];
  const digits = phone.replace(/\D/g, '');
  const phoneOk = /^6\d{8}$/.test(digits) || /^2376\d{8}$/.test(digits);

  const pay = async () => {
    setError('');
    if (!phoneOk) {
      setError('Saisissez votre numéro MTN ou Orange à 9 chiffres (ex. 6 90 00 00 00).');
      return;
    }
    setBusy(true);
    try {
      localStorage.setItem('kalara:phone', phone);
      await startCheckout(plan, digits);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  const restore = async () => {
    setError('');
    setBusy(true);
    try {
      const lic = await restoreCode(code);
      toast(`Kalara Premium restauré jusqu'au ${longDate(lic.exp)}`, 'ok');
      closeSheet();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title="" class="premium-sheet">
      <div class="pw-hero">
        <span class="pw-icon">
          <Sparkles size={26} />
        </span>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>

      <ul class="pw-benefits">
        <li>
          <Check size={18} /> 12 narrateurs français et anglais + 120 voix dans 30 langues
        </li>
        <li>
          <Check size={18} /> Bibliothèque illimitée : PDF, Word, EPUB
        </li>
        <li>
          <Check size={18} /> Toutes les nouvelles voix incluses
        </li>
        <li>
          <Check size={18} /> Toujours hors ligne, sans publicité, vos fichiers restent sur votre téléphone
        </li>
      </ul>

      <div class="plans" role="radiogroup" aria-label="Choisissez votre pass">
        {PLANS.map((p) => (
          <button key={p.id} role="radio" aria-checked={plan === p.id} class={`plan ${plan === p.id ? 'active' : ''}`} onClick={() => setPlan(p.id)}>
            {p.badge && <span class="plan-badge">{p.badge}</span>}
            <span class="plan-label">{p.label}</span>
            <span class="plan-price">{formatPrice(p.price)}</span>
            <span class="plan-sub">{p.perMonth ?? (p.id === 'week' ? 'Idéal pour essayer' : 'Sans engagement')}</span>
          </button>
        ))}
      </div>

      <label class="field">
        <span class="field-label-inline">Numéro Mobile Money (MTN ou Orange)</span>
        <span class="phone">
          <span class="phone-prefix">+237</span>
          <input
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            placeholder="6 90 00 00 00"
            value={phone}
            onInput={(e) => setPhone((e.target as HTMLInputElement).value)}
          />
        </span>
      </label>

      {error && <p class="pw-error">{error}</p>}

      <button class="btn primary big pw-cta" disabled={busy || !API} onClick={pay}>
        {busy ? <LoaderCircle size={20} class="spin" /> : `Payer ${formatPrice(selected.price)}`}
      </button>
      {!API && <p class="pw-error">Le paiement sera disponible dans la prochaine mise à jour de l'application.</p>}

      <p class="pw-secure">
        <ShieldCheck size={15} /> Paiement sécurisé par CinetPay · MTN MoMo · Orange Money. Pass prépayé, jamais renouvelé automatiquement.
      </p>

      {paywallReason.value === 'voice' && !premium.value && (
        <button
          class="btn ghost"
          onClick={() => {
            saveSettings({ piperVoice: 'fr-jessica', engine: 'piper' });
            player.settingsChanged();
            closeSheet();
          }}
        >
          Continuer gratuitement avec Jessica
        </button>
      )}

      {restoring ? (
        <div class="restore">
          <input class="input" placeholder="KAL-XXXX-XXXX" value={code} autoCapitalize="characters" onInput={(e) => setCode((e.target as HTMLInputElement).value)} />
          <button class="btn" disabled={busy || code.replace(/\W/g, '').length < 8} onClick={restore}>
            Valider
          </button>
        </div>
      ) : (
        <button class="btn ghost small" onClick={() => setRestoring(true)}>
          <KeyRound size={15} /> J'ai déjà un code Premium
        </button>
      )}
    </Sheet>
  );
}

/** Carte « Mon abonnement » des réglages. */
export function SubscriptionCard() {
  const lic = license.value;
  const active = lic && lic.exp > Date.now();
  return (
    <div class={`sub-card ${premium.value ? 'is-premium' : ''}`}>
      <div class="sub-head">
        <Crown size={20} />
        <div class="grow">
          <strong>{active ? 'Kalara Premium' : onTrial.value ? 'Essai Premium' : 'Version gratuite'}</strong>
          <small>
            {active
              ? `Actif jusqu'au ${longDate(lic!.exp)}`
              : onTrial.value
                ? `${daysLeft.value} jour${daysLeft.value > 1 ? 's' : ''} restant${daysLeft.value > 1 ? 's' : ''} · toutes les voix incluses`
                : '2 voix (Jessica, Pierre) · 3 documents'}
          </small>
        </div>
      </div>
      {active && <CodeBox code={lic!.code} />}
      <button class="btn primary" onClick={() => showPaywall('manual')}>
        {active ? 'Prolonger mon pass' : 'Passer à Premium — dès 500 FCFA'}
      </button>
    </div>
  );
}

/** Bandeau d'accueil : fin d'essai proche, pass bientôt expiré ou version gratuite. */
export function PremiumBanner() {
  if (!MONETIZED) return null;
  const lic = license.value;
  const active = lic && lic.exp > Date.now();
  let text = '';
  if (active && daysLeft.value <= 2) text = `Votre pass Premium expire dans ${daysLeft.value} jour${daysLeft.value > 1 ? 's' : ''}.`;
  else if (onTrial.value && daysLeft.value <= 3) text = `Votre essai Premium se termine dans ${daysLeft.value} jour${daysLeft.value > 1 ? 's' : ''}.`;
  else if (!premium.value) text = 'Débloquez les 12 narrateurs et une bibliothèque illimitée.';
  if (!text) return null;
  return (
    <button class="pw-banner" onClick={() => showPaywall('manual')}>
      <Sparkles size={18} />
      <span class="grow">{text}</span>
      <strong>{active ? 'Prolonger' : 'Dès 500 FCFA'}</strong>
    </button>
  );
}

/** Pastille d'état dans la barre du haut. */
export function PremiumPill() {
  if (!MONETIZED) return null;
  if (license.value && license.value.exp > Date.now()) {
    return (
      <span class="pill premium-pill">
        <Crown size={13} /> Premium
      </span>
    );
  }
  if (onTrial.value) {
    return (
      <button class="pill premium-pill" onClick={() => showPaywall('manual')}>
        <Sparkles size={13} /> Essai · {daysLeft.value} j
      </button>
    );
  }
  return null;
}
