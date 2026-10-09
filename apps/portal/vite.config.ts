import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // Validate required env at build time
  define: {
    __DEV__: JSON.stringify(process.env.NODE_ENV === 'development'),
  },
});
