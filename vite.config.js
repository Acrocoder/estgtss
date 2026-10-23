import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icons/etg-tss-192.png'],
      manifest: {
        id: '/',
        name: 'ESTG TSS',
        short_name: 'ESTG TSS',
        description: 'ESTG TSS school patron system for student records, attendance, permissions, and behaviour.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        theme_color: '#f6f7fb',
        background_color: '#f6f7fb',
        icons: [
          { src: '/icons/etg-tss-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/etg-tss-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api(?:\/|$)/],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
      },
      devOptions: { enabled: true },
    }),
  ],
})
