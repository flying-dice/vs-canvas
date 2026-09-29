<script lang="ts">
  // The signal. The only glowing element in the product (design.md): a cyan core with a blur halo and a short,
  // fading trail, riding an edge path. Place inside the edge's <svg>; coordinates are the path's own.
  const uid = $props.id();

  let {
    path,
    progress,
    zoom = 1,
    trail = 56,
    fade = true,
  }: {
    /** The edge's SVG path element (`getPointAtLength` source). */
    path?: SVGGeometryElement | null;
    /** 0..1 along the path. */
    progress: number;
    /** Canvas zoom: the packet grows when zoomed out so it stays visible. */
    zoom?: number;
    /** Trail length in flow px (scaled with the packet). */
    trail?: number;
    /** Fade in over the first 4% and out over the last 4% of the path. */
    fade?: boolean;
  } = $props();

  const CYAN = 'var(--vscode-terminal-ansiCyan, #29b8db)';
  const TRAIL_DOTS = 10;

  const k = $derived(Math.min(3, Math.max(1, 1 / (zoom > 0 ? zoom : 1))));
  // Re-measured every update: the path's `d` changes when nodes move.
  const geom = $derived.by(() => {
    if (!path) return null;
    const len = path.getTotalLength();
    if (!(len > 0)) return null;
    const at = (d: number) => {
      const p = path.getPointAtLength(Math.min(len, Math.max(0, d)));
      return { x: p.x, y: p.y };
    };
    const pos = Math.min(1, Math.max(0, progress)) * len;
    const span = trail * k;
    const dots: { x: number; y: number; o: number; r: number }[] = [];
    for (let i = 1; i <= TRAIL_DOTS; i++) {
      const f = i / TRAIL_DOTS;
      const d = pos - f * span;
      if (d < 0) break;
      dots.push({ ...at(d), o: (1 - f) * 0.55, r: 2.6 * k * (1 - f * 0.55) });
    }
    return { head: at(pos), dots };
  });
  const opacity = $derived(
    !fade ? 1 : Math.max(0, Math.min(1, progress / 0.04, (1 - progress) / 0.04)),
  );
</script>

{#if geom}
  <g class="packet" style={`opacity:${opacity}`} pointer-events="none" aria-hidden="true">
    <defs>
      <filter id={`glow-${uid}`} x="-200%" y="-200%" width="500%" height="500%">
        <feGaussianBlur stdDeviation={4 * k} />
      </filter>
    </defs>
    {#each geom.dots as d, i (i)}
      <circle cx={d.x} cy={d.y} r={d.r} fill={CYAN} opacity={d.o} />
    {/each}
    <circle cx={geom.head.x} cy={geom.head.y} r={9 * k} fill={CYAN} opacity="0.75" filter={`url(#glow-${uid})`} />
    <circle cx={geom.head.x} cy={geom.head.y} r={2.5 * k} fill={CYAN} />
    <circle cx={geom.head.x} cy={geom.head.y} r={1.1 * k} fill="#fff" fill-opacity="0.7" />
  </g>
{/if}
