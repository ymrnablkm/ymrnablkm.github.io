import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root,
  base: '/admin/app/',
  plugins: [react()],
  build: {
    outDir: path.resolve(root, '../public/admin/app'),
    emptyOutDir: true,
    chunkSizeWarningLimit: 1200,
  },
  server: {
    port: 5174,
    proxy: {
      '/api': 'http://127.0.0.1:4322',
    },
  },
});
