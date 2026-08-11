import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: false,
    // The game server owns the websocket; Vite just proxies to it in dev so
    // players only ever need one URL.
    proxy: {
      '/socket.io': { target: 'http://localhost:3000', ws: true, changeOrigin: true },
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
  build: { outDir: 'dist', target: 'es2020', chunkSizeWarningLimit: 2000 },
});
