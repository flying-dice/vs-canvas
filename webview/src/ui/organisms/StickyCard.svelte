<script lang="ts">
  import { canvasColor } from '../../lib/colors';
  import EditableText from '../molecules/EditableText.svelte';

  let {
    text,
    color,
    selected = false,
    editing = $bindable(false),
    oncommit,
  }: {
    text: string;
    color?: string;
    selected?: boolean;
    editing?: boolean;
    oncommit?: (text: string) => void;
  } = $props();

  const c = $derived(canvasColor(color ?? '3'));
</script>

<div class="sticky" class:selected class:editing style={`--c: ${c}`}>
  <EditableText value={text} bind:editing {oncommit}>
    {#if text.trim()}
      <div class="text">{text}</div>
    {:else}
      <div class="text empty">Double-click to edit</div>
    {/if}
  </EditableText>
</div>

<style>
  .sticky {
    box-sizing: border-box;
    width: 100%;
    height: 100%;
    padding: 10px 12px;
    overflow: hidden;
    background: color-mix(in srgb, var(--c) 38%, var(--vscode-editor-background, #1e1e1e));
    color: var(--vscode-editor-foreground, #d4d4d4);
    border: 1px solid color-mix(in srgb, var(--c) 70%, transparent);
    border-radius: 3px;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
    font-family: var(--vscode-font-family, system-ui, sans-serif);
    font-size: 14px;
    line-height: 1.4;
  }
  .sticky.selected {
    border-color: var(--vscode-focusBorder, #007fd4);
  }
  .sticky.editing {
    padding: 4px;
  }
  .text {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    height: 100%;
    overflow: hidden;
  }
  .empty {
    color: var(--vscode-descriptionForeground, #9d9d9d);
    font-style: italic;
  }
</style>
