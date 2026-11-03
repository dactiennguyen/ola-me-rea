import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const core = fileURLToPath(new URL('../scripts/nodejs/src', import.meta.url));

// Tauri expects a fixed dev port and fails if it is taken.
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  resolve: {
    alias: { '@ola/core': core },
    // Core files live outside this app; resolve their bare imports from here so
    // there is exactly one copy of each package.
    dedupe: ['firebase', 'zod'],
  },
  server: {
    port: 1420,
    strictPort: true,
    fs: { allow: [repoRoot] },
    watch: { ignored: ['**/src-tauri/**'] },
  },
  envPrefix: ['VITE_', 'TAURI_ENV_'],
  build: {
    target: 'safari16',
    sourcemap: false,
    // One bundle loaded from disk; size warnings target websites.
    chunkSizeWarningLimit: 1500,
  },
});
