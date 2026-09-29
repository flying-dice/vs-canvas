<script lang="ts">
  import type { Snippet } from 'svelte';
  import Badge from '../atoms/Badge.svelte';

  let {
    path,
    relPath,
    title,
    badge,
    class: cls = '',
    handles,
  }: {
    path?: string;
    relPath: string;
    title?: string;
    badge?: string;
    class?: string;
    /** Rendered inside the header (position: relative), e.g. graph handles. */
    handles?: Snippet;
  } = $props();
</script>

<div class={['header', cls]}>
  {@render handles?.()}
  <span class="path" title={path ?? relPath}>{relPath}</span>
  {#if title}<span class="title">{title}</span>{/if}
  {#if badge}<span class="push"><Badge>{badge}</Badge></span>{/if}
</div>

<style>
  .header {
    position: relative;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    background: var(--vscode-editorWidget-background, #252526);
    border-bottom: 1px solid var(--vscode-panel-border, var(--vscode-editorWidget-border, #454545));
    color: var(--vscode-editor-foreground, #d4d4d4);
    font-family: var(--vscode-font-family, system-ui, sans-serif);
    font-size: 12px;
    cursor: grab;
  }
  .path {
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .title {
    color: var(--vscode-descriptionForeground, #9d9d9d);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .push {
    margin-left: auto;
    display: flex;
  }
</style>
