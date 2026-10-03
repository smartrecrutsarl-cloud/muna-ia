import { useMemo, useState } from 'preact/hooks';
import { Bookmark, Check, Headphones, Moon, ShieldCheck, Sun, Trash2 } from 'lucide-preact';
import { docs } from '../db';
import { chapterProgress, estimate, player } from '../player';
import { saveSettings, type Theme } from '../settings';
import { Segmented, Sheet } from './common';
import { duration, fold } from './format';
import { SPEEDS } from './player-ui';
import { chaptersTab, closeSheet, usePlayer, useSettings } from './store';
import { StorageInfo, VoicePicker } from './voices';
import { SubscriptionCard } from './premium-ui';
import { MONETIZED } from '../premium';

export function ChaptersSheet() {
  usePlayer();
  const settings = useSettings();
  const doc = player.doc;
  const [, force] = useState(0);
  if (!doc) return null;
  const marks = doc.bookmarks ?? [];
  return (
    <Sheet title={doc.title}>
      <Segmented
        value={chaptersTab.value}
        onChange={(v) => (chaptersTab.value = v)}
        options={[
          { value: 'chapters', label: `Chapitres (${doc.chapters.length})` },
          { value: 'bookmarks', label: `Signets (${marks.length})` },
        ]}
      />
      {chaptersTab.value === 'chapters' ? (
        <ol class="chapter-list">
          {doc.chapters.map((c, i) => {
            const p = chapterProgress(doc, i, player.pos);
            const est = estimate(doc, { chapter: i, segment: 0 });
            const current = i === player.pos.chapter;
            return (
              <li key={i} class={current ? 'current' : p >= 1 ? 'done' : ''}>
                <button
                  onClick={() => {
                    player.seek({ chapter: i, segment: 0 }, player.playing);
                    closeSheet();
                  }}
                >
                  <span class="ch-num">{p >= 1 && !current ? <Check size={14} /> : i + 1}</span>
                  <span class="ch-title">{c.title}</span>
                  <span class="ch-dur">{duration(est.chapterTotal / settings.rate)}</span>
                </button>
                {current && <span class="ch-bar" style={{ width: `${p * 100}%` }} />}
              </li>
            );
          })}
        </ol>
      ) : marks.length ? (
        <ul class="bookmark-list">
          {marks
            .slice()
            .sort((a, b) => a.chapter - b.chapter || a.segment - b.segment)
            .map((b) => (
              <li key={b.createdAt}>
                <button
                  class="grow"
                  onClick={() => {
                    player.seek({ chapter: b.chapter, segment: b.segment }, true);
                    closeSheet();
                  }}
                >
                  <small>{doc.chapters[b.chapter]?.title}</small>
                  <span>« {b.excerpt}… »</span>
                </button>
                <button
                  class="icon-btn"
                  aria-label="Supprimer le signet"
                  onClick={async () => {
                    doc.bookmarks = marks.filter((x) => x !== b);
                    await docs.put(doc);
                    force((n) => n + 1);
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
        </ul>
      ) : (
        <p class="placeholder">
          <Bookmark size={22} />
          Aucun signet. Pendant l'écoute, touchez « Signet » pour retrouver un passage plus tard.
        </p>
      )}
    </Sheet>
  );
}

export function SearchSheet() {
  const doc = player.doc;
  const [q, setQ] = useState('');
  const results = useMemo(() => {
    const f = fold(q.trim());
    if (!doc || f.length < 2) return [];
    const out: { chapter: number; segment: number; text: string }[] = [];
    doc.chapters.forEach((c, ci) =>
      c.segments.forEach((s, si) => {
        if (out.length < 80 && fold(s).includes(f)) out.push({ chapter: ci, segment: si, text: s });
      }),
    );
    return out;
  }, [q, doc]);
  if (!doc) return null;
  return (
    <Sheet title="Rechercher dans le document">
      <input class="input" type="search" autoFocus placeholder="Un mot, une expression…" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} />
      <ul class="search-results">
        {results.map((r) => (
          <li key={`${r.chapter}-${r.segment}`}>
            <button
              onClick={() => {
                player.seek({ chapter: r.chapter, segment: r.segment }, true);
                closeSheet();
              }}
            >
              <small>{doc.chapters[r.chapter].title}</small>
              <span>{highlight(r.text, q.trim())}</span>
            </button>
          </li>
        ))}
      </ul>
      {q.trim().length >= 2 && !results.length && <p class="placeholder">Aucun résultat.</p>}
    </Sheet>
  );
}

function highlight(text: string, q: string) {
  const i = fold(text).indexOf(fold(q));
  if (i < 0) return text;
  const start = Math.max(0, i - 60);
  return (
    <>
      {start > 0 && '…'}
      {text.slice(start, i)}
      <mark>{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length, i + q.length + 100)}
      {i + q.length + 100 < text.length && '…'}
    </>
  );
}

const THEMES: { value: Theme; label: string; swatch: string }[] = [
  { value: 'auto', label: 'Auto', swatch: 'linear-gradient(135deg,#F6F3EE 50%,#14161A 50%)' },
  { value: 'light', label: 'Clair', swatch: '#F6F3EE' },
  { value: 'sepia', label: 'Sépia', swatch: '#F1E6CF' },
  { value: 'dark', label: 'Sombre', swatch: '#14161A' },
];

export function TextSheet() {
  const settings = useSettings();
  return (
    <Sheet title="Affichage">
      <div class="field-label">Thème</div>
      <div class="themes">
        {THEMES.map((t) => (
          <button key={t.value} class={`theme ${settings.theme === t.value ? 'active' : ''}`} onClick={() => saveSettings({ theme: t.value })}>
            <span class="swatch" style={{ background: t.swatch }} />
            {t.label}
          </button>
        ))}
      </div>
      <div class="field-label">Taille du texte</div>
      <div class="slider-row">
        <span class="small-a">A</span>
        <input type="range" min={0.85} max={1.5} step={0.05} value={settings.fontScale} onInput={(e) => saveSettings({ fontScale: Number((e.target as HTMLInputElement).value) })} />
        <span class="big-a">A</span>
      </div>
      <label class="toggle">
        <input type="checkbox" checked={settings.follow} onChange={(e) => saveSettings({ follow: (e.target as HTMLInputElement).checked })} />
        <span>Faire défiler le texte pendant la lecture</span>
      </label>
    </Sheet>
  );
}

export function SpeedSheet() {
  const settings = useSettings();
  const set = (rate: number) => {
    saveSettings({ rate: Math.round(rate * 100) / 100 });
    player.rateChanged();
  };
  return (
    <Sheet title="Vitesse de lecture">
      <div class="speed-value">{settings.rate.toLocaleString('fr-FR')}×</div>
      <input class="speed-range" type="range" min={0.5} max={2.5} step={0.05} value={settings.rate} onChange={(e) => set(Number((e.target as HTMLInputElement).value))} />
      <div class="chips-row">
        {SPEEDS.map((s) => (
          <button key={s} class={`chip ${settings.rate === s ? 'on' : ''}`} onClick={() => set(s)}>
            {s.toLocaleString('fr-FR')}×
          </button>
        ))}
      </div>
      <p class="muted small">La hauteur de la voix est conservée quelle que soit la vitesse.</p>
    </Sheet>
  );
}

export function SleepSheet() {
  usePlayer();
  const set = (minutes: number | 'chapter' | 'off') => {
    if (minutes === 'off') player.setSleep({ kind: 'off' });
    else if (minutes === 'chapter') player.setSleep({ kind: 'chapter' });
    else player.setSleep({ kind: 'time', endsAt: Date.now() + minutes * 60_000 });
    closeSheet();
  };
  return (
    <Sheet title="Minuterie de sommeil">
      <p class="muted">La lecture s'arrête en douceur, avec un fondu du son.</p>
      <div class="option-list">
        {[5, 10, 15, 30, 45, 60].map((m) => (
          <button key={m} onClick={() => set(m)}>
            <Moon size={18} /> {m} minutes
          </button>
        ))}
        <button onClick={() => set('chapter')}>
          <Moon size={18} /> À la fin du chapitre
        </button>
        {player.sleep.kind !== 'off' && (
          <button class="danger" onClick={() => set('off')}>
            Désactiver la minuterie
          </button>
        )}
      </div>
    </Sheet>
  );
}

export function SettingsSheet() {
  const settings = useSettings();
  return (
    <Sheet title="Réglages" class="settings-sheet">
      {MONETIZED && (
        <section class="settings-section">
          <h3>Mon abonnement</h3>
          <SubscriptionCard />
        </section>
      )}

      <section class="settings-section">
        <h3>Voix de narration</h3>
        <p class="muted small">
          Voix neuronales naturelles. Téléchargées une fois (≈ 60 Mo), elles fonctionnent ensuite <strong>sans Internet</strong>. {MONETIZED && 'Jessica et Pierre sont gratuites. '}Touchez ▶ pour écouter un extrait.
        </p>
        <VoicePicker />
        <label class="toggle">
          <input
            type="checkbox"
            checked={settings.engine === 'system'}
            onChange={(e) => {
              saveSettings({ engine: (e.target as HTMLInputElement).checked ? 'system' : 'piper' });
              player.settingsChanged();
            }}
          />
          <span>Utiliser plutôt les voix intégrées à l'appareil</span>
        </label>
      </section>

      <section class="settings-section">
        <h3>Affichage</h3>
        <Segmented
          value={settings.theme}
          onChange={(theme) => saveSettings({ theme })}
          options={[
            { value: 'auto', label: 'Auto' },
            { value: 'light', label: <><Sun size={14} /> Clair</> },
            { value: 'sepia', label: 'Sépia' },
            { value: 'dark', label: <><Moon size={14} /> Sombre</> },
          ]}
        />
      </section>

      <section class="settings-section">
        <h3>Stockage</h3>
        <StorageInfo />
      </section>

      <section class="settings-section about">
        <p>
          <ShieldCheck size={16} /> Vos documents ne quittent jamais votre appareil : l'analyse et la voix sont produites localement.
        </p>
        <p>
          <Headphones size={16} /> Kalara · version {__APP_VERSION__} · une application Muna IA
        </p>
      </section>
    </Sheet>
  );
}
