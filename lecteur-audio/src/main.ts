import './style.css';
import { registerSW } from 'virtual:pwa-register';
import { audioCache, docs, type LibraryDoc } from './db';
import { ELEVEN_MODELS, elevenSynthesize, elevenVoices, type ElevenVoice } from './engines/elevenlabs';
import {
  RECOMMENDED,
  deleteVoice,
  downloadVoice,
  downloadedVoices,
  piperSynthesize,
  piperVoices,
} from './engines/piper';
import { charCount, exportAudio, prepareOffline, preparedRatio } from './offline';
import { parseFile } from './parsers';
import { Player, cachePrefix } from './player';
import { saveSettings, settings, type EngineId } from './settings';

registerSW({ immediate: true });
navigator.storage?.persist?.().catch(() => {});

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const player = new Player();

// ---------- Utilitaires ----------

function show(el: HTMLElement, text: string, isError = false) {
  el.hidden = !text;
  el.textContent = text;
  el.classList.toggle('error', isError);
}

function errorText(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

function updateNet() {
  const net = $('net');
  net.textContent = navigator.onLine ? 'En ligne' : 'Hors ligne';
  net.classList.toggle('offline', !navigator.onLine);
}
addEventListener('online', updateNet);
addEventListener('offline', updateNet);
updateNet();

// ---------- Bibliothèque ----------

async function renderLibrary() {
  const list = (await docs.all()).sort((a, b) => b.addedAt - a.addedAt);
  const ul = $('docs');
  ul.replaceChildren();
  $('empty').hidden = list.length > 0;
  for (const doc of list) {
    const done = doc.chapters
      .slice(0, doc.position.chapter)
      .reduce((n, c) => n + c.segments.length, doc.position.segment);
    const pct = Math.round((done / doc.totalSegments) * 100);
    const li = document.createElement('li');
    li.className = 'doc';
    li.innerHTML = `
      <button class="doc-open">
        <span class="badge">${doc.format.toUpperCase()}</span>
        <span class="doc-title"></span>
        <span class="muted small">${doc.chapters.length} chapitre(s) · ${pct} % écouté</span>
        <span class="bar"><span style="width:${pct}%"></span></span>
      </button>
      <button class="icon-btn doc-delete" aria-label="Supprimer">🗑</button>`;
    li.querySelector('.doc-title')!.textContent = doc.title;
    li.querySelector<HTMLButtonElement>('.doc-open')!.onclick = () => openDoc(doc.id);
    li.querySelector<HTMLButtonElement>('.doc-delete')!.onclick = async () => {
      if (!confirm(`Supprimer « ${doc.title} » et son audio préparé ?`)) return;
      await docs.delete(doc.id);
      await audioCache.deletePrefix(cachePrefix(doc.id));
      renderLibrary();
    };
    ul.append(li);
  }
}

async function importFiles(files: FileList | File[]) {
  const status = $('import-status');
  const results: string[] = [];
  let failed = false;
  const report = (line = '') => show(status, [...results, line].filter(Boolean).join('\n'), failed);
  for (const file of Array.from(files)) {
    try {
      report(`Analyse de « ${file.name} »…`);
      const doc = await parseFile(file, (p) => report(`Analyse de « ${file.name} »… ${Math.round(p * 100)} %`));
      await docs.put(doc);
      results.push(`✓ « ${doc.title} » ajouté (${doc.chapters.length} chapitre(s)).`);
    } catch (err) {
      failed = true;
      results.push(`✗ ${file.name} : ${errorText(err)}`);
    }
    report();
    renderLibrary();
  }
}

$<HTMLInputElement>('file').onchange = (e) => {
  const input = e.target as HTMLInputElement;
  if (input.files?.length) importFiles(input.files);
  input.value = '';
};
const drop = $('drop');
drop.ondragover = (e) => {
  e.preventDefault();
  drop.classList.add('over');
};
drop.ondragleave = () => drop.classList.remove('over');
drop.ondrop = (e) => {
  e.preventDefault();
  drop.classList.remove('over');
  if (e.dataTransfer?.files.length) importFiles(e.dataTransfer.files);
};

// ---------- Lecteur ----------

let currentDoc: LibraryDoc | null = null;
let renderedChapter = -1;

async function openDoc(id: string) {
  const doc = await docs.get(id);
  if (!doc) return;
  currentDoc = doc;
  player.load(doc);
  $('library').hidden = true;
  $('reader').hidden = false;
  $('player').hidden = false;
  $('back').hidden = false;
  $('page-title').textContent = doc.title;
  const select = $<HTMLSelectElement>('chapter');
  select.replaceChildren(
    ...doc.chapters.map((c, i) => new Option(`${i + 1}. ${c.title}`, String(i))),
  );
  renderedChapter = -1;
  show($('prepare-status'), '');
  renderReader();
  updatePrepareStatus();
  history.pushState({ doc: id }, '');
}

function closeDoc() {
  player.stop();
  currentDoc = null;
  $('library').hidden = false;
  $('reader').hidden = true;
  $('player').hidden = true;
  $('back').hidden = true;
  $('page-title').textContent = 'Lecteur Audio';
  abortPrepare?.abort();
  renderLibrary();
}

$('back').onclick = () => history.back();
addEventListener('popstate', () => currentDoc && closeDoc());

function renderReader() {
  const doc = player.doc;
  if (!doc) return;
  const { chapter, segment } = player.pos;
  const text = $('text');
  if (renderedChapter !== chapter) {
    renderedChapter = chapter;
    $<HTMLSelectElement>('chapter').value = String(chapter);
    const c = doc.chapters[chapter];
    const h = document.createElement('h2');
    h.textContent = c.title;
    text.replaceChildren(
      h,
      ...c.segments.map((s, i) => {
        const span = document.createElement('span');
        span.className = 'seg';
        span.dataset.i = String(i);
        span.textContent = s + ' ';
        return span;
      }),
    );
  }
  text.querySelector('.seg.current')?.classList.remove('current');
  const cur = text.querySelector<HTMLElement>(`.seg[data-i="${segment}"]`);
  if (cur) {
    cur.classList.add('current');
    const r = cur.getBoundingClientRect();
    if (r.top < 80 || r.bottom > innerHeight - 140) cur.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
}

$('text').onclick = (e) => {
  const seg = (e.target as HTMLElement).closest<HTMLElement>('.seg');
  if (seg) player.seek({ chapter: player.pos.chapter, segment: Number(seg.dataset.i) }, true);
};
$<HTMLSelectElement>('chapter').onchange = (e) =>
  player.seek({ chapter: Number((e.target as HTMLSelectElement).value), segment: 0 });

$('play').onclick = () => player.toggle();
$('prev').onclick = () => player.skip(-1);
$('next').onclick = () => player.skip(1);
$('prev-ch').onclick = () => player.skipChapter(-1);
$('next-ch').onclick = () => player.skipChapter(1);
const rate = $<HTMLSelectElement>('rate');
rate.value = String(settings.rate);
rate.onchange = () => {
  saveSettings({ rate: Number(rate.value) });
  player.settingsChanged();
};

addEventListener('keydown', (e) => {
  if (!currentDoc || (e.target as HTMLElement).closest('input,select,textarea,dialog')) return;
  if (e.code === 'Space') {
    e.preventDefault();
    player.toggle();
  } else if (e.code === 'ArrowRight') player.skip(1);
  else if (e.code === 'ArrowLeft') player.skip(-1);
});

function engineLabel(): string {
  if (settings.engine === 'piper') return `Piper · ${settings.piperVoice.split('-')[1] ?? ''}`;
  if (settings.engine === 'elevenlabs') return `ElevenLabs · ${elevenName(settings.elevenVoice)}`;
  return 'Voix de l’appareil';
}

function refreshPlayerUI() {
  const doc = player.doc;
  if (!doc) return;
  $('play').textContent = player.playing ? '❚❚' : '▶';
  $('play').setAttribute('aria-label', player.playing ? 'Pause' : 'Lecture');
  $('now').textContent = `${doc.chapters[player.pos.chapter].title} — ${player.pos.segment + 1}/${doc.chapters[player.pos.chapter].segments.length}`;
  const status = $('player-status');
  status.classList.toggle('error', !!player.error);
  status.textContent = player.error || (player.loading ? 'Génération de la voix…' : engineLabel());
  renderReader();
}
player.onChange(refreshPlayerUI);

// ---------- Préparation hors ligne & export ----------

let abortPrepare: AbortController | null = null;

async function updatePrepareStatus() {
  const doc = currentDoc;
  const prepareBtn = $<HTMLButtonElement>('prepare');
  const exportBtn = $<HTMLButtonElement>('export');
  const system = settings.engine === 'system';
  prepareBtn.hidden = exportBtn.hidden = system;
  if (!doc || system || abortPrepare) return;
  const ratio = await preparedRatio(doc);
  exportBtn.disabled = ratio < 1;
  prepareBtn.textContent = ratio >= 1 ? 'Prêt hors ligne ✓' : ratio > 0 ? `Préparer hors ligne (${Math.floor(ratio * 100)} %)` : 'Préparer hors ligne';
}

$('prepare').onclick = async () => {
  const doc = currentDoc;
  if (!doc) return;
  const status = $('prepare-status');
  const btn = $<HTMLButtonElement>('prepare');
  if (abortPrepare) {
    abortPrepare.abort();
    return;
  }
  if (settings.engine === 'elevenlabs') {
    const chars = charCount(doc);
    if (!confirm(`La préparation va envoyer jusqu'à ${chars.toLocaleString('fr-FR')} caractères à ElevenLabs (les passages déjà préparés ne sont pas recomptés). Cela consomme vos crédits. Continuer ?`)) return;
  } else if (!confirm("L'audio Piper sera généré sur cet appareil et stocké (environ 2,5 Mo par minute) pour permettre l'export. L'écoute hors ligne avec Piper fonctionne déjà sans cette étape. Continuer ?")) {
    return;
  }
  abortPrepare = new AbortController();
  btn.textContent = 'Arrêter';
  try {
    await prepareOffline(doc, (done, total) => show(status, `Préparation : ${done}/${total} passages (${Math.floor((done / total) * 100)} %)`), abortPrepare.signal);
    show(status, abortPrepare.signal.aborted ? 'Préparation interrompue. Vous pourrez la reprendre plus tard.' : 'Document prêt pour l’écoute hors ligne.');
  } catch (err) {
    show(status, errorText(err), true);
  } finally {
    abortPrepare = null;
    updatePrepareStatus();
  }
};

$('export').onclick = async () => {
  const doc = currentDoc;
  if (!doc) return;
  const status = $('prepare-status');
  try {
    show(status, 'Assemblage du fichier audio…');
    const blob = await exportAudio(doc);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${doc.title}.${blob.type === 'audio/mpeg' ? 'mp3' : 'wav'}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
    show(status, `Fichier exporté (${(blob.size / 1e6).toFixed(1)} Mo).`);
  } catch (err) {
    show(status, errorText(err), true);
  }
};

// ---------- Réglages ----------

const dialog = $<HTMLDialogElement>('settings');
let elevenList: ElevenVoice[] = (() => {
  try {
    return JSON.parse(localStorage.getItem('lecteur-audio:el-voices') ?? '[]');
  } catch {
    return [];
  }
})();

function elevenName(id: string) {
  return elevenList.find((v) => v.id === id)?.name ?? 'voix non choisie';
}

function applyEngineVisibility() {
  dialog.querySelectorAll<HTMLElement>('section[data-engine]').forEach((s) => {
    s.hidden = s.dataset.engine !== settings.engine;
  });
  dialog.querySelectorAll<HTMLInputElement>('input[name=engine]').forEach((r) => {
    r.checked = r.value === settings.engine;
  });
}

function changed() {
  player.settingsChanged();
  updatePrepareStatus();
  refreshPlayerUI();
}

dialog.querySelectorAll<HTMLInputElement>('input[name=engine]').forEach((r) => {
  r.onchange = () => {
    saveSettings({ engine: r.value as EngineId });
    applyEngineVisibility();
    changed();
  };
});

$('open-settings').onclick = () => {
  applyEngineVisibility();
  renderPiperVoices();
  renderElevenSelects();
  renderSystemVoices();
  renderStorage();
  dialog.showModal();
};

// Piper
let downloading = new Map<string, number>();

async function renderPiperVoices() {
  const ul = $('piper-voices');
  const filter = $<HTMLInputElement>('piper-filter').value.trim().toLowerCase();
  let list;
  try {
    list = await piperVoices();
  } catch (err) {
    ul.textContent = errorText(err);
    return;
  }
  const have = await downloadedVoices();
  const visible = list.filter((v) =>
    filter
      ? `${v.id} ${v.language} ${v.name}`.toLowerCase().includes(filter)
      : RECOMMENDED.includes(v.id) || have.has(v.id) || v.id === settings.piperVoice,
  );
  ul.replaceChildren(
    ...visible.map((v) => {
      const li = document.createElement('li');
      li.className = 'voice' + (v.id === settings.piperVoice ? ' selected' : '');
      const progress = downloading.get(v.id);
      const ok = have.has(v.id);
      li.innerHTML = `
        <span class="voice-name"><strong></strong><small class="muted"></small></span>
        <span class="voice-actions"></span>`;
      li.querySelector('strong')!.textContent = v.name;
      li.querySelector('small')!.textContent = `${v.language} · qualité ${v.quality} · ${v.sizeMb} Mo`;
      const actions = li.querySelector('.voice-actions')!;
      if (progress !== undefined) {
        actions.textContent = `${Math.round(progress * 100)} %`;
      } else if (ok) {
        const use = document.createElement('button');
        use.type = 'button';
        use.className = 'btn';
        use.textContent = v.id === settings.piperVoice ? 'Utilisée ✓' : 'Utiliser';
        use.onclick = () => {
          saveSettings({ piperVoice: v.id });
          changed();
          renderPiperVoices();
        };
        const del = document.createElement('button');
        del.type = 'button';
        del.className = 'icon-btn';
        del.textContent = '🗑';
        del.ariaLabel = 'Supprimer la voix';
        del.onclick = async () => {
          await deleteVoice(v.id);
          renderPiperVoices();
        };
        actions.append(use, del);
      } else {
        const dl = document.createElement('button');
        dl.type = 'button';
        dl.className = 'btn';
        dl.textContent = 'Télécharger';
        dl.disabled = !navigator.onLine;
        dl.onclick = async () => {
          downloading.set(v.id, 0);
          renderPiperVoices();
          let last = 0;
          try {
            await downloadVoice(v.id, (r) => {
              downloading.set(v.id, r);
              if (Date.now() - last > 300) {
                last = Date.now();
                renderPiperVoices();
              }
            });
            downloading.delete(v.id);
            if (!have.size) saveSettings({ piperVoice: v.id });
            if (settings.piperVoice === v.id) changed();
          } catch (err) {
            downloading.delete(v.id);
            alert(`Téléchargement impossible : ${errorText(err)}`);
          }
          setTimeout(renderPiperVoices, 500);
        };
        actions.append(dl);
      }
      return li;
    }),
  );
  if (!filter) {
    const hint = document.createElement('li');
    hint.className = 'muted small';
    hint.textContent = 'Tapez une langue dans le filtre pour voir plus de 100 autres voix (anglais, espagnol, arabe…).';
    ul.append(hint);
  }
}
$('piper-filter').oninput = () => renderPiperVoices();

// ElevenLabs
const elKey = $<HTMLInputElement>('el-key');
elKey.value = settings.elevenKey;
elKey.onchange = () => saveSettings({ elevenKey: elKey.value.trim() });

function renderElevenSelects() {
  const voice = $<HTMLSelectElement>('el-voice');
  voice.replaceChildren(
    new Option(elevenList.length ? '— choisir une voix —' : '— chargez vos voix —', ''),
    ...elevenList.map((v) => new Option(v.description ? `${v.name} (${v.description})` : v.name, v.id)),
  );
  voice.value = settings.elevenVoice;
  const model = $<HTMLSelectElement>('el-model');
  model.replaceChildren(...ELEVEN_MODELS.map((m) => new Option(m.label, m.id)));
  model.value = settings.elevenModel;
}

$('el-load').onclick = async () => {
  const status = $('el-status');
  saveSettings({ elevenKey: elKey.value.trim() });
  if (!settings.elevenKey) {
    status.textContent = 'Saisissez d’abord votre clé API.';
    return;
  }
  status.textContent = 'Chargement…';
  try {
    elevenList = await elevenVoices(settings.elevenKey);
    localStorage.setItem('lecteur-audio:el-voices', JSON.stringify(elevenList));
    status.textContent = `${elevenList.length} voix disponibles.`;
    if (!settings.elevenVoice && elevenList[0]) saveSettings({ elevenVoice: elevenList[0].id });
    renderElevenSelects();
    changed();
  } catch (err) {
    status.textContent = errorText(err);
  }
};
$<HTMLSelectElement>('el-voice').onchange = (e) => {
  saveSettings({ elevenVoice: (e.target as HTMLSelectElement).value });
  changed();
};
$<HTMLSelectElement>('el-model').onchange = (e) => {
  saveSettings({ elevenModel: (e.target as HTMLSelectElement).value });
  changed();
};

// Voix système
function renderSystemVoices() {
  const select = $<HTMLSelectElement>('sys-voice');
  const voices = speechSynthesis
    .getVoices()
    .slice()
    .sort((a, b) => Number(!b.lang.startsWith('fr')) - Number(!a.lang.startsWith('fr')) || a.lang.localeCompare(b.lang));
  select.replaceChildren(
    new Option('Automatique (français)', ''),
    ...voices.map((v) => new Option(`${v.name} — ${v.lang}${v.localService ? '' : ' (en ligne)'}`, v.voiceURI)),
  );
  select.value = settings.systemVoice;
}
speechSynthesis.onvoiceschanged = () => dialog.open && renderSystemVoices();
$<HTMLSelectElement>('sys-voice').onchange = (e) => {
  saveSettings({ systemVoice: (e.target as HTMLSelectElement).value });
  changed();
};

// Test de voix
const SAMPLE = 'Bonjour ! Voici un aperçu de cette voix. Bonne écoute de vos livres.';
const testAudio = new Audio();
$('test-voice').onclick = async () => {
  const status = $('test-status');
  status.textContent = '';
  try {
    if (settings.engine === 'system') {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(SAMPLE);
      const v = speechSynthesis.getVoices().find((x) => x.voiceURI === settings.systemVoice);
      if (v) u.voice = v;
      u.lang = v?.lang ?? 'fr-FR';
      u.rate = settings.rate;
      speechSynthesis.speak(u);
      return;
    }
    status.textContent = 'Génération…';
    let blob: Blob;
    if (settings.engine === 'piper') {
      blob = await piperSynthesize(SAMPLE, settings.piperVoice);
    } else {
      if (!settings.elevenKey || !settings.elevenVoice) throw new Error('Clé ou voix ElevenLabs manquante.');
      blob = await elevenSynthesize(SAMPLE, { apiKey: settings.elevenKey, voiceId: settings.elevenVoice, modelId: settings.elevenModel });
    }
    testAudio.src = URL.createObjectURL(blob);
    testAudio.playbackRate = settings.rate;
    await testAudio.play();
    status.textContent = '';
  } catch (err) {
    status.textContent = errorText(err);
  }
};

async function renderStorage() {
  const est = await navigator.storage?.estimate?.();
  if (est?.usage !== undefined) {
    $('storage').textContent = `Stockage utilisé : ${(est.usage / 1e6).toFixed(0)} Mo${est.quota ? ` sur ${(est.quota / 1e9).toFixed(1)} Go disponibles` : ''}.`;
  }
}

// Premier lancement : proposer de télécharger une voix.
renderLibrary();
(async () => {
  if (settings.engine === 'piper' && navigator.onLine) {
    const have = await downloadedVoices().catch(() => new Set<string>());
    if (!have.size) {
      setTimeout(() => {
        $('open-settings').click();
      }, 400);
    }
  }
})();
