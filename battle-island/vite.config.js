import { defineConfig } from 'vite';

// Battle Island is a standalone Vite root that shares the repo's node_modules.
export default defineConfig({
  root: __dirname,
  base: './',
  server: {
    host: '0.0.0.0',
    port: 5174,
    strictPort: false,
    // online play in dev: the relay server runs on :3100 (npm run island:server)
    proxy: { '/socket.io': { target: 'http://localhost:3100', ws: true, changeOrigin: true } },
  },
  build: { outDir: 'dist', emptyOutDir: true, target: 'es2020', chunkSizeWarningLimit: 3000, assetsInlineLimit: 100000000 },
});
