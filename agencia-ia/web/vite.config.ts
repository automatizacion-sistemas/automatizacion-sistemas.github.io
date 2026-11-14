import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    port: 5173,
    // El navegador solo habla con el servidor local; las claves API viven allí.
    // xfwd: el servidor sabe qué dispositivo pide (la laptop o el celular, que necesita PIN).
    proxy: { '/api': { target: 'http://127.0.0.1:8787', changeOrigin: false, xfwd: true } },
  },
  preview: { proxy: { '/api': { target: 'http://127.0.0.1:8787', xfwd: true } } },
  build: { chunkSizeWarningLimit: 1800 },
});
