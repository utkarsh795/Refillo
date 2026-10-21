import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      strategies: 'generateSW',
      // We manually register the SW in main.tsx
      injectRegister: null,
      filename: 'sw.js',
      workbox: {
        // Cache all build artifacts (JS, CSS, HTML, fonts, images)
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,woff}'],
        // Inter font woff2 files can be large
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
        skipWaiting: true,
        clientsClaim: true,
        // Don't precache source maps
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api\//],
      },
      manifest: {
        name: 'Refillo — Kirana Stock Manager',
        short_name: 'Refillo',
        description: 'Offline-first stock and reorder tool for small kirana shops. Add stock, record sales, see what needs reordering — no internet needed.',
        theme_color: '#4ade80',
        background_color: '#0f1117',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        lang: 'en-IN',
        categories: ['business', 'productivity'],
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
        shortcuts: [
          {
            name: 'Add Stock',
            short_name: 'Stock In',
            url: '/',
            icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
          },
          {
            name: 'Record Sale',
            short_name: 'Sell',
            url: '/',
            icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
          },
        ],
      },
      devOptions: {
        enabled: true,
        type: 'module',
        navigateFallback: 'index.html',
      },
    }),
  ],
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('dexie')) return 'dexie';
          if (id.includes('react-router')) return 'router';
          if (id.includes('lucide-react')) return 'icons';
        },
      },
    },
  },
});
