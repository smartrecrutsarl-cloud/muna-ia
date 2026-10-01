import './style.css';
import { registerSW } from 'virtual:pwa-register';
import { docs, type LibraryDoc } from './db';
import {
  allPiperVoices,
  deleteModel,
  downloadModel,
  downloadedModels,
  resolveVoice,
  synthesize,
} from './engines/piper';
import { exportChapter } from './offline';
import { parseFile } from './parsers';
import { cleanText } from './segment';
import { Player } from './player';
import { saveSettings, settings, type EngineId } from './settings';
import { CATALOG, SAMPLE_TEXT, type CatalogVoice } from './voices';

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
  // Documents importés avec une version précédente : on retire les pointillés de sommaire.
  let cleaned = false;
  for (const c of doc.chapters) {
    c.segments = c.segments.map((seg) => {
      const t = cleanText(seg) || seg;
      if (t !== seg) cleaned = true;
      return t;
    });
  }
  if (cleaned) await docs.put(doc);
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
  show($('export-status'), '');
  renderReader();
  updateExportButton();
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
  abortExport?.abort();
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
  return settings.engine === 'piper' ? `Voix : ${resolveVoice(settings.piperVoice).label}` : 'Voix de l’appareil';
}

function refreshPlayerUI() {
  const doc = player.doc;
  if (!doc) return;
  $('play').textContent = player.playing ? '❚❚' : '▶';
  $('play').setAttribute('aria-label', player.playing ? 'Pause' : 'Lecture');
  $('now').textContent = `${doc.chapters[player.pos.chapter].title} — ${player.pos.segment + 1}/${doc.chapters[player.pos.chapter].segments.length}`;
  const status = $('player-status');
  status.classList.toggle('error', !!player.error);
  status.textContent = player.error || player.notice || (player.loading ? 'Génération de la voix…' : engineLabel());
  renderReader();
}
player.onChange(refreshPlayerUI);


// ---------- Export d'un chapitre ----------

let abortExport: AbortController | null = null;

function updateExportButton() {
  const btn = $<HTMLButtonElement>('export');
  btn.hidden = settings.engine === 'system';
  btn.textContent = abortExport ? 'Arrêter l’export' : 'Exporter le chapitre (WAV)';
}

$('export').onclick = async () => {
  const doc = currentDoc;
  if (!doc) return;
  if (abortExport) {
    abortExport.abort();
    return;
  }
  const status = $('export-status');
  const chapter = player.pos.chapter;
  abortExport = new AbortController();
  updateExportButton();
  try {
    const blob = await exportChapter(
      doc,
      chapter,
      (done, total) => show(status, `Génération du chapitre : ${done}/${total} passages (${Math.floor((done / total) * 100)} %)`),
      abortExport.signal,
    );
    if (!blob) {
      show(status, 'Export interrompu.');
      return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${doc.title} — ${chapter + 1}. ${doc.chapters[chapter].title}.wav`.replace(/[\\/:*?"<>|]/g, '_');
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
    show(status, `Chapitre exporté (${(blob.size / 1e6).toFixed(1)} Mo).`);
  } catch (err) {
    show(status, errorText(err), true);
  } finally {
    abortExport = null;
    updateExportButton();
  }
};

// ---------- Réglages ----------

const dialog = $<HTMLDialogElement>('settings');
let catalogLang: 'fr' | 'en' = resolveVoice(settings.piperVoice).model.startsWith('en') ? 'en' : 'fr';
const downloading = new Map<string, number>();

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
  updateExportButton();
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
  renderCatalog();
  renderSystemVoices();
  renderStorage();
  dialog.showModal();
};

function useVoice(key: string) {
  saveSettings({ piperVoice: key, engine: 'piper' });
  applyEngineVisibility();
  changed();
  renderCatalog();
  if ((dialog.querySelector('#more-voices') as HTMLDetailsElement).open) renderOtherVoices();
}

/** Télécharge un modèle (partagé par plusieurs voix du catalogue le cas échéant). */
async function startDownload(model: string, thenUse?: string) {
  downloading.set(model, 0);
  rerender();
  let last = 0;
  try {
    await downloadModel(model, (r) => {
      downloading.set(model, r);
      if (Date.now() - last > 300) {
        last = Date.now();
        rerender();
      }
    });
    if (thenUse) useVoice(thenUse);
  } catch (err) {
    alert(`Téléchargement impossible : ${errorText(err)}`);
  } finally {
    downloading.delete(model);
    rerender();
  }
}

function rerender() {
  renderCatalog();
  if ((dialog.querySelector('#more-voices') as HTMLDetailsElement).open) renderOtherVoices();
}

function button(label: string, onClick: () => void, cls = 'btn') {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = cls;
  b.textContent = label;
  b.onclick = onClick;
  return b;
}

// Extraits pré-enregistrés : on peut écouter une voix avant de la télécharger.
const sampleAudio = new Audio();
let playingSample = '';
sampleAudio.onended = () => {
  playingSample = '';
  renderCatalog();
};

function playSample(v: CatalogVoice) {
  if (playingSample === v.id) {
    sampleAudio.pause();
    playingSample = '';
  } else {
    sampleAudio.src = `samples/${v.id}.mp3`;
    sampleAudio.playbackRate = 1;
    void sampleAudio.play();
    playingSample = v.id;
  }
  renderCatalog();
}

async function renderCatalog() {
  dialog.querySelectorAll<HTMLButtonElement>('.tab').forEach((t) => {
    t.classList.toggle('active', t.dataset.lang === catalogLang);
    t.onclick = () => {
      catalogLang = t.dataset.lang as 'fr' | 'en';
      renderCatalog();
    };
  });
  const have = await downloadedModels();
  const ul = $('catalog');
  ul.replaceChildren(
    ...CATALOG.filter((v) => v.lang === catalogLang).map((v) => {
      const li = document.createElement('li');
      const selected = settings.piperVoice === v.id;
      li.className = 'voice' + (selected ? ' selected' : '');
      li.innerHTML = `
        <span class="voice-name"><strong></strong><small class="muted"></small><small></small></span>
        <span class="voice-actions"></span>`;
      li.querySelector('strong')!.textContent = `${v.name} ${v.gender === 'f' ? '♀' : '♂'}`;
      const [meta, desc] = li.querySelectorAll('small');
      meta.textContent = `${v.accent} · ${v.sizeMb} Mo`;
      desc.textContent = v.description;
      const actions = li.querySelector('.voice-actions')!;
      actions.append(button(playingSample === v.id ? '■' : '▶ Extrait', () => playSample(v), 'btn btn-ghost'));
      const progress = downloading.get(v.model);
      if (progress !== undefined) {
        const span = document.createElement('span');
        span.className = 'muted small';
        span.textContent = `${Math.round(progress * 100)} %`;
        actions.append(span);
      } else if (have.has(v.model)) {
        actions.append(button(selected ? 'Choisie ✓' : 'Choisir', () => useVoice(v.id)));
      } else {
        const dl = button('Télécharger', () => startDownload(v.model, v.id));
        dl.disabled = !navigator.onLine;
        actions.append(dl);
      }
      return li;
    }),
  );
  const models = new Set(CATALOG.map((v) => v.model));
  const stored = [...have].filter((m) => models.has(m));
  if (stored.length) {
    const li = document.createElement('li');
    li.className = 'muted small manage';
    li.append(`Voix téléchargées : ${stored.length}. `);
    li.append(
      button('Libérer de l’espace…', async () => {
        const names = CATALOG.filter((v) => have.has(v.model) && resolveVoice(settings.piperVoice).model !== v.model).map((v) => v.name);
        if (!names.length) return alert('Seule la voix utilisée est téléchargée.');
        if (!confirm(`Supprimer les voix téléchargées non utilisées (${names.join(', ')}) ?`)) return;
        for (const m of stored) if (m !== resolveVoice(settings.piperVoice).model) await deleteModel(m);
        renderCatalog();
        renderStorage();
      }, 'link'),
    );
    ul.append(li);
  }
}

async function renderOtherVoices() {
  const ul = $('piper-voices');
  const filter = $<HTMLInputElement>('piper-filter').value.trim().toLowerCase();
  let list;
  try {
    list = await allPiperVoices();
  } catch (err) {
    ul.textContent = errorText(err);
    return;
  }
  const have = await downloadedModels();
  const visible = list.filter((v) => !filter || `${v.id} ${v.language} ${v.name}`.toLowerCase().includes(filter)).slice(0, 60);
  ul.replaceChildren(
    ...visible.map((v) => {
      const li = document.createElement('li');
      li.className = 'voice' + (settings.piperVoice === v.id ? ' selected' : '');
      li.innerHTML = `<span class="voice-name"><strong></strong><small class="muted"></small></span><span class="voice-actions"></span>`;
      li.querySelector('strong')!.textContent = v.name;
      li.querySelector('small')!.textContent = `${v.language} · ${v.quality} · ${v.sizeMb} Mo`;
      const actions = li.querySelector('.voice-actions')!;
      const progress = downloading.get(v.id);
      if (progress !== undefined) actions.textContent = `${Math.round(progress * 100)} %`;
      else if (have.has(v.id)) {
        actions.append(
          button(settings.piperVoice === v.id ? 'Choisie ✓' : 'Choisir', () => useVoice(v.id)),
          button('🗑', async () => {
            await deleteModel(v.id);
            renderOtherVoices();
          }, 'icon-btn'),
        );
      } else {
        const dl = button('Télécharger', () => startDownload(v.id, v.id));
        dl.disabled = !navigator.onLine;
        actions.append(dl);
      }
      return li;
    }),
  );
}
$('piper-filter').oninput = () => renderOtherVoices();
$('more-voices').addEventListener('toggle', () => {
  if (($('more-voices') as HTMLDetailsElement).open) renderOtherVoices();
});

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

// Test de la voix choisie (synthèse réelle sur l'appareil)
const testAudio = new Audio();
$('test-voice').onclick = async () => {
  const status = $('test-status');
  status.textContent = '';
  try {
    if (settings.engine === 'system') {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(SAMPLE_TEXT.fr);
      const v = speechSynthesis.getVoices().find((x) => x.voiceURI === settings.systemVoice);
      if (v) u.voice = v;
      u.lang = v?.lang ?? 'fr-FR';
      u.rate = settings.rate;
      speechSynthesis.speak(u);
      return;
    }
    status.textContent = 'Génération sur l’appareil…';
    const voice = resolveVoice(settings.piperVoice);
    const blob = await synthesize(voice.model.startsWith('fr') ? SAMPLE_TEXT.fr : SAMPLE_TEXT.en, settings.piperVoice);
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

// Premier lancement : proposer de choisir et télécharger une voix.
renderLibrary();
(async () => {
  if (settings.engine === 'piper' && navigator.onLine) {
    const have = await downloadedModels().catch(() => new Set<string>());
    if (!have.size) setTimeout(() => $('open-settings').click(), 400);
  }
})();
