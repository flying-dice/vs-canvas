<script lang="ts">
  import { canvasColor } from '../../lib/colors';

  let {
    label,
    color,
    selected = false,
  }: { label?: string; color?: string; selected?: boolean } = $props();

  const c = $derived(canvasColor(color) ?? 'var(--vscode-descriptionForeground, #9d9d9d)');
</script>

<!-- The frame itself is click-through (see the .group-node rule in app.css); only the label tab takes pointer events. -->
<div class="frame" class:selected style={`--c: ${c}`}>
  <div class="group-label" title={label}>{label || 'Group'}</div>
</div>

<style>
  .frame {
    box-sizing: border-box;
    position: relative;
    width: 100%;
    height: 100%;
    background: color-mix(in srgb, var(--c) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--c) 55%, transparent);
    border-radius: 8px;
  }
  .frame.selected {
    border-color: var(--vscode-focusBorder, #007fd4);
  }
  .group-label {
    position: absolute;
    top: -1px;
    left: -1px;
    max-width: 70%;
    box-sizing: border-box;
    padding: calc(2px * var(--cv-label-scale, 1)) calc(10px * var(--cv-label-scale, 1));
    border-radius: 8px 0 8px 0;
    background: color-mix(in srgb, var(--c) 35%, var(--vscode-editor-background, #1e1e1e));
    border: 1px solid color-mix(in srgb, var(--c) 55%, transparent);
    color: var(--vscode-editor-foreground, #ccc);
    font-family: var(--vscode-font-family, system-ui, sans-serif);
    font-size: calc(12px * var(--cv-label-scale, 1));
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    cursor: grab;
    pointer-events: all;
  }
</style>
