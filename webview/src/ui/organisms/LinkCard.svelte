<script lang="ts">
  import Card from '../atoms/Card.svelte';
  import Icon from '../atoms/Icon.svelte';
  import { canvasColor } from '../../lib/colors';

  let {
    url,
    title,
    color,
    selected = false,
    onopen,
  }: {
    url: string;
    title?: string;
    color?: string;
    selected?: boolean;
    onopen?: () => void;
  } = $props();

  const host = $derived.by(() => {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  });
</script>

<Card {selected} accent={canvasColor(color)} class="link-card">
  <button type="button" class="link" title={`Open ${url}`} onclick={onopen}>
    <Icon name="link" size={18} />
    <span class="text">
      <span class="title">{title || host}</span>
      <span class="host">{host}</span>
      <span class="url">{url}</span>
    </span>
  </button>
</Card>

<style>
  :global(.link-card) {
    width: 100%;
    height: 100%;
    overflow: hidden;
  }
  .link {
    display: flex;
    align-items: center;
    gap: 10px;
    box-sizing: border-box;
    width: 100%;
    height: 100%;
    padding: 8px 12px;
    border: none;
    background: transparent;
    color: var(--vscode-textLink-foreground, #3794ff);
    font-family: var(--vscode-font-family, system-ui, sans-serif);
    text-align: left;
    cursor: pointer;
  }
  .text {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .title {
    font-size: 13px;
    font-weight: 600;
  }
  .link:hover .title {
    text-decoration: underline;
  }
  .host {
    color: var(--vscode-editor-foreground, #ccc);
    font-size: 11px;
  }
  .url {
    color: var(--vscode-descriptionForeground, #9d9d9d);
    font-size: 11px;
  }
  .title, .host, .url {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
