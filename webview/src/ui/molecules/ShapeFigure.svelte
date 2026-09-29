<script lang="ts">
  import type { ShapeGeometry } from '../../lib/shapes/renderers';

  // The drawn part of a shape: silhouette + decorations + selection ring, as one SVG at 1 user unit = 1 px.
  // Colours come from --sc-* custom properties set by an ancestor (see lib/shapes/tone.ts). Strokes are 1.5px and
  // non-scaling, so outlines stay crisp at any canvas zoom.
  let {
    geo,
    width,
    height,
    selected = false,
    ring = true,
  }: { geo: ShapeGeometry; width: number; height: number; selected?: boolean; ring?: boolean } = $props();
</script>

<svg class="fig" class:selected width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
  {#if selected && ring}<path class="ring" d={geo.outline} />{/if}
  <path
    class={['outline', geo.outlineFill ?? 'surface']}
    d={geo.outline}
    style:stroke-width={geo.outlineWidth}
    style:stroke-dasharray={geo.outlineDash}
  />
  {#each geo.decorations as dc, i (i)}
    <path
      class={['deco', `f-${dc.fill ?? 'none'}`, dc.muted && 'muted']}
      d={dc.d}
      style:stroke-width={dc.width}
      style:stroke-dasharray={dc.dash}
    />
  {/each}
</svg>

<style>
  .fig {
    position: absolute;
    left: 0;
    top: 0;
    overflow: visible;
    pointer-events: none;
  }
  path {
    vector-effect: non-scaling-stroke;
    stroke-linejoin: round;
    stroke-linecap: round;
  }
  .outline {
    fill: var(--sc-fill);
    stroke: var(--sc-stroke);
    stroke-width: 1.5;
  }
  .outline.none {
    fill: none;
  }
  .outline.ink {
    fill: var(--sc-ink);
  }
  .outline.tint {
    fill: color-mix(in srgb, var(--sc-stroke) 6%, transparent);
  }
  .selected .outline {
    stroke: var(--vscode-focusBorder, #007fd4);
  }
  /* 1px focus border plus a 2px outer ring at 35% (design.md), drawn as a wider stroke underneath. */
  .ring {
    fill: none;
    stroke: var(--vscode-focusBorder, #007fd4);
    stroke-opacity: 0.35;
    stroke-width: 5.5;
  }
  .deco {
    fill: none;
    stroke: var(--sc-stroke);
    stroke-width: 1.5;
  }
  .deco.muted {
    stroke: var(--vscode-descriptionForeground, #9d9d9d);
  }
  .f-surface {
    fill: var(--sc-fill);
  }
  .f-ink {
    fill: var(--sc-ink);
  }
  .f-bg {
    fill: var(--sc-bg);
  }
  .f-shade {
    fill: color-mix(in srgb, var(--vscode-editor-foreground, #ccc) 8%, transparent);
  }
  .f-muted {
    fill: var(--vscode-descriptionForeground, #9d9d9d);
    stroke: none;
  }
</style>
