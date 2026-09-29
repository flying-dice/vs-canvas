<script lang="ts">
  import type { DistanceLabel, Guide } from '../../lib/snapping';

  let {
    guides = [],
    distances = [],
    zoom = 1,
  }: {
    guides?: Guide[];
    distances?: DistanceLabel[];
    /** Canvas zoom: keeps lines 1px and labels 11px on screen. */
    zoom?: number;
  } = $props();

  const z = $derived(zoom > 0 ? zoom : 1);
  const font = $derived(11 / z);
  const labelH = $derived(16 / z);
  const round = (v: number) => Math.round(v);
  const labelW = (v: number) => (String(round(v)).length * 6.6 + 8) / z;
</script>

<!-- Render inside a ViewportPortal (flow coordinates). A 1x1 anchor with visible overflow keeps flow units. -->
<svg class="guides" width="1" height="1" aria-hidden="true">
  {#each guides as g, i (i + ':' + g.axis + ':' + g.pos)}
    {#if g.axis === 'x'}
      <line x1={g.pos} x2={g.pos} y1={g.from} y2={g.to} class:center={g.kind === 'center'} vector-effect="non-scaling-stroke" />
    {:else}
      <line x1={g.from} x2={g.to} y1={g.pos} y2={g.pos} class:center={g.kind === 'center'} vector-effect="non-scaling-stroke" />
    {/if}
  {/each}
  {#each distances as d, i (i + ':' + d.axis + ':' + d.from)}
    {@const w = labelW(d.value)}
    {@const cx = d.axis === 'x' ? (d.from + d.to) / 2 : d.at}
    {@const cy = d.axis === 'x' ? d.at : (d.from + d.to) / 2}
    {#if d.axis === 'x'}
      <line class="gap" x1={d.from} x2={d.to} y1={d.at} y2={d.at} vector-effect="non-scaling-stroke" />
    {:else}
      <line class="gap" x1={d.at} x2={d.at} y1={d.from} y2={d.to} vector-effect="non-scaling-stroke" />
    {/if}
    <rect class="chip" x={cx - w / 2} y={cy - labelH / 2} width={w} height={labelH} rx={3 / z} />
    <text x={cx} y={cy} font-size={font} text-anchor="middle" dominant-baseline="central">{round(d.value)}</text>
  {/each}
</svg>

<style>
  .guides {
    position: absolute;
    left: 0;
    top: 0;
    overflow: visible;
    pointer-events: none;
    --g: var(--vscode-focusBorder, #007fd4);
  }
  line {
    stroke: var(--g);
    stroke-width: 1px;
  }
  line.center {
    stroke-dasharray: 4 3;
  }
  line.gap {
    stroke-width: 1px;
    opacity: 0.6;
  }
  .chip {
    fill: var(--g);
  }
  text {
    fill: var(--vscode-button-foreground, #fff);
    font-family: var(--vscode-font-family, system-ui, sans-serif);
    font-variant-numeric: tabular-nums;
    user-select: none;
  }
</style>
