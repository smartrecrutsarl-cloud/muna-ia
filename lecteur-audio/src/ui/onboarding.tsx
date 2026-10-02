import { useState } from 'preact/hooks';
import { ArrowRight, AudioLines, FileText, ShieldCheck, WifiOff } from 'lucide-preact';
import { saveSettings } from '../settings';
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
            <em>en voix naturelle.</em>
          </h1>
          <p class="lead">Muna Audio transforme vos PDF, documents Word et livres EPUB en livres audio, avec des voix de narration réalistes.</p>
          <ul class="ob-points">
            <li>
              <AudioLines size={20} /> 12 narrateurs en français et en anglais
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
          <p class="lead">Écoutez les extraits avec ▶, puis touchez la voix qui vous plaît. Elle se télécharge une seule fois (≈ 60 Mo).</p>
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
          <p class="lead">PDF, Word (.docx) ou EPUB. Vous pouvez aussi partager un fichier depuis WhatsApp ou vos téléchargements vers Muna Audio.</p>
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
