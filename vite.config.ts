import { defineConfig } from 'vite';

export default defineConfig({
  // Relative paths so the build works from a GitHub Pages project subfolder.
  base: './',
  build: { chunkSizeWarningLimit: 2000 },
});
