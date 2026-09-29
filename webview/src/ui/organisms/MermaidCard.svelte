<script lang="ts">
  import Card from '../atoms/Card.svelte';
  import MermaidDiagram from '../atoms/MermaidDiagram.svelte';
  import EditableText from '../molecules/EditableText.svelte';
  import { canvasColor } from '../../lib/colors';

  let {
    source,
    title,
    color,
    selected = false,
    mode = 'dark',
    editing = $bindable(false),
    oncommit,
  }: {
    /** Mermaid source (no fence). */
    source: string;
    title?: string;
    color?: string;
    selected?: boolean;
    mode?: 'dark' | 'light';
    editing?: boolean;
    oncommit?: (text: string) => void;
  } = $props();
</script>

<Card {selected} accent={canvasColor(color)} class="mermaid-card">
  {#if title}<div class="title">{title}</div>{/if}
  <div class="body">
    <EditableText value={source} bind:editing mono {oncommit} placeholder="flowchart LR&#10;  A --> B">
      <div class="diagram"><MermaidDiagram {source} {mode} /></div>
    </EditableText>
  </div>
</Card>

<style>
  :global(.mermaid-card) {
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
    padding: 6px;
  }
  .diagram {
    width: 100%;
    height: 100%;
    overflow: hidden;
  }
</style>
