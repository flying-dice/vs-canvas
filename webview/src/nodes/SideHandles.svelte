<script lang="ts">
  import { Handle, Position } from '@xyflow/svelte';

  const sides = [
    ['top', Position.Top],
    ['right', Position.Right],
    ['bottom', Position.Bottom],
    ['left', Position.Left],
  ] as const;
</script>

<!-- Per side, a target `in-<side>` and a source `out-<side>` stacked at the same spot (ConnectionMode.Loose). -->
{#each sides as [side, position] (side)}
  <Handle type="target" {position} id={`in-${side}`} class="h-side" />
  <Handle type="source" {position} id={`out-${side}`} class="h-side" />
{/each}
