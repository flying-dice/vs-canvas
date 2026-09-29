<script lang="ts">
  import type { PortalPreview } from '../../../../src/shared/protocol';
  import { canvasColor } from '../../lib/colors';
  import Icon, { type IconName } from '../atoms/Icon.svelte';

  let {
    preview,
    title,
    selected = false,
    onopen,
  }: {
    preview: PortalPreview;
    /** Overrides preview.title (the node's own title). */
    title?: string;
    selected?: boolean;
    onopen?: () => void;
  } = $props();

  const kindIcon: Record<string, IconName> = { map: 'map', investigation: 'hypothesis', flow: 'flow', notes: 'note' };
  const icon = $derived(kindIcon[preview.kind ?? 'map'] ?? 'map');
  const rects = $derived(preview.rects ?? []);

  const view = $derived.by(() => {
    if (!rects.length) return { x: 0, y: 0, w: 100, h: 60 };
    const x1 = Math.min(...rects.map((r) => r.x));
    const y1 = Math.min(...rects.map((r) => r.y));
    const x2 = Math.max(...rects.map((r) => r.x + r.width));
    const y2 = Math.max(...rects.map((r) => r.y + r.height));
    const pad = Math.max(x2 - x1, y2 - y1) * 0.04;
    return { x: x1 - pad, y: y1 - pad, w: x2 - x1 + 2 * pad, h: y2 - y1 + 2 * pad };
  });
  // groups first so they sit behind the nodes
  const ordered = $derived([...rects.filter((r) => r.type === 'group'), ...rects.filter((r) => r.type !== 'group')]);
  const sw = $derived(Math.max(view.w, view.h) / 220);
  const count = $derived(`${preview.nodeCount} ${preview.nodeCount === 1 ? 'node' : 'nodes'}`);
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="card" class:selected class:error={!!preview.error} ondblclick={() => !preview.error && onopen?.()}>
  <div class="thumb">
    {#if preview.error}
      <div class="err" role="alert">
        <Icon name="warning" size={16} />
        <span>{preview.error}</span>
      </div>
    {:else if !rects.length}
      <div class="err muted"><span>Empty canvas</span></div>
    {:else}
      <svg viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        {#each ordered as r, i (i)}
          {@const c = canvasColor(r.color) ?? 'var(--vscode-descriptionForeground, #9d9d9d)'}
          {#if r.type === 'group'}
            <rect x={r.x} y={r.y} width={r.width} height={r.height} rx={sw * 3} fill="none" stroke={c} stroke-opacity={r.color ? 0.8 : 0.5} stroke-width={sw} />
          {:else}
            <rect
              x={r.x}
              y={r.y}
              width={r.width}
              height={r.height}
              rx={sw * 1.5}
              fill={`color-mix(in srgb, ${c} ${r.color ? 45 : 22}%, transparent)`}
              stroke={c}
              stroke-opacity={r.color ? 1 : 0.55}
              stroke-width={sw * 0.7}
            />
          {/if}
        {/each}
      </svg>
    {/if}
  </div>
  <div class="foot">
    <span class="glyph" title={preview.kind ?? 'map'}><Icon name={icon} /></span>
    <div class="text">
      <span class="title">{title || preview.title}</span>
      <span class="meta">{count}</span>
    </div>
    <button type="button" class="open nodrag" disabled={!!preview.error} onclick={onopen}>
      <span>Open</span><Icon name="chevronRight" size={12} />
    </button>
  </div>
</div>

<style>
  .card {
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: var(--vscode-editorWidget-background, #252526);
    color: var(--vscode-editor-foreground, #d4d4d4);
    border: 1px solid var(--vscode-editorWidget-border, var(--vscode-panel-border, #454545));
    border-radius: 6px;
    font-family: var(--vscode-font-family, system-ui, sans-serif);
  }
  .card.selected {
    border-color: var(--vscode-focusBorder, #007fd4);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--vscode-focusBorder, #007fd4) 35%, transparent);
  }
  .thumb {
    flex: 1;
    min-height: 0;
    padding: 8px;
    background: var(--vscode-editor-background, #1e1e1e);
    border-bottom: 1px solid var(--vscode-editorWidget-border, #454545);
    cursor: grab;
  }
  svg {
    display: block;
    width: 100%;
    height: 100%;
  }
  .err {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    height: 100%;
    padding: 0 16px;
    color: var(--vscode-errorForeground, #f48771);
    font-size: 12px;
    text-align: center;
  }
  .err.muted {
    color: var(--vscode-descriptionForeground, #9d9d9d);
  }
  .foot {
    display: flex;
    flex: none;
    align-items: center;
    gap: 8px;
    height: 48px;
    box-sizing: border-box;
    padding: 0 8px 0 12px;
  }
  .glyph {
    display: grid;
    color: var(--vscode-descriptionForeground, #9d9d9d);
  }
  .text {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
  }
  .title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    /* Grows with --cv-label-scale when the canvas is zoomed out, like group labels. */
    font-size: calc(13px * var(--cv-label-scale, 1));
    font-weight: 600;
    line-height: 1.35;
  }
  .meta {
    color: var(--vscode-descriptionForeground, #9d9d9d);
    font-size: calc(11px * var(--cv-label-scale, 1));
    line-height: 1.3;
  }
  .open {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    height: 24px;
    padding: 0 8px;
    border: 0;
    border-radius: 4px;
    background: var(--vscode-button-secondaryBackground, #3a3d41);
    color: var(--vscode-button-secondaryForeground, #ccc);
    font: inherit;
    font-size: 12px;
    cursor: pointer;
  }
  .open:hover:not(:disabled) {
    background: var(--vscode-button-secondaryHoverBackground, #45494e);
  }
  .open:focus-visible {
    outline: 1px solid var(--vscode-focusBorder, #007fd4);
    outline-offset: 1px;
  }
  .open:disabled {
    opacity: 0.4;
    cursor: default;
  }
</style>
