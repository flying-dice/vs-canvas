import type { CanvasColor } from '../../../src/shared/protocol';

// Fallbacks match VS Code's Dark Modern chart colors, for rendering outside a webview.
const chartFallback = {
  red: '#f14c4c',
  orange: '#d18616',
  yellow: '#cca700',
  green: '#89d185',
  purple: '#b180d7',
} as const;

const presets: Record<string, string> = {
  '1': `var(--vscode-charts-red, ${chartFallback.red})`,
  '2': `var(--vscode-charts-orange, ${chartFallback.orange})`,
  '3': `var(--vscode-charts-yellow, ${chartFallback.yellow})`,
  '4': `var(--vscode-charts-green, ${chartFallback.green})`,
  '5': 'var(--vscode-terminal-ansiCyan, #29b8db)',
  '6': `var(--vscode-charts-purple, ${chartFallback.purple})`,
};

/** The six JSON Canvas preset ids, in order (red, orange, yellow, green, cyan, purple). */
export const PRESET_IDS = ['1', '2', '3', '4', '5', '6'] as const;
export const PRESET_NAMES: Record<string, string> = {
  '1': 'Red', '2': 'Orange', '3': 'Yellow', '4': 'Green', '5': 'Cyan', '6': 'Purple',
};

/** Canvas color (preset "1"-"6" or hex) to a CSS color; undefined when there is no color. */
export function canvasColor(c: CanvasColor | null | undefined): string | undefined {
  if (!c) return undefined;
  return presets[c] ?? c;
}

/** Semantic meaning of each preset (design.md), used for tooltips. */
export const SEMANTIC_NAMES: Record<string, string> = {
  '1': 'Failure', '2': 'Investigating', '3': 'Attention', '4': 'Confirmed', '5': 'Flow', '6': 'Domain',
};

/** CSS color for muted / neutral chrome. */
export const MUTED = 'var(--vscode-descriptionForeground, #9d9d9d)';
