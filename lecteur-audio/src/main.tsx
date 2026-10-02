import '@fontsource-variable/inter';
import '@fontsource-variable/fraunces';
import '@fontsource-variable/literata';
import './style.css';
import { render } from 'preact';
import { registerSW } from 'virtual:pwa-register';
import { App } from './ui/app';
import { importFiles, openBook } from './ui/store';

registerSW({ immediate: true });
navigator.storage?.persist?.().catch(() => {});

render(<App />, document.getElementById('app')!);

/** Fichiers reçus via « Partager → Muna Audio » (Android) : déposés par le service worker. */
async function importShared() {
  const params = new URLSearchParams(location.search);
  if (!params.has('shared')) return;
  history.replaceState(null, '', location.pathname);
  const cache = await caches.open('shared-files');
  const files: File[] = [];
  for (const req of await cache.keys()) {
    const res = await cache.match(req);
    if (!res) continue;
    const name = decodeURIComponent(res.headers.get('X-File-Name') ?? 'document');
    files.push(new File([await res.blob()], name, { type: res.headers.get('Content-Type') ?? '' }));
    await cache.delete(req);
  }
  if (files.length) {
    const doc = await importFiles(files);
    if (doc) openBook(doc.id);
  }
}
void importShared();

/** Ouverture d'un fichier depuis le système (« Ouvrir avec », ordinateur). */
const launch = (window as unknown as { launchQueue?: { setConsumer(fn: (p: { files: FileSystemFileHandle[] }) => void): void } }).launchQueue;
launch?.setConsumer(async ({ files }) => {
  if (!files?.length) return;
  const list = await Promise.all(files.map((h) => h.getFile()));
  const doc = await importFiles(list);
  if (doc) openBook(doc.id);
});
