import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    port: 5173,
    // El navegador solo habla con el servidor local; las claves API viven allí.
    proxy: { '/api': { target: 'http://127.0.0.1:8787', changeOrigin: false } },
  },
  preview: { proxy: { '/api': { target: 'http://127.0.0.1:8787' } } },
  build: { chunkSizeWarningLimit: 1800 },
});
