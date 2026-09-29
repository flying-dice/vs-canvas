<script lang="ts">
  import type { Snippet } from 'svelte';
  let {
    selected = false,
    accent,
    children,
    class: cls = '',
  }: { selected?: boolean; accent?: string; children: Snippet; class?: string } = $props();
</script>

<div class={['card', cls, accent && 'accented']} class:selected style={accent ? `--accent: ${accent}` : ''}>
  {@render children()}
</div>

<style>
  .card {
    box-sizing: border-box;
    background: var(--vscode-editorWidget-background, #252526);
    color: var(--vscode-editor-foreground, #d4d4d4);
    border: 1px solid var(--vscode-editorWidget-border, var(--vscode-panel-border, #454545));
    border-radius: 6px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }
  .card.accented {
    border-top: 3px solid var(--accent);
  }
  .card.selected {
    border-color: var(--vscode-focusBorder, #007fd4);
  }
  .card.accented.selected {
    border-top-color: var(--accent);
  }
</style>
