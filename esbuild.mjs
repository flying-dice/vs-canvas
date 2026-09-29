import * as fs from 'node:fs';
import * as esbuild from 'esbuild';

const watch = process.argv.includes('--watch');

// Markdown (the agent guide in agent/skill.md) is bundled as a string.
const common = { bundle: true, platform: 'node', target: 'node20', sourcemap: true, logLevel: 'info', loader: { '.md': 'text' } };

// Make the CLI bundle directly executable (npm does this for installed bins; this helps local runs).
const chmodCli = { name: 'chmod-cli', setup: (b) => b.onEnd(() => { try { fs.chmodSync('dist/canvas-lint.js', 0o755); } catch {} }) };

const contexts = [
  // VS Code extension host
  await esbuild.context({
    ...common,
    entryPoints: ['src/extension.ts'],
    format: 'cjs',
    outfile: 'dist/extension.js',
    external: ['vscode'],
  }),
  // `canvas-lint` CLI (no vscode dependency)
  await esbuild.context({
    ...common,
    entryPoints: ['src/cli/canvas-lint.ts'],
    format: 'cjs',
    outfile: 'dist/canvas-lint.js',
    banner: { js: '#!/usr/bin/env node' },
    plugins: [chmodCli],
  }),
];

if (watch) {
  await Promise.all(contexts.map((c) => c.watch()));
} else {
  for (const c of contexts) {
    await c.rebuild();
    await c.dispose();
  }
}
