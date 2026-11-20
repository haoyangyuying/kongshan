import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: { host: '127.0.0.1', port: 5199, allowedHosts: ['.trycloudflare.com'] },
  preview: { host: '127.0.0.1', port: 5200, allowedHosts: ['.trycloudflare.com'] },
  build: { target: 'es2022', assetsInlineLimit: 8192 },
});
