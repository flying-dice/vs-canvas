<script lang="ts">
  import { canvasColor } from '../../lib/colors';
  let { color, label }: { color?: string; label: string } = $props();
</script>

<span class="pill" style={`--pc: ${canvasColor(color) ?? canvasColor('3')}`}>{label}</span>

<style>
  .pill {
    position: absolute;
    right: 8px;
    top: 1px;
    height: 16px;
    line-height: 16px;
    padding: 0 7px;
    border-radius: 8px;
    font-family: var(--vscode-font-family, system-ui, sans-serif);
    font-size: 10px;
    white-space: nowrap;
    background: color-mix(in srgb, var(--pc) 35%, var(--vscode-editor-background, #1e1e1e));
    border: 1px solid var(--pc);
    color: var(--vscode-editor-foreground, #ccc);
    pointer-events: none;
  }
</style>
