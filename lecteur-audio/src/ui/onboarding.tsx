import { useState } from 'preact/hooks';
import { ArrowRight, AudioLines, FileText, ShieldCheck, WifiOff } from 'lucide-preact';
import { saveSettings } from '../settings';
import { MONETIZED } from '../premium';
import { Logo, pickFiles } from './common';
import { openBook } from './store';
import { VoicePicker } from './voices';

export function Onboarding() {
  const [step, setStep] = useState(0);
  const finish = (id?: string | null) => {
    saveSettings({ onboarded: true });
    if (id) openBook(id);
  };
  return (
    <div class="onboarding">
      <div class="dots" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <span key={i} class={i === step ? 'on' : ''} />
        ))}
      </div>

      {step === 0 && (
        <div class="ob-step ob-hero">
          <Logo size={72} />
          <h1>
            Vos documents,
            <br />
            <em>racontés.</em>
          </h1>
          <p class="lead">Kalara transforme vos PDF, documents Word et livres EPUB en livres audio, lus par des voix de narration naturelles.</p>
          <ul class="ob-points">
            <li>
              <AudioLines size={20} /> 12 narrateurs en français et en anglais{MONETIZED && ' — 7 jours de Premium offerts'}
            </li>
            <li>
              <WifiOff size={20} /> Écoute 100 % hors ligne, même en mode avion
            </li>
            <li>
              <ShieldCheck size={20} /> Privé : rien ne quitte votre téléphone
            </li>
          </ul>
          <button class="btn primary big" onClick={() => setStep(1)}>
            Commencer <ArrowRight size={20} />
          </button>
        </div>
      )}

      {step === 1 && (
        <div class="ob-step">
          <h2>Choisissez votre narrateur</h2>
          <p class="lead">
            Écoutez les extraits avec ▶, puis touchez la voix qui vous plaît.{' '}
            {MONETIZED ? 'Jessica et Pierre sont gratuites pour toujours ; les autres sont incluses pendant votre essai.' : 'Elle se télécharge une seule fois (≈ 60 Mo).'}
          </p>
          <VoicePicker compact />
          <button class="btn primary big" onClick={() => setStep(2)}>
            Continuer <ArrowRight size={20} />
          </button>
        </div>
      )}

      {step === 2 && (
        <div class="ob-step ob-hero">
          <div class="ob-icon">
            <FileText size={40} />
          </div>
          <h2>Ajoutez votre premier document</h2>
          <p class="lead">PDF, Word (.docx) ou EPUB. Vous pouvez aussi partager un fichier depuis WhatsApp ou vos téléchargements vers Kalara.</p>
          <button class="btn primary big" onClick={() => pickFiles((id) => finish(id))}>
            Choisir un fichier
          </button>
          <button class="btn ghost" onClick={() => finish()}>
            Plus tard
          </button>
        </div>
      )}
    </div>
  );
}
