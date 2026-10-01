import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  worker: { format: 'es' },
  assetsInclude: ['**/*.data'],
  optimizeDeps: { exclude: ['@mintplex-labs/piper-tts-web'] },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'Lecteur Audio — PDF, Word, EPUB',
        short_name: 'Lecteur Audio',
        description: 'Écoutez vos PDF, documents Word et livres EPUB, même hors ligne.',
        lang: 'fr',
        theme_color: '#1f2937',
        background_color: '#111827',
        display: 'standalone',
        start_url: './',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
      },
      workbox: {
        // Les moteurs WASM sont volumineux : on les met quand même en cache pour le hors-ligne.
        globPatterns: ['**/*.{js,mjs,css,html,svg,png,wasm,data,mp3}'],
        maximumFileSizeToCacheInBytes: 40 * 1024 * 1024,
        // Les modèles de voix sont gérés par l'application (Cache Storage « piper-voices »).
      },
    }),
  ],
});
