import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://ymrnablkm.github.io',
  integrations: [sitemap()],
  vite: {
    plugins: [tailwindcss()],
    build: {
      cssMinify: true,
      minify: true,
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks: undefined,
        },
      },
    },
  },
  output: 'static',
  build: {
    inlineStylesheets: 'auto',
  },
  compressHTML: true,
  prefetch: {
    defaultStrategy: 'hover',
  },
  image: {
    remotePatterns: [{ protocol: 'https' }],
  },
});