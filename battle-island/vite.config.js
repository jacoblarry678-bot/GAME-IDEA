import { defineConfig } from 'vite';

// Battle Island is a standalone Vite root that shares the repo's node_modules.
export default defineConfig({
  root: __dirname,
  base: './',
  server: { host: '0.0.0.0', port: 5174, strictPort: false },
  build: { outDir: 'dist', emptyOutDir: true, target: 'es2020', chunkSizeWarningLimit: 3000, assetsInlineLimit: 100000000 },
});
