import { defaultClientConditions, defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import preact from '@preact/preset-vite';
import pkg from './package.json';

// Isolation cross-origin : permet au moteur de voix d'utiliser plusieurs cœurs (SharedArrayBuffer).
const isolation = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
};

const DOC_TYPES = {
  'application/pdf': ['.pdf'],
  'application/epub+zip': ['.epub'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'text/plain': ['.txt'],
};

export default defineConfig({
  base: './',
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  // Version d'onnxruntime qui charge son script de calcul à part (nécessaire au multi-cœurs).
  resolve: { conditions: ['onnxruntime-web-use-extern-wasm', ...defaultClientConditions] },
  server: { headers: isolation },
  preview: { headers: isolation },
  worker: { format: 'es' },
  assetsInclude: ['**/*.data'],
  plugins: [
    preact(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectManifest: {
        // Les moteurs WASM sont volumineux : on les met quand même en cache pour le hors-ligne.
        globPatterns: ['**/*.{js,mjs,css,html,svg,png,woff2,wasm,data,mp3}'],
        maximumFileSizeToCacheInBytes: 40 * 1024 * 1024,
        globIgnores: ['**/*-{cyrillic,cyrillic-ext,greek,greek-ext,vietnamese}-*.woff2'],
      },
      manifest: {
        id: './',
        name: 'Muna Audio — vos documents en voix naturelle',
        short_name: 'Muna Audio',
        description: 'Écoutez vos PDF, documents Word et livres EPUB lus par des voix naturelles, même hors ligne.',
        lang: 'fr',
        theme_color: '#F6F3EE',
        background_color: '#F6F3EE',
        display: 'standalone',
        orientation: 'portrait',
        start_url: './',
        categories: ['books', 'education', 'productivity'],
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
        // « Partager → Muna Audio » depuis WhatsApp, les fichiers, etc. (Android).
        share_target: {
          action: './share-target',
          method: 'POST',
          enctype: 'multipart/form-data',
          params: { title: 'title', text: 'text', files: [{ name: 'files', accept: [...Object.keys(DOC_TYPES), ...Object.values(DOC_TYPES).flat()] }] },
        },
        // « Ouvrir avec Muna Audio » (ordinateur).
        file_handlers: [{ action: './', accept: DOC_TYPES }],
      } as Record<string, unknown>,
    }),
  ],
});
