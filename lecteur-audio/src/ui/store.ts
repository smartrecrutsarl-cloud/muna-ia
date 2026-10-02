import { signal } from '@preact/signals';
import { useEffect, useState } from 'preact/hooks';
import { docs, type LibraryDoc } from '../db';
import { generatedCover } from '../covers';
import { onDownloadProgress } from '../engines/piper';
import { parseFile } from '../parsers';
import { player } from '../player';
import { cleanText } from '../segment';
import { onSettings, settings } from '../settings';

export type Route = { name: 'home' } | { name: 'book'; id: string };
export type SheetName = 'settings' | 'chapters' | 'search' | 'text' | 'sleep' | 'speed' | null;

export const library = signal<LibraryDoc[]>([]);
export const route = signal<Route>({ name: 'home' });
export const sheet = signal<SheetName>(null);
/** Écran « Lecture en cours » (les autres feuilles peuvent s'ouvrir par-dessus). */
export const nowPlaying = signal(false);
/** Sous-onglet initial de la feuille Chapitres. */
export const chaptersTab = signal<'chapters' | 'bookmarks'>('chapters');
export const importing = signal<{ name: string; progress: number } | null>(null);
export const online = signal(navigator.onLine);
addEventListener('online', () => (online.value = true));
addEventListener('offline', () => (online.value = false));

export interface Toast {
  id: number;
  text: string;
  kind?: 'error' | 'ok';
}
export const toasts = signal<Toast[]>([]);
let toastId = 0;
export function toast(text: string, kind?: Toast['kind']) {
  const t = { id: ++toastId, text, kind };
  toasts.value = [...toasts.value, t];
  setTimeout(() => (toasts.value = toasts.value.filter((x) => x.id !== t.id)), kind === 'error' ? 7000 : 3500);
}

export async function refreshLibrary() {
  const all = await docs.all();
  // Documents importés avec une version précédente : couverture et nettoyage des sommaires.
  for (const doc of all) {
    let changed = false;
    if (!doc.cover) {
      Object.assign(doc, await generatedCover(doc.title, doc.author, doc.format));
      changed = true;
    }
    for (const c of doc.chapters) {
      const cleaned = c.segments.map((s) => cleanText(s) || s);
      if (cleaned.some((s, i) => s !== c.segments[i])) {
        c.segments = cleaned;
        changed = true;
      }
    }
    if (changed) await docs.put(doc);
  }
  library.value = all.sort((a, b) => (b.lastOpenedAt ?? b.addedAt) - (a.lastOpenedAt ?? a.addedAt));
}

export function findDoc(id: string): LibraryDoc | undefined {
  // Le document chargé dans le lecteur est la référence (position à jour).
  if (player.doc?.id === id) return player.doc;
  return library.value.find((d) => d.id === id);
}

export function openBook(id: string) {
  const doc = findDoc(id);
  if (!doc) return;
  doc.lastOpenedAt = Date.now();
  void docs.put(doc);
  player.load(doc);
  route.value = { name: 'book', id };
  history.pushState({ book: id }, '');
  scrollTo(0, 0);
}

export function goHome() {
  route.value = { name: 'home' };
  void refreshLibrary();
}

/** Ouvre une feuille ; le bouton « Retour » du téléphone la refermera. */
export function openSheet(name: Exclude<SheetName, null>) {
  if (!sheet.value) history.pushState({ sheet: true }, '');
  sheet.value = name;
}

export function closeSheet() {
  if (sheet.value) history.back();
}

export function openNowPlaying() {
  if (nowPlaying.value) return;
  history.pushState({ nowPlaying: true }, '');
  nowPlaying.value = true;
}

export function closeNowPlaying() {
  if (nowPlaying.value) history.back();
}

/** Depuis « Lecture en cours », ouvre la page d'un livre (sans passer par l'historique). */
export function openBookFromSheet(id: string) {
  sheet.value = null;
  nowPlaying.value = false;
  const doc = findDoc(id);
  if (!doc) return;
  player.load(doc);
  route.value = { name: 'book', id };
  history.replaceState({ book: id }, '');
}

addEventListener('popstate', () => {
  if (sheet.value) sheet.value = null;
  else if (nowPlaying.value) nowPlaying.value = false;
  else if (route.value.name !== 'home') goHome();
});

export async function importFiles(files: File[] | FileList) {
  let last: LibraryDoc | null = null;
  for (const file of Array.from(files)) {
    try {
      importing.value = { name: file.name, progress: 0 };
      const doc = await parseFile(file, (p) => (importing.value = { name: file.name, progress: p }));
      await docs.put(doc);
      last = doc;
      toast(`« ${doc.title} » ajouté à votre bibliothèque`, 'ok');
    } catch (err) {
      toast(`${file.name} : ${err instanceof Error ? err.message : String(err)}`, 'error');
    }
  }
  importing.value = null;
  await refreshLibrary();
  return last;
}

export async function deleteDoc(doc: LibraryDoc) {
  if (player.doc?.id === doc.id) player.stop();
  await docs.delete(doc.id);
  if (player.doc?.id === doc.id) player.doc = null;
  await refreshLibrary();
}

/** Re-rend le composant à chaque changement d'état du lecteur. */
export function usePlayer() {
  const [, force] = useState(0);
  useEffect(() => player.onChange(() => force((n) => n + 1)), []);
  return player;
}

/** Re-rend le composant ≈ 4 fois par seconde pendant la lecture. */
export function usePlayerTime() {
  const [, force] = useState(0);
  useEffect(() => player.onTime(() => force((n) => n + 1)), []);
}

export function useSettings() {
  const [, force] = useState(0);
  useEffect(() => onSettings(() => force((n) => n + 1)), []);
  return settings;
}

export function useDownloads() {
  const [, force] = useState(0);
  useEffect(() => onDownloadProgress(() => force((n) => n + 1)), []);
}
