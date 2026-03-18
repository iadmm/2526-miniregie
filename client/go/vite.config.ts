import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';
import { resolve } from 'node:path';

export default defineConfig({
  root: import.meta.dirname,
  plugins: [
    svelte(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'JAM Multimédia — Régie',
        short_name: 'Régie',
        description: 'Partage tes créations avec la régie',
        theme_color: '#1ac0d7',
        background_color: '#0a0a0a',
        display: 'standalone',
        start_url: '/go',
        share_target: {
          action: '/go/link',
          method: 'GET',
          params: { url: 'url' },
        },
      },
    }),
  ],
  resolve: {
    alias: { '@shared': resolve(import.meta.dirname, '../../shared') },
  },
  base: '/go/',
  server: {
    port: 3002,
    proxy: {
      '/go/api': 'http://localhost:3000',
      '/api': 'http://localhost:3000',
      '/auth': 'http://localhost:3000',
    },
  },
  build: { outDir: 'dist' },
});