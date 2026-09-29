export type ThemeMode = 'dark' | 'light';

function read(): ThemeMode {
  const c = document.body.classList;
  return c.contains('vscode-light') || c.contains('vscode-high-contrast-light') ? 'light' : 'dark';
}

class Theme {
  mode = $state<ThemeMode>(read());

  constructor() {
    new MutationObserver(() => {
      this.mode = read();
    }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }
}

export const theme = new Theme();
