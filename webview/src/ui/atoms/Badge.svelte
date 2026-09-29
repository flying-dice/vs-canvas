<script lang="ts">
  import type { Snippet } from 'svelte';
  let { children }: { children: Snippet } = $props();
</script>

<span class="badge">{@render children()}</span>

<style>
  .badge {
    display: inline-block;
    flex: none;
    padding: 1px 7px;
    border-radius: 10px;
    background: var(--vscode-badge-background, #4d4d4d);
    color: var(--vscode-badge-foreground, #fff);
    font-family: var(--vscode-font-family, system-ui, sans-serif);
    font-size: 11px;
  }
</style>
