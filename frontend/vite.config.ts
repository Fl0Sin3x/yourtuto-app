/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
  server: {
    port: 3000,
    proxy: {
      '/api':     { target: 'http://127.0.0.1:8002', changeOrigin: true },
      '/uploads': { target: 'http://127.0.0.1:8002', changeOrigin: true },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react':    ['react', 'react-dom', 'react-router-dom'],
          'vendor-query':    ['@tanstack/react-query'],
          'vendor-ui':       ['lucide-react'],
          'vendor-markdown': ['react-markdown', 'rehype-highlight', 'remark-gfm', 'dompurify'],
          'vendor-editor':   ['@uiw/react-md-editor'],
        },
      },
    },
  },
});
