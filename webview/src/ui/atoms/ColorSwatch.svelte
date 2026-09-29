<script lang="ts">
  import { canvasColor } from '../../lib/colors';

  let {
    color,
    size = 14,
    selected = false,
    title,
    onclick,
  }: {
    /** Canvas color ("1"-"6" or hex); undefined draws an empty "no color" swatch. */
    color?: string;
    size?: number;
    selected?: boolean;
    title?: string;
    onclick?: () => void;
  } = $props();
  const css = $derived(canvasColor(color));
</script>

<button
  type="button"
  class="swatch nodrag"
  class:selected
  class:none={!css}
  style={`--c: ${css ?? 'transparent'}; width:${size}px; height:${size}px`}
  {title}
  aria-label={title ?? color ?? 'no color'}
  aria-pressed={selected}
  {onclick}
></button>

<style>
  .swatch {
    flex: none;
    padding: 0;
    border-radius: 50%;
    background: var(--c);
    border: 1px solid color-mix(in srgb, var(--c) 60%, var(--vscode-editor-foreground, #ccc));
    cursor: pointer;
  }
  .swatch.none {
    border: 1px dashed var(--vscode-descriptionForeground, #888);
  }
  .swatch.selected {
    outline: 2px solid var(--vscode-focusBorder, #007fd4);
    outline-offset: 1px;
  }
</style>
