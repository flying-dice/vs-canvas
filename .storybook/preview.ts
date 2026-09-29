import type { Preview } from '@storybook/svelte-vite';
import '../webview/src/app.css';
import { bodyClass, themes, type ThemeName } from './vscode-themes';

function applyTheme(name: ThemeName) {
  const root = document.documentElement;
  const body = document.body;
  for (const c of Object.values(bodyClass)) body.classList.remove(c);
  body.classList.add(bodyClass[name]);
  for (const [k, v] of Object.entries(themes[name])) root.style.setProperty(k, v);
  // Docs pages and the canvas share the iframe body; make it scrollable and themed.
  body.style.overflow = 'auto';
  body.style.height = 'auto';
  body.style.minHeight = '100vh';
}

const preview: Preview = {
  parameters: {
    layout: 'centered',
    backgrounds: { disable: true },
    controls: { expanded: true },
  },
  globalTypes: {
    theme: {
      description: 'VS Code theme',
      toolbar: {
        title: 'Theme',
        icon: 'paintbrush',
        dynamicTitle: true,
        items: [
          { value: 'dark', title: 'Dark' },
          { value: 'light', title: 'Light' },
          { value: 'hc', title: 'High Contrast' },
        ],
      },
    },
  },
  initialGlobals: { theme: 'dark' },
  decorators: [
    (story, context) => {
      applyTheme((context.globals.theme as ThemeName) ?? 'dark');
      return story();
    },
  ],
};

export default preview;
