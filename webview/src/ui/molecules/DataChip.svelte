<script lang="ts">
  import { fade } from 'svelte/transition';
  import { dur } from '../../lib/motion';

  let {
    text,
    truncate = 40,
  }: {
    /** Payload text at this point of the flow, e.g. "Order{ id: 812, total: 49.00 }". Empty hides the chip. */
    text?: string;
    /** Max characters shown; the full text stays in the tooltip. */
    truncate?: number;
  } = $props();

  const shown = $derived(text && text.length > truncate ? text.slice(0, truncate - 1) + '…' : text);
</script>

<!-- Positioned by the caller (e.g. next to the packet). Changing `text` crossfades. -->
{#if text}
  <div class="chip" title={text} role="status">
    {#key text}
      <span class="t" in:fade={{ duration: dur(140), delay: dur(100) }} out:fade={{ duration: dur(100) }}>{shown}</span>
    {/key}
    <!-- invisible copy sizes the chip to the new text while the old one fades -->
    <span class="t ghost" aria-hidden="true">{shown}</span>
  </div>
{/if}

<style>
  .chip {
    display: inline-grid;
    box-sizing: border-box;
    max-width: 320px;
    padding: 2px 8px;
    border: 1px solid var(--vscode-terminal-ansiCyan, #29b8db);
    border-radius: 4px;
    background: var(--vscode-editorWidget-background, #252526);
    color: var(--vscode-editor-foreground, #ccc);
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: 12px;
    line-height: 18px;
    white-space: nowrap;
    pointer-events: none;
  }
  .t {
    grid-area: 1 / 1;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .ghost {
    visibility: hidden;
  }
</style>
