import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: { host: '0.0.0.0', port: 5180, strictPort: false },
  preview: { port: 4180 },
  build: { outDir: 'dist', target: 'es2020', chunkSizeWarningLimit: 2000 },
});
