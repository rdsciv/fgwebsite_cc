import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative base so the static build works from any subpath (Vercel, GH Pages, file host).
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { outDir: 'dist', chunkSizeWarningLimit: 1200 },
});
