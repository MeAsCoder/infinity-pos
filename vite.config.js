import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
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
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
  },
});
