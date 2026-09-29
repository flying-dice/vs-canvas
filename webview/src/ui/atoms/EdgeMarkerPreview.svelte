<script lang="ts">
  import type { EdgeMarker } from '../../../../src/shared/canvasFile';
  import { MARKER_GLYPHS, dashFor } from '../../lib/shapes/markers';

  // A short line with the given end markers: the relation picker and the marker gallery. Uses currentColor.
  let {
    fromMarker = 'none',
    toMarker = 'arrow',
    lineStyle = 'solid',
    width = 72,
    height = 16,
  }: {
    fromMarker?: EdgeMarker;
    toMarker?: EdgeMarker;
    lineStyle?: 'solid' | 'dashed' | 'dotted';
    width?: number;
    height?: number;
  } = $props();

  const dash = $derived(dashFor(lineStyle));
  const pad = 3;
</script>

<svg {width} {height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
  <path d={`M${pad} ${height / 2}H${width - pad}`} class="line" stroke-dasharray={dash.dash} stroke-linecap={dash.cap ?? 'butt'} />
  <g transform={`translate(${pad} ${height / 2}) scale(-1 1)`}>
    {#each MARKER_GLYPHS[fromMarker] as g, i (i)}<path d={g.d} class={['mk', g.fill]} />{/each}
  </g>
  <g transform={`translate(${width - pad} ${height / 2})`}>
    {#each MARKER_GLYPHS[toMarker] as g, i (i)}<path d={g.d} class={['mk', g.fill]} />{/each}
  </g>
</svg>

<style>
  svg {
    display: block;
    flex: none;
    overflow: visible;
  }
  path {
    fill: none;
    stroke: currentColor;
    stroke-width: 1.5;
    stroke-linejoin: round;
    stroke-linecap: round;
  }
  .line {
    stroke-linecap: inherit;
  }
  .mk.ink {
    fill: currentColor;
  }
  .mk.bg {
    fill: var(--vscode-editorWidget-background, #252526);
  }
</style>
