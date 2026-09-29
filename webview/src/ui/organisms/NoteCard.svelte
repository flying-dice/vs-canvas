<script lang="ts">
  import { canvasColor } from '../../lib/colors';
  import Card from '../atoms/Card.svelte';
  import EditableText from '../molecules/EditableText.svelte';
  import MarkdownBody from '../molecules/MarkdownBody.svelte';

  let {
    text,
    title,
    color,
    selected = false,
    mode = 'dark',
    editing = $bindable(false),
    oncommit,
  }: {
    text: string;
    title?: string;
    color?: string;
    selected?: boolean;
    mode?: 'dark' | 'light';
    editing?: boolean;
    oncommit?: (text: string) => void;
  } = $props();

  const accent = $derived(canvasColor(color) ?? 'var(--vscode-textLink-foreground, #3794ff)');
</script>

<Card {selected} {accent} class="note-card">
  {#if title}<div class="title">{title}</div>{/if}
  <div class="body">
    <EditableText value={text} bind:editing {oncommit}>
      {#if text.trim()}
        <MarkdownBody markdown={text} {mode} />
      {:else}
        <div class="empty">Double-click to edit</div>
      {/if}
    </EditableText>
  </div>
</Card>

<style>
  :global(.note-card) {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .title {
    padding: 8px 12px 0;
    font-family: var(--vscode-font-family, system-ui, sans-serif);
    font-size: 13px;
    font-weight: 600;
    cursor: grab;
  }
  .body {
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }
  .empty {
    padding: 8px 12px;
    color: var(--vscode-descriptionForeground, #9d9d9d);
    font-family: var(--vscode-font-family, system-ui, sans-serif);
    font-size: 13px;
    font-style: italic;
  }
</style>
