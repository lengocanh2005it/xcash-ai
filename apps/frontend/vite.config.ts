import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Vite cần ESM — bundle trực tiếp từ source TS (dist/ là CommonJS cho NestJS)
      '@xcash/shared-types': path.resolve(__dirname, '../../packages/shared-types/src/index.ts'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('recharts') || id.includes('d3-') || id.includes('victory-vendor')) {
            return 'recharts';
          }
          if (id.includes('@tanstack/react-query') || id.includes('@tanstack/query-core')) {
            return 'tanstack-query';
          }
          if (id.includes('radix-ui') || id.includes('@radix-ui')) {
            return 'radix-ui';
          }
        },
      },
    },
  },
  server: {
    host: true,
    port: 5173,
  },
});
