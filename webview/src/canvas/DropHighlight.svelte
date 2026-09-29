<script lang="ts">
  import { ui } from '../lib/ui.svelte';

  // While an arrow is dragged: outline the node it would connect to and, for code, the line under the pointer.
  // Rendered inside a ViewportPortal (flow coordinates).
  let { zoom = 1 }: { zoom?: number } = $props();
  const t = $derived(ui.dropTarget);
  const k = $derived(Math.min(2.5, 1 / (zoom || 1)));
</script>

{#if t}
  <div class="target" style={`transform: translate(${t.x}px, ${t.y}px); width:${t.w}px; height:${t.h}px; --k:${k}`}>
    {#if t.line}
      <div class="line" style={`top:${t.line.y - t.y}px; height:${t.line.h}px`}>
        <span class="dot" class:right={t.snap.side === 'right'}></span>
        <span class="tag">L{t.line.n}</span>
      </div>
    {/if}
  </div>
{/if}

<style>
  .target {
    position: absolute;
    left: 0;
    top: 0;
    box-sizing: border-box;
    border: calc(2px * var(--k)) solid var(--vscode-focusBorder, #007fd4);
    border-radius: 6px;
    background: color-mix(in srgb, var(--vscode-focusBorder, #007fd4) 8%, transparent);
    pointer-events: none;
    z-index: 4;
  }
  .line {
    position: absolute;
    left: 0;
    right: 0;
    background: color-mix(in srgb, var(--vscode-focusBorder, #007fd4) 28%, transparent);
    border-top: 1px solid var(--vscode-focusBorder, #007fd4);
    border-bottom: 1px solid var(--vscode-focusBorder, #007fd4);
  }
  .dot {
    position: absolute;
    top: 50%;
    left: 0;
    width: calc(10px * var(--k));
    height: calc(10px * var(--k));
    border-radius: 50%;
    background: var(--vscode-focusBorder, #007fd4);
    border: calc(2px * var(--k)) solid var(--vscode-editor-background, #1e1e1e);
    transform: translate(-50%, -50%);
  }
  .dot.right {
    left: auto;
    right: 0;
    transform: translate(50%, -50%);
  }
  .tag {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    padding: 0 6px;
    border-radius: 3px;
    background: var(--vscode-focusBorder, #007fd4);
    color: var(--vscode-button-foreground, #fff);
    font: 600 calc(11px * var(--k)) / 1.5 var(--vscode-font-family, system-ui, sans-serif);
    font-variant-numeric: tabular-nums;
  }
</style>
