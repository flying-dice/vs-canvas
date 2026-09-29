<script lang="ts">
  let {
    zoom,
    onreset,
  }: {
    /** Canvas zoom, 1 = 100%. */
    zoom: number;
    /** Click resets the zoom to 100%. */
    onreset?: () => void;
  } = $props();

  const pct = $derived(Math.round(zoom * 100));
  const atDefault = $derived(pct === 100);
</script>

<button
  type="button"
  class="zoom nodrag nopan"
  class:default={atDefault}
  title={atDefault ? 'Zoom 100%' : 'Reset zoom to 100%'}
  aria-label={`Zoom ${pct}%${atDefault ? '' : ', reset to 100%'}`}
  onclick={onreset}
>
  {pct}%
</button>

<style>
  .zoom {
    min-width: 48px;
    height: 24px;
    padding: 0 8px;
    border: 1px solid transparent;
    border-radius: 4px;
    background: transparent;
    color: var(--vscode-descriptionForeground, #9d9d9d);
    font-family: var(--vscode-font-family, system-ui, sans-serif);
    font-size: 11px;
    font-variant-numeric: tabular-nums;
    text-align: center;
    cursor: pointer;
    transition: background-color 120ms ease, color 120ms ease;
  }
  .zoom:hover {
    background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
    color: var(--vscode-editor-foreground, #ccc);
  }
  .zoom.default {
    cursor: default;
  }
  .zoom:focus-visible {
    outline: 1px solid var(--vscode-focusBorder, #007fd4);
    outline-offset: 1px;
  }
  @media (prefers-reduced-motion: reduce) {
    .zoom {
      transition: none;
    }
  }
</style>
