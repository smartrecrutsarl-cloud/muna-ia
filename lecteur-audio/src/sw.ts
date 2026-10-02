/// <reference lib="webworker" />
// Service worker : application disponible hors ligne + réception des fichiers partagés.
import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: (string | { url: string; revision: string | null })[] };

self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')));

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'POST' || !url.pathname.endsWith('/share-target')) return;
  event.respondWith(
    (async () => {
      const form = await event.request.formData();
      const cache = await caches.open('shared-files');
      for (const f of form.getAll('files')) {
        if (!(f instanceof File)) continue;
        await cache.put(
          new Request(`shared/${Date.now()}-${encodeURIComponent(f.name)}`),
          new Response(f, { headers: { 'Content-Type': f.type || 'application/octet-stream', 'X-File-Name': encodeURIComponent(f.name) } }),
        );
      }
      return Response.redirect('./?shared=1', 303);
    })(),
  );
});
