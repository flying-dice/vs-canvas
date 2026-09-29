import type { StorybookConfig } from '@storybook/svelte-vite';
import { mergeConfig } from 'vite';

const config: StorybookConfig = {
  stories: ['../webview/src/**/*.stories.@(ts|svelte)'],
  addons: ['@storybook/addon-svelte-csf', '@storybook/addon-docs'],
  framework: { name: '@storybook/svelte-vite', options: {} },
  // vite.config.mts sets `root: 'webview'`, a relative `base` and a webview-specific outDir; neutralise those here.
  async viteFinal(config) {
    const merged = mergeConfig(config, { base: '/' });
    merged.root = process.cwd();
    merged.base = '/';
    return merged;
  },
};

export default config;
