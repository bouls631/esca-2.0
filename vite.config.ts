import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// En GitHub Actions (deploy Pages) → base /esca-2.0/, sinon '/' en local
const base = process.env.GITHUB_ACTIONS ? '/esca-2.0/' : '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png,woff2}'] },
      manifest: {
        id: '/',
        name: 'Coach Voie — 7a',
        short_name: 'Coach Voie',
        lang: 'fr',
        description: "Coach préventif et adaptatif pour grimpeur 6a→7a. Mardi = intensité, jeudi = volume.",
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0b0e11',
        theme_color: '#0b0e11',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
});
