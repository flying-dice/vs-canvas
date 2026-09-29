import { defineConfig } from 'vitest/config';

// Separate from vite.config.mts (the webview build): unit tests are plain node.
export default defineConfig({
  test: { environment: 'node', include: ['src/**/*.test.ts', 'webview/src/**/*.test.ts'] },
});
