import { useEffect, useMemo, useState } from 'preact/hooks';
import { Check, Download, Pause, Play, Trash2 } from 'lucide-preact';
import { ALL_VOICES, deleteModel, downloadModel, downloadProgress, downloadedModels, resolveVoice } from '../engines/piper';
import { player } from '../player';
import { saveSettings } from '../settings';
import { CATALOG, type CatalogVoice } from '../voices';
import { ProgressRing, Segmented } from './common';
import { fold } from './format';
import { online, toast, useDownloads, useSettings } from './store';

// Un seul extrait joué à la fois, dans toute l'application.
const sampleAudio = new Audio();
let playingSample = '';
const sampleListeners = new Set<() => void>();
sampleAudio.onended = sampleAudio.onpause = () => {
  playingSample = '';
  sampleListeners.forEach((f) => f());
};

function useSample() {
  const [, force] = useState(0);
  useEffect(() => {
    const f = () => force((n) => n + 1);
    sampleListeners.add(f);
    return () => {
      sampleListeners.delete(f);
    };
  }, []);
  return {
    playing: playingSample,
    toggle(id: string) {
      if (playingSample === id) {
        sampleAudio.pause();
        return;
      }
      if (player.playing) player.pause();
      sampleAudio.src = `samples/${id}.mp3`;
      playingSample = id;
      void sampleAudio.play();
      sampleListeners.forEach((f) => f());
    },
  };
}

function useDownloaded() {
  const [have, setHave] = useState<Set<string>>(new Set());
  const refresh = () => downloadedModels().then(setHave);
  useEffect(() => {
    void refresh();
  }, [downloadProgress.size]);
  return { have, refresh };
}

const GRADIENTS = ['#C8553D,#E9A23B', '#3D6C8C,#7FB2C9', '#6B4C9A,#B98ED6', '#2E7D5B,#8CC9A2', '#9A3B53,#E28A9F', '#3E4A61,#8E9BB5'];

function Avatar({ v }: { v: CatalogVoice }) {
  const i = CATALOG.indexOf(v) % GRADIENTS.length;
  const [a, b] = GRADIENTS[i].split(',');
  return (
    <span class="avatar" style={{ background: `linear-gradient(135deg, ${a}, ${b})` }}>
      {v.name.charAt(0)}
    </span>
  );
}

async function choose(key: string, model: string, have: Set<string>, refresh: () => void) {
  saveSettings({ piperVoice: key, engine: 'piper' });
  player.settingsChanged();
  if (!have.has(model)) {
    try {
      await downloadModel(model);
      toast(`Voix ${resolveVoice(key).label} prête, même hors ligne`, 'ok');
    } catch (err) {
      toast(err instanceof Error ? err.message : String(err), 'error');
    }
    refresh();
  }
}

export function VoicePicker({ compact = false }: { compact?: boolean }) {
  const settings = useSettings();
  useDownloads();
  const sample = useSample();
  const { have, refresh } = useDownloaded();
  const current = resolveVoice(settings.piperVoice);
  const [lang, setLang] = useState<'fr' | 'en'>(current.model.startsWith('en') ? 'en' : 'fr');

  return (
    <div class="voice-picker">
      <Segmented
        value={lang}
        onChange={setLang}
        options={[
          { value: 'fr', label: 'Français' },
          { value: 'en', label: 'English' },
        ]}
      />
      <ul class="voice-list">
        {CATALOG.filter((v) => v.lang === lang).map((v) => {
          const selected = settings.engine === 'piper' && settings.piperVoice === v.id;
          const progress = downloadProgress.get(v.model);
          const ready = have.has(v.model);
          return (
            <li key={v.id} class={`voice-card ${selected ? 'selected' : ''}`} onClick={() => choose(v.id, v.model, have, refresh)}>
              <Avatar v={v} />
              <div class="voice-info">
                <div class="voice-name">
                  {v.name}
                  <span class="voice-tag">{v.gender === 'f' ? 'Féminine' : 'Masculine'}</span>
                </div>
                <div class="voice-meta">{v.accent}</div>
                {!compact && <div class="voice-desc">{v.description}</div>}
              </div>
              <div class="voice-actions" onClick={(e) => e.stopPropagation()}>
                <button class="icon-btn soft" aria-label={`Écouter ${v.name}`} onClick={() => sample.toggle(v.id)}>
                  {sample.playing === v.id ? <Pause size={18} /> : <Play size={18} />}
                </button>
                {progress !== undefined ? (
                  <ProgressRing value={progress} size={36}>
                    <span class="ring-pct">{Math.round(progress * 100)}</span>
                  </ProgressRing>
                ) : selected && ready ? (
                  <span class="check-badge" aria-label="Voix choisie">
                    <Check size={18} />
                  </span>
                ) : ready ? (
                  <span class="dl-state" title="Disponible hors ligne">
                    <Check size={16} />
                  </span>
                ) : (
                  <button class="icon-btn soft" disabled={!online.value} aria-label={`Télécharger ${v.name} (${v.sizeMb} Mo)`} onClick={() => choose(v.id, v.model, have, refresh)}>
                    <Download size={18} />
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {!compact && <MoreVoices have={have} refresh={refresh} />}
    </div>
  );
}

function MoreVoices({ have, refresh }: { have: Set<string>; refresh: () => void }) {
  const settings = useSettings();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const f = fold(q.trim());
    return ALL_VOICES.filter((v) => !f || fold(`${v.id} ${v.language} ${v.name}`).includes(f)).slice(0, 40);
  }, [q]);
  return (
    <details class="more-voices" open={open} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
      <summary>Plus de 120 autres voix, dans une trentaine de langues</summary>
      {open && (
        <>
          <input class="input" type="search" placeholder="Rechercher : español, deutsch, arabic…" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} />
          <ul class="simple-list">
            {list.map((v) => {
              const progress = downloadProgress.get(v.id);
              const selected = settings.piperVoice === v.id;
              return (
                <li key={v.id} class={selected ? 'selected' : ''}>
                  <div class="grow">
                    <strong class="cap">{v.name}</strong>
                    <small>
                      {v.language} · {v.quality} · {v.sizeMb} Mo
                    </small>
                  </div>
                  {progress !== undefined ? (
                    <span class="muted small">{Math.round(progress * 100)} %</span>
                  ) : (
                    <>
                      <button class="btn small" onClick={() => choose(v.id, v.id, have, refresh)}>
                        {selected ? 'Choisie' : have.has(v.id) ? 'Choisir' : 'Télécharger'}
                      </button>
                      {have.has(v.id) && !selected && (
                        <button
                          class="icon-btn"
                          aria-label="Supprimer"
                          onClick={async () => {
                            await deleteModel(v.id);
                            refresh();
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </details>
  );
}

export function StorageInfo() {
  const settings = useSettings();
  useDownloads();
  const { have, refresh } = useDownloaded();
  const [usage, setUsage] = useState('');
  useEffect(() => {
    navigator.storage?.estimate?.().then((e) => e.usage !== undefined && setUsage(`${Math.round(e.usage / 1e6)} Mo utilisés`));
  }, [have.size]);
  const current = resolveVoice(settings.piperVoice).model;
  const removable = [...have].filter((m) => m !== current);
  return (
    <div class="storage">
      <p>
        {have.size} voix sur l'appareil{usage && ` · ${usage}`}
      </p>
      {removable.length > 0 && (
        <button
          class="btn"
          onClick={async () => {
            if (!confirm(`Supprimer ${removable.length} voix non utilisée(s) ? Vous pourrez les retélécharger.`)) return;
            for (const m of removable) await deleteModel(m);
            refresh();
            toast('Espace libéré', 'ok');
          }}
        >
          <Trash2 size={16} /> Libérer de l'espace
        </button>
      )}
    </div>
  );
}
