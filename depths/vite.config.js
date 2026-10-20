import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: { host: '0.0.0.0', port: 5190, strictPort: false },
  preview: { port: 4195 },
  build: { outDir: 'dist', target: 'es2020', chunkSizeWarningLimit: 2000 },
});
