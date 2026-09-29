<script lang="ts">
  import { canvasColor } from '../../lib/colors';
  import EditableText from '../molecules/EditableText.svelte';
  import MarkdownBody from '../molecules/MarkdownBody.svelte';

  let {
    text,
    color,
    selected = false,
    mode = 'dark',
    editing = $bindable(false),
    oncommit,
  }: {
    text: string;
    color?: string;
    selected?: boolean;
    mode?: 'dark' | 'light';
    editing?: boolean;
    oncommit?: (text: string) => void;
  } = $props();

  const c = $derived(canvasColor(color));
</script>

<div class="label" class:selected style={c ? `--tc: ${c}` : ''}>
  <EditableText value={text} bind:editing {oncommit}>
    {#if text.trim()}
      <MarkdownBody markdown={text} {mode} nodrag={false} />
    {:else}
      <div class="empty">Double-click to edit</div>
    {/if}
  </EditableText>
</div>

<style>
  .label {
    box-sizing: border-box;
    width: 100%;
    height: 100%;
    overflow: hidden;
    border: 1px dashed transparent;
    border-radius: 4px;
    color: var(--tc, var(--vscode-editor-foreground, #d4d4d4));
    font-size: 16px;
  }
  .label.selected {
    border-color: var(--vscode-focusBorder, #007fd4);
  }
  .label :global(.md) {
    font-size: 16px;
    padding: 4px 6px;
  }
  .label :global(h1) { font-size: 2em; }
  .label :global(h2) { font-size: 1.6em; }
  .label :global(h3) { font-size: 1.25em; }
  .empty {
    padding: 4px 6px;
    color: var(--vscode-descriptionForeground, #9d9d9d);
    font-style: italic;
  }
</style>
