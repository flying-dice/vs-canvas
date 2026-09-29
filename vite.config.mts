import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { fileURLToPath } from 'node:url';

// The webview is loaded from a vscode-webview resource URI, so all asset URLs must be relative.
export default defineConfig({
  root: 'webview',
  base: './',
  plugins: [svelte({ configFile: fileURLToPath(new URL('./svelte.config.mjs', import.meta.url)) })],
  build: {
    outDir: '../dist/webview',
    emptyOutDir: true,
    // Shiki grammars and Mermaid are lazy-loaded chunks; their size is expected.
    chunkSizeWarningLimit: 4096,
  },
});
