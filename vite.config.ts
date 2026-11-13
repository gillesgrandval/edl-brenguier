import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * Adresse de l'application une fois en ligne :
 *   https://<compte-github>.github.io/edl-brenguier/
 * Le « base » doit correspondre au nom du dépôt GitHub.
 * ⚠️ Ne plus jamais le changer une fois la tablette en service :
 *    les données sont rattachées à cette adresse.
 */
const BASE = '/edl-brenguier/'

export default defineConfig({
  base: BASE,
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '0.1.0'),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt', // on prévient l'utilisateur avant d'appliquer une mise à jour
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'EDL Brenguier — États des lieux',
        short_name: 'EDL Brenguier',
        description: "Réalisation d'états des lieux d'entrée et de sortie, hors ligne.",
        lang: 'fr',
        start_url: BASE,
        scope: BASE,
        display: 'standalone',
        orientation: 'any',
        background_color: '#F6F3EE',
        theme_color: '#1C2B3A',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Tout ce qui compose l'application est mis en cache pour fonctionner sans réseau
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,ttf}'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        navigateFallback: `${BASE}index.html`,
      },
      devOptions: { enabled: false },
    }),
  ],
})
