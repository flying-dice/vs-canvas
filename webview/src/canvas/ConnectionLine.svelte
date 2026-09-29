<script lang="ts">
  import { getBezierPath, Position, useConnection } from '@xyflow/svelte';
  import { ui } from '../lib/ui.svelte';

  // The live preview while dragging a connection: the same bezier + arrow as real edges, dashed in focusBorder.
  // Over a node body it snaps to the side / code line the drop would connect to.
  const conn = useConnection();
  const POS = { left: Position.Left, right: Position.Right, top: Position.Top, bottom: Position.Bottom } as const;

  const d = $derived.by(() => {
    const c = conn.current;
    if (!c.inProgress) return '';
    const snap = ui.dropTarget?.snap;
    const [p] = getBezierPath({
      sourceX: c.from.x,
      sourceY: c.from.y,
      sourcePosition: c.fromPosition,
      targetX: snap ? snap.x : c.to.x,
      targetY: snap ? snap.y : c.to.y,
      targetPosition: snap ? POS[snap.side] : c.toPosition,
      curvature: 0.25,
    });
    return p;
  });
  // Arrow points at the end that will become the edge target.
  const fromSource = $derived(conn.current.inProgress ? conn.current.fromHandle?.type !== 'target' : true);
</script>

<defs>
  <marker
    id="cv-connection-arrow"
    markerWidth="12.5"
    markerHeight="12.5"
    viewBox="-10 -10 20 20"
    markerUnits="strokeWidth"
    orient="auto-start-reverse"
    refX="0"
    refY="0"
  >
    <polyline class="arrow" points="-5,-4 0,0 -5,4 -5,-4" stroke-linecap="round" stroke-linejoin="round" />
  </marker>
</defs>
<path
  class="preview"
  {d}
  fill="none"
  marker-end={fromSource ? 'url(#cv-connection-arrow)' : undefined}
  marker-start={fromSource ? undefined : 'url(#cv-connection-arrow)'}
/>

<style>
  .preview {
    stroke: var(--vscode-focusBorder, #007fd4);
    stroke-width: 2;
    stroke-dasharray: 6 4;
    stroke-linecap: round;
  }
  .arrow {
    stroke: var(--vscode-focusBorder, #007fd4);
    fill: var(--vscode-focusBorder, #007fd4);
    stroke-width: 1;
  }
</style>
