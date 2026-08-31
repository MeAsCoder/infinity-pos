// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt', // was 'autoUpdate' — see main.jsx snippet below
      includeAssets: ['favicon.png', 'icon-192.png', 'icon-512.png'],
      workbox: {
        // App shell (JS/CSS/HTML) is cached so the POS can be opened with no
        // internet at all. Actual business data lives in IndexedDB (Dexie),
        // not the service worker cache.
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        navigateFallback: '/index.html',
      },
      manifest: {
        name: 'Infinity Liquors POS',
        short_name: 'Infinity POS',
        description: 'Offline-first liquor shop POS & inventory management',
        theme_color: '#7c2d12',
        background_color: '#0f0f0f',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          // Android adaptive-icon support — without a maskable icon, Android
          // may crop your icon into an unexpected shape on some launchers.
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      devOptions: {
        enabled: true, // lets you test the SW in `vite dev`, not just build/preview
      },
    }),
  ],
  server: {
    port: 5173,
  },
});