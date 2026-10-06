<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { CodeCardData } from '../types';
  import type { Lod } from '../../lib/lod';
  import { canvasColor } from '../../lib/colors';
  import Icon from '../atoms/Icon.svelte';
  import type { Token } from '../atoms/CodeText.svelte';
  import NodeHeader from '../molecules/NodeHeader.svelte';
  import CodeLine from '../molecules/CodeLine.svelte';

  let {
    data,
    tokens = null,
    selected = false,
    pulseIds = [],
    onlineclick,
    lineHandles,
    lod = 'near',
  }: {
    data: CodeCardData;
    /** Per-line tokens (index matches data.lines); null while loading. */
    tokens?: Token[][] | null;
    selected?: boolean;
    /** Highlight ids to flash once (newly added); the parent decides which. */
    pulseIds?: string[];
    onlineclick?: (line: number) => void;
    /** Rendered inside each line row, given the absolute line number. */
    lineHandles?: Snippet<[number]>;
    /** Semantic zoom. `far` overlays the file name and highlight labels as big chips (no code text); the card keeps its size. */
    lod?: Lod;
  } = $props();

  const code = $derived(data.code);
  const last = $derived(code.firstLine + code.lines.length - 1);
  const badge = $derived(
    code.error ? undefined : `L${code.firstLine}–${last} of ${code.totalLines}${code.truncated ? ' (truncated)' : ''}`,
  );

  const farName = $derived(data.title ?? data.file.split('/').pop() ?? data.file);
  const farChips = $derived(data.highlights.filter((h) => h.label));

  function highlightsFor(n: number) {
    return data.highlights.filter((h) => n >= h.start && n <= h.end);
  }
</script>

<div class="code-card" class:selected class:far={lod === 'far'}>
  <NodeHeader
    class="node-drag-handle"
    path={code.absPath}
    relPath={data.file}
    title={data.title}
    {badge}
  />
  {#if code.error}
    <div class="error nodrag" role="alert">
      <Icon name="warning" size={16} />
      <span>{code.error}</span>
    </div>
  {:else}
  <div class="body nodrag">
    {#each code.lines as text, i (i)}
      {@const n = code.firstLine + i}
      {@const hs = highlightsFor(n)}
      <CodeLine
        {n}
        {text}
        tokens={tokens?.[i] ?? null}
        pulse={hs.some((h) => pulseIds.includes(h.id))}
        color={hs[0] ? (hs[0].color ?? '3') : undefined}
        pills={hs.filter((h) => h.label && h.start === n).map((h) => ({ id: h.id, color: h.color, label: h.label! }))}
        {onlineclick}
        handles={lineHandles ? handles : undefined}
      />
      {#snippet handles()}{@render lineHandles?.(n)}{/snippet}
    {/each}
  </div>
  {/if}
  <div class="far-layer" aria-hidden={lod !== 'far'}>
    <div class="far-name" class:file={!data.title}>{farName}</div>
    {#if data.title}<div class="far-file">{data.file}</div>{/if}
    <div class="far-chips">
      {#each farChips.slice(0, 6) as h (h.id)}
        <span class="far-chip" style={`--hc: ${canvasColor(h.color ?? '3')}`}>{h.label}</span>
      {/each}
    </div>
  </div>
</div>

<style>
  .code-card {
    position: relative;
    min-width: 420px;
    max-width: 1000px;
    width: fit-content;
    background: var(--vscode-editor-background, #1e1e1e);
    color: var(--vscode-editor-foreground, #d4d4d4);
    border: 1px solid var(--vscode-editorWidget-border, var(--vscode-panel-border, #454545));
    border-radius: 6px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    overflow: hidden;
  }
  .code-card:has(.error) {
    min-width: 320px;
  }
  .code-card.selected {
    border-color: var(--vscode-focusBorder, #007fd4);
  }
  .code-card > :not(.far-layer) {
    transition: opacity 180ms ease;
  }
  .code-card.far > :not(.far-layer) {
    opacity: 0;
    pointer-events: none;
  }
  .far-layer {
    container-type: size;
    position: absolute;
    inset: 0;
    box-sizing: border-box;
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    overflow: hidden;
    /* Card surface, not the editor background (which equals the canvas and would make the card vanish). */
    background: var(--vscode-editorWidget-background, #252526);
    border-radius: inherit;
    font-family: var(--vscode-font-family, system-ui, sans-serif);
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
    transition: opacity 180ms ease, visibility 0s linear 180ms;
  }
  .far .far-layer {
    opacity: 1;
    visibility: visible;
    pointer-events: auto;
    transition: opacity 180ms ease, visibility 0s;
  }
  .far-name {
    font-size: min(calc(32px * var(--cv-far-scale, 1)), max(32px, 11cqw));
    font-weight: 700;
    line-height: 1.15;
    overflow-wrap: break-word;
  }
  /* A bare file name never breaks mid-word ("CheckoutButton.ts" / "x"); it stays on one line and ellipsizes. */
  .far-name.file {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .far-file {
    color: var(--vscode-descriptionForeground, #9d9d9d);
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: min(calc(20px * var(--cv-far-scale, 1)), max(20px, 6cqw));
  }
  .far-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: auto;
  }
  .far-chip {
    padding: 4px 12px;
    border-radius: 4px;
    border: 2px solid var(--hc);
    background: color-mix(in srgb, var(--hc) 22%, transparent);
    font-size: min(calc(20px * var(--cv-far-scale, 1)), max(20px, 6cqw));
    font-weight: 600;
    white-space: nowrap;
  }
  @media (prefers-reduced-motion: reduce) {
    .code-card > :not(.far-layer),
    .far-layer,
    .far .far-layer {
      transition: none;
    }
  }
  .error {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px;
    color: var(--vscode-errorForeground, #f48771);
    font-family: var(--vscode-font-family, system-ui, sans-serif);
    font-size: 12px;
    user-select: text;
  }
  .body {
    padding: 4px 0;
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: var(--vscode-editor-font-size, 13px);
    line-height: 18px;
    white-space: pre;
    user-select: text;
    cursor: text;
    overflow-x: hidden;
  }
</style>