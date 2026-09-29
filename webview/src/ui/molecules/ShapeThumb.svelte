<script lang="ts">
  import { shapeById } from '../../../../src/shared/shapes';
  import { geometryFor } from '../../lib/shapes/renderers';
  import { toneStyle } from '../../lib/shapes/tone';
  import ShapeFigure from './ShapeFigure.svelte';

  // A live-rendered miniature of a shape (palette, quick-add menu): the real renderer at the shape's default size,
  // scaled to fit `width` x `height`, plus a wireframe hint of the label. Strokes stay 1.5px (non-scaling).
  let {
    shape,
    width = 88,
    height = 48,
    pad = 4,
  }: { shape: string; width?: number; height?: number; pad?: number } = $props();

  const def = $derived(shapeById(shape));
  const nat = $derived<[number, number]>(def?.size ?? [160, 80]);
  // Very small shapes are not blown up past 1.4x.
  const k = $derived(Math.min((width - 2 * pad) / nat[0], (height - 2 * pad) / nat[1], 1.4));
  const geo = $derived(geometryFor(shape, nat[0], nat[1], { label: 'Name' }));
  const tone = $derived(def?.frame ? 'frame' : (def?.tone ?? 'default'));
  const ox = $derived((width - nat[0] * k) / 2);
  const oy = $derived((height - nat[1] * k) / 2);

  type Bar = { x: number; y: number; w: number; soft?: boolean };
  const tb = $derived(geo.textBox);
  const bars = $derived.by<Bar[]>(() => {
    if (!def || def.frame || tb.w < 20 || tb.h < 10 || geo.labelOutside) return [];
    const cx = tb.x + tb.w / 2;
    const bar = (y: number, w: number, soft = false): Bar => ({ x: cx - w / 2, y, w, soft });
    switch (def.layout) {
      case 'center':
        return [bar(tb.y + tb.h / 2 - 2, Math.min(tb.w * 0.7, 72))];
      case 'top':
      case 'below': {
        const y = tb.y + Math.min(8, tb.h / 4);
        return [bar(y, Math.min(tb.w * 0.55, 80)), bar(y + 14, Math.min(tb.w * 0.8, 120), true)];
      }
      default:
        return [];
    }
  });
  /** Horizontal dividers and row hints for compartment / table layouts. */
  const lines = $derived.by<{ y: number; x: number; w: number; soft?: boolean }[]>(() => {
    if (!def) return [];
    const [w, h] = nat;
    if (def.layout === 'compartments') {
      const head = def.id === 'uml.state' ? 28 : 34;
      const out: { y: number; x: number; w: number; soft?: boolean }[] = [{ y: head, x: 0, w }, { y: head / 2 - 2, x: w * 0.3, w: w * 0.4 }];
      if (def.id === 'uml.class') out.push({ y: head + (h - head) / 2, x: 0, w });
      return out;
    }
    if (def.layout === 'table') {
      const rows = [46, 68, 90, 112].filter((y) => y < h - 10).map((y) => ({ y, x: 20, w: w * 0.4, soft: true }));
      return [{ y: 30, x: 0, w }, { y: 10, x: 12, w: w * 0.35, soft: false }, ...rows];
    }
    return [];
  });
</script>

<div class="thumb" style={`width:${width}px;height:${height}px;${toneStyle(tone)}`} aria-hidden="true">
  <div class="nat" style={`left:${ox}px;top:${oy}px;width:${nat[0]}px;height:${nat[1]}px;transform:scale(${k})`}>
    <ShapeFigure {geo} width={nat[0]} height={nat[1]} ring={false} />
    {#each bars as b, i (i)}<span class="bar" class:soft={b.soft} style={`left:${b.x}px;top:${b.y}px;width:${b.w}px`}></span>{/each}
    {#each lines as l, i (i)}
      {#if l.w === nat[0] && l.x === 0}
        <span class="rule" style={`top:${l.y}px`}></span>
      {:else}
        <span class="bar" class:soft={l.soft} style={`left:${l.x}px;top:${l.y}px;width:${l.w}px`}></span>
      {/if}
    {/each}
  </div>
</div>

<style>
  .thumb {
    position: relative;
    flex: none;
    overflow: hidden;
  }
  .nat {
    position: absolute;
    transform-origin: 0 0;
  }
  .bar {
    position: absolute;
    height: 4px;
    border-radius: 2px;
    background: var(--vscode-editor-foreground, #ccc);
    opacity: 0.55;
  }
  .bar.soft {
    opacity: 0.25;
  }
  .rule {
    position: absolute;
    left: 0;
    right: 0;
    height: 0;
    border-top: 2px solid var(--sc-stroke);
  }
</style>
