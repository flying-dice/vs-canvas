// Colour tokens for a shape: CSS custom properties set on the shape root, read by ShapeFigure and the label.
// Only --vscode-* tokens (with fallbacks); a canvas colour (meaning) overrides the tone.
import { canvasColor } from '../colors';

export type Tone = 'default' | 'accent' | 'external' | 'filled' | 'frame';

const surface = 'var(--vscode-editorWidget-background, #252526)';
// Outlines carry the diagram, so the widget border is lifted a little towards the foreground for contrast.
const border = 'color-mix(in srgb, var(--vscode-editor-foreground, #cccccc) 32%, var(--vscode-editorWidget-border, var(--vscode-widget-border, #454545)))';
const fg = 'var(--vscode-editor-foreground, #cccccc)';
const desc = 'var(--vscode-descriptionForeground, #9d9d9d)';
const blue = 'var(--vscode-charts-blue, #3794ff)';
const bg = 'var(--vscode-editor-background, #1e1e1e)';

export function toneStyle(tone: Tone | undefined, color?: string): string {
  const c = canvasColor(color);
  let stroke = border;
  let fill = surface;
  let ink = fg;
  switch (tone) {
    case 'accent':
      stroke = blue;
      fill = `color-mix(in srgb, ${blue} 18%, ${surface})`;
      break;
    case 'external':
      stroke = `color-mix(in srgb, ${desc} 70%, ${bg})`;
      fill = `color-mix(in srgb, ${desc} 16%, ${surface})`;
      break;
    case 'filled':
      stroke = fg;
      break;
    case 'frame':
      stroke = `color-mix(in srgb, ${desc} 85%, ${bg})`;
      break;
  }
  if (c) {
    stroke = c;
    ink = tone === 'filled' ? c : ink;
    if (tone !== 'frame' && tone !== 'filled') fill = `color-mix(in srgb, ${c} 14%, ${surface})`;
  }
  return `--sc-stroke:${stroke};--sc-fill:${fill};--sc-ink:${tone === 'filled' && !c ? fg : ink};--sc-bg:${bg};`;
}
