/** Realistic --vscode-* variable maps (Dark Modern / Light Modern / High Contrast). */
export type ThemeName = 'dark' | 'light' | 'hc';

export const bodyClass: Record<ThemeName, string> = {
  dark: 'vscode-dark',
  light: 'vscode-light',
  hc: 'vscode-high-contrast',
};

const fonts = {
  'font-family': '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
  'font-size': '13px',
  'font-weight': 'normal',
  'editor-font-family': 'Menlo, Monaco, "Courier New", monospace',
  'editor-font-size': '12px',
  'editor-font-weight': 'normal',
};

const dark = {
  ...fonts,
  'editor-background': '#1f1f1f',
  'editor-foreground': '#cccccc',
  'editorWidget-background': '#202020',
  'editorWidget-border': '#454545',
  'panel-border': '#2b2b2b',
  focusBorder: '#0078d4',
  'editorLineNumber-foreground': '#6e7681',
  'editorLineNumber-activeForeground': '#cccccc',
  'textLink-foreground': '#4daafc',
  'textCodeBlock-background': '#2b2b2b',
  'badge-background': '#616161',
  'badge-foreground': '#f8f8f8',
  'button-background': '#0078d4',
  'button-foreground': '#ffffff',
  'button-hoverBackground': '#026ec1',
  'button-secondaryBackground': '#313131',
  'button-secondaryForeground': '#cccccc',
  'button-secondaryHoverBackground': '#3c3c3c',
  'charts-yellow': '#cca700',
  'charts-blue': '#3794ff',
  'charts-green': '#89d185',
  'charts-red': '#f14c4c',
  'charts-purple': '#b180d7',
  'charts-orange': '#d18616',
  descriptionForeground: '#9d9d9d',
  'toolbar-hoverBackground': '#383a49',
};

const light = {
  ...fonts,
  'editor-background': '#ffffff',
  'editor-foreground': '#3b3b3b',
  'editorWidget-background': '#f8f8f8',
  'editorWidget-border': '#c8c8c8',
  'panel-border': '#e5e5e5',
  focusBorder: '#005fb8',
  'editorLineNumber-foreground': '#6e7681',
  'editorLineNumber-activeForeground': '#171184',
  'textLink-foreground': '#005fb8',
  'textCodeBlock-background': '#f2f2f2',
  'badge-background': '#cccccc',
  'badge-foreground': '#3b3b3b',
  'button-background': '#005fb8',
  'button-foreground': '#ffffff',
  'button-hoverBackground': '#0258a8',
  'button-secondaryBackground': '#e5e5e5',
  'button-secondaryForeground': '#3b3b3b',
  'button-secondaryHoverBackground': '#cccccc',
  'charts-yellow': '#bf8803',
  'charts-blue': '#1a85ff',
  'charts-green': '#388a34',
  'charts-red': '#e51400',
  'charts-purple': '#652d90',
  'charts-orange': '#d18616',
  descriptionForeground: '#717171',
  'toolbar-hoverBackground': '#b8b8b8',
};

const hc = {
  ...fonts,
  'editor-background': '#000000',
  'editor-foreground': '#ffffff',
  'editorWidget-background': '#0c141f',
  'editorWidget-border': '#6fc3df',
  'panel-border': '#6fc3df',
  focusBorder: '#f38518',
  'editorLineNumber-foreground': '#ffffff',
  'editorLineNumber-activeForeground': '#ffffff',
  'textLink-foreground': '#21a6ff',
  'textCodeBlock-background': '#0a0a0a',
  'badge-background': '#000000',
  'badge-foreground': '#ffffff',
  'button-background': '#000000',
  'button-foreground': '#ffffff',
  'button-hoverBackground': '#1a1a1a',
  'button-secondaryBackground': '#000000',
  'button-secondaryForeground': '#ffffff',
  'button-secondaryHoverBackground': '#1a1a1a',
  'charts-yellow': '#cca700',
  'charts-blue': '#3794ff',
  'charts-green': '#89d185',
  'charts-red': '#f14c4c',
  'charts-purple': '#b180d7',
  'charts-orange': '#d18616',
  descriptionForeground: '#ffffff',
  'toolbar-hoverBackground': '#1a1a1a',
};

const toVars = (m: Record<string, string>) =>
  Object.fromEntries(Object.entries(m).map(([k, v]) => [`--vscode-${k}`, v]));

export const themes: Record<ThemeName, Record<string, string>> = {
  dark: toVars(dark),
  light: toVars(light),
  hc: toVars(hc),
};
