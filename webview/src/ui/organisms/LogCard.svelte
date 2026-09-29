<script lang="ts">
  import FarSummary from '../molecules/FarSummary.svelte';
  import type { Lod } from '../../lib/lod';
  import { canvasColor } from '../../lib/colors';
  import { firstError, parseLogLine } from '../../lib/logParse';
  import Icon from '../atoms/Icon.svelte';
  import Badge from '../atoms/Badge.svelte';

  let {
    text,
    title,
    errorLines = [],
    color,
    selected = false,
    onframeclick,
    lod = 'near',
  }: {
    text: string;
    title?: string;
    /** 1-based line numbers within `text` that are errors (tinted red). */
    errorLines?: number[];
    color?: string;
    selected?: boolean;
    onframeclick?: (path: string, line: number) => void;
    /** Semantic zoom: `far` shows the title and the first error line large. */
    lod?: Lod;
  } = $props();

  const lines = $derived(text.replace(/\n$/, '').split('\n').map((l, i) => ({ n: i + 1, segs: parseLogLine(l) })));
  const errors = $derived(new Set(errorLines));
  const first = $derived(firstError(errorLines));
  const accent = $derived(canvasColor(color));
</script>

<div class="card" class:selected style={accent ? `--accent: ${accent}` : ''}>
  <div class="head">
    <span class="glyph"><Icon name="log" /></span>
    <span class="title">{title || 'Log'}</span>
    <span class="meta">
      {#if errors.size}<Badge>{errors.size} {errors.size === 1 ? 'error' : 'errors'}</Badge>{/if}
    </span>
  </div>
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <div class="body nodrag nowheel nopan" tabindex="0" role="log" aria-label={title || 'Log'}>
    {#each lines as l (l.n)}
      <div class="line" class:err={errors.has(l.n)} class:first={l.n === first}>
        <span class="ln" aria-hidden="true">{l.n}</span>
        <span class="txt">{#each l.segs as s, i (i)}{#if s.frame}<button
                type="button"
                class="frame"
                title={`Open ${s.frame.path}:${s.frame.line}`}
                onclick={() => onframeclick?.(s.frame!.path, s.frame!.line)}>{s.text}</button
              >{:else}{s.text}{/if}{/each}</span>
      </div>
    {/each}
  </div>
  <FarSummary
    active={lod === 'far'}
    title={title || 'Log'}
    icon="log"
    accent={errorLines.length ? canvasColor('1') : undefined}
    subtitle={first ? text.split('\n')[first - 1]?.trim() : undefined}
    chips={errorLines.length ? [{ label: `${errorLines.length} error${errorLines.length === 1 ? '' : 's'}`, color: canvasColor('1') }] : []}
  />
</div>

<style>
  .card {
    position: relative;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: var(--vscode-terminal-background, var(--vscode-editor-background, #1e1e1e));
    color: var(--vscode-terminal-foreground, var(--vscode-editor-foreground, #d4d4d4));
    border: 1px solid var(--vscode-editorWidget-border, var(--vscode-panel-border, #454545));
    border-radius: 6px;
  }
  .card.selected {
    border-color: var(--vscode-focusBorder, #007fd4);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--vscode-focusBorder, #007fd4) 35%, transparent);
  }
  .head {
    display: flex;
    flex: none;
    align-items: center;
    gap: 8px;
    height: 31px;
    box-sizing: border-box;
    padding: 0 12px;
    background: var(--vscode-editorWidget-background, #252526);
    border-bottom: 1px solid var(--vscode-panel-border, var(--vscode-editorWidget-border, #454545));
    font-family: var(--vscode-font-family, system-ui, sans-serif);
    font-size: 12px;
    cursor: grab;
  }
  .glyph {
    display: grid;
    color: var(--vscode-descriptionForeground, #9d9d9d);
  }
  .title {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 600;
  }
  .body {
    flex: 1;
    min-height: 0;
    padding: 4px 0;
    overflow: auto;
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: 12px;
    line-height: 18px;
    white-space: pre;
    user-select: text;
    cursor: text;
    outline: none;
  }
  .body:focus-visible {
    outline: 1px solid var(--vscode-focusBorder, #007fd4);
    outline-offset: -1px;
  }
  .line {
    display: flex;
    min-width: max-content;
    height: 18px;
    border-left: 2px solid transparent;
  }
  .line.err {
    background: color-mix(in srgb, var(--vscode-charts-red, #f14c4c) 14%, transparent);
  }
  .line.first {
    border-left-color: var(--vscode-charts-red, #f14c4c);
  }
  .ln {
    flex: none;
    width: 32px;
    padding-right: 10px;
    box-sizing: border-box;
    text-align: right;
    color: var(--vscode-editorLineNumber-foreground, #858585);
    user-select: none;
  }
  .txt {
    padding-right: 12px;
  }
  .frame {
    padding: 0;
    border: 0;
    background: none;
    color: var(--vscode-textLink-foreground, #3794ff);
    font: inherit;
    text-decoration: underline;
    text-decoration-color: color-mix(in srgb, currentColor 40%, transparent);
    text-underline-offset: 2px;
    cursor: pointer;
  }
  .frame:hover {
    text-decoration-color: currentColor;
  }
  .frame:focus-visible {
    outline: 1px solid var(--vscode-focusBorder, #007fd4);
    outline-offset: 1px;
    border-radius: 2px;
  }
  .err .txt {
    color: var(--vscode-errorForeground, #f48771);
  }
  .err .frame {
    color: inherit;
  }
</style>
