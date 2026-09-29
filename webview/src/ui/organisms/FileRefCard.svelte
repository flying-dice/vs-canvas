<script lang="ts">
  import Card from '../atoms/Card.svelte';
  import FileChip from '../molecules/FileChip.svelte';
  import { canvasColor } from '../../lib/colors';

  let {
    file,
    lines,
    title,
    color,
    selected = false,
    onopen,
  }: {
    file: string;
    lines?: [number, number];
    title?: string;
    color?: string;
    selected?: boolean;
    onopen?: () => void;
  } = $props();
</script>

<Card {selected} accent={canvasColor(color)} class="fileref-card">
  <FileChip {file} {lines} {title} onclick={onopen} />
</Card>

<style>
  :global(.fileref-card) {
    min-width: 200px;
    max-width: 480px;
    width: fit-content;
  }
</style>
