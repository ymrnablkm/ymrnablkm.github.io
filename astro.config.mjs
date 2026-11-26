import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://ymrnablkm.github.io',
  integrations: [
    sitemap({
      // 草稿不会生成页面；这里再排除后台/统计相关非内容路由
      filter: (page) => !page.includes('/admin') && !page.includes('/download-manifest'),
    }),
  ],
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