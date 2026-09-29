<script lang="ts">
  import Icon from '../atoms/Icon.svelte';
  import Badge from '../atoms/Badge.svelte';

  let {
    file,
    lines,
    title,
    onclick,
  }: {
    file: string;
    lines?: [number, number];
    title?: string;
    onclick?: () => void;
  } = $props();

  const range = $derived(lines ? (lines[0] === lines[1] ? `L${lines[0]}` : `L${lines[0]}–${lines[1]}`) : null);
  const base = $derived(file.split('/').pop() ?? file);
</script>

<button type="button" class="chip nodrag" title={`Open ${file}`} {onclick}>
  <Icon name="file" />
  <span class="text">
    <span class="name">{base}</span>
    {#if title}<span class="title">{title}</span>{:else if file !== base}<span class="title">{file}</span>{/if}
  </span>
  {#if range}<Badge>{range}</Badge>{/if}
</button>

<style>
  .chip {
    display: flex;
    align-items: center;
    gap: 8px;
    max-width: 100%;
    box-sizing: border-box;
    padding: 6px 10px;
    border: none;
    background: transparent;
    color: var(--vscode-textLink-foreground, #3794ff);
    font-family: var(--vscode-font-family, system-ui, sans-serif);
    font-size: 13px;
    text-align: left;
    cursor: pointer;
  }
  .chip:hover .name {
    text-decoration: underline;
  }
  .text {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .name {
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .title {
    color: var(--vscode-descriptionForeground, #9d9d9d);
    font-size: 11px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
