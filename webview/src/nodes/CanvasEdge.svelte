<script lang="ts">
  import {
    EdgeLabel,
    EdgeReconnectAnchor,
    EdgeToolbar,
    getBezierPath,
    getSmoothStepPath,
    getStraightPath,
    useViewport,
    type EdgeProps,
  } from '@xyflow/svelte';
  import type { CanvasFileEdge } from '../../../src/shared/protocol';
  import { markerToEnd, type RelationDef } from '../../../src/shared/shapes';
  import { SMOOTH_STEP } from '../../../src/shared/geometry';
  import { post } from '../lib/vscode';
  import { ui } from '../lib/ui.svelte';
  import { canvasColor } from '../lib/colors';
  import { MARKER_GLYPHS, dashFor, edgeLook } from '../lib/shapes/markers';
  import { bracketed } from '../lib/shapes/content';
  import FlowPacket from '../ui/atoms/FlowPacket.svelte';
  import DataChip from '../ui/molecules/DataChip.svelte';
  import EdgeToolbarBar, { endsOf, endsPatch } from '../ui/molecules/EdgeToolbar.svelte';

  // The one edge type. Routing (curved / right-angle / straight), line style (solid / dashed / dotted) and end
  // markers (arrow, UML, crow's foot...) come from the document edge, else from its relation preset, else from the
  // JSON Canvas ends. Markers are drawn as <marker> defs inside this edge's own <g>, so they inherit the edge colour
  // (`--ec`: custom colour, selected, lint warning) from CSS and need no global registry. The stroke can draw itself
  // in (CSS, via pathLength=1) when the wrapper carries `edge-enter`. It also carries the flow packet + data chip
  // (playback), the selected-edge toolbar and inline label editing.
  let {
    animated,
    interactionWidth = 20,
    label,
    labelStyle,
    sourcePosition,
    sourceX,
    sourceY,
    style,
    targetPosition,
    targetX,
    targetY,
    selected,
    data,
    id,
  }: EdgeProps = $props();

  const viewport = useViewport();
  const doc = $derived((data as { edge?: CanvasFileEdge } | undefined)?.edge);
  const look = $derived(edgeLook(doc));

  // xyflow ends an edge on the outer edge of the 8px handle; pull both ends 4px in so lines and markers touch the outline.
  const pull = (x: number, y: number, pos: string) => ({
    x: pos === 'left' ? x + 4 : pos === 'right' ? x - 4 : x,
    y: pos === 'top' ? y + 4 : pos === 'bottom' ? y - 4 : y,
  });
  const src = $derived(pull(sourceX, sourceY, sourcePosition));
  const tgt = $derived(pull(targetX, targetY, targetPosition));

  const [path, labelX, labelY] = $derived.by(() => {
    const [sourceX, sourceY, targetX, targetY] = [src.x, src.y, tgt.x, tgt.y];
    switch (look.routing) {
      case 'orthogonal':
        return getSmoothStepPath({
          sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition,
          borderRadius: SMOOTH_STEP.borderRadius,
          offset: SMOOTH_STEP.offset,
        });
      case 'straight':
        return getStraightPath({ sourceX, sourceY, targetX, targetY });
      default:
        return getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, curvature: 0.25 });
    }
  });

  // ---- markers ----
  const mk = $derived(`cv-mk-${id.replace(/[^\w-]/g, '_')}`);
  const dash = $derived(dashFor(look.lineStyle));
  const ink = $derived(canvasColor(doc?.color));
  const markers = $derived(
    [
      { key: 's', kind: look.fromMarker },
      { key: 'e', kind: look.toMarker },
    ].filter((m) => m.kind !== 'none'),
  );
  const url = (key: string, kind: string) => (kind === 'none' ? undefined : `url(#${mk}-${key})`);

  let pathEl = $state<SVGPathElement>();

  // ---- playback: the first active step riding this edge (no allocation per frame) ----
  const step = $derived.by(() => {
    for (const s of ui.steps) if (s.edgeId === id) return s;
    return undefined;
  });
  const chip = $derived.by(() => {
    if (!step?.data || !pathEl) return null;
    const len = pathEl.getTotalLength();
    if (!(len > 0)) return null;
    const p = pathEl.getPointAtLength(Math.min(1, Math.max(0, step.progress)) * len);
    const z = viewport.current.zoom || 1;
    // The second packet of a fork puts its chip below the line so the two never overlap.
    const below = ui.steps.length > 1 && ui.steps[0] !== step;
    return { x: p.x, y: p.y + (below ? 26 : -26) / Math.min(1, z) };
  });

  // ---- edit label ----
  let editing = $state(false);
  let input = $state<HTMLInputElement>();
  let draft = $state('');
  function startEdit() {
    draft = (label as string | undefined) ?? '';
    editing = true;
    queueMicrotask(() => {
      input?.focus();
      input?.select();
    });
  }
  function commit() {
    if (!editing) return;
    editing = false;
    const v = draft.trim();
    if (v !== ((label as string | undefined) ?? '')) post({ type: 'updateEdge', id, patch: { label: v } });
  }
  const tools = $derived(!!selected && ui.toolEdge === id);
  $effect(() => {
    if (!tools) editing = false;
  });

  const sub = $derived(doc?.sublabel ? (doc.relation?.startsWith('c4.') ? bracketed(doc.sublabel) : doc.sublabel) : '');

  const patch = (p: Partial<Omit<CanvasFileEdge, 'id'>>) => post({ type: 'updateEdge', id, patch: p });
  /** A relation preset sets markers, line style and routing explicitly (and the closest JSON Canvas ends). */
  function applyRelation(r: RelationDef | undefined) {
    if (!r) return patch({ relation: '' as never });
    const from = r.fromMarker ?? 'none';
    patch({
      relation: r.id,
      fromMarker: from,
      toMarker: r.toMarker,
      fromEnd: markerToEnd(from) ?? 'none',
      toEnd: markerToEnd(r.toMarker) ?? 'none',
      lineStyle: r.lineStyle ?? 'solid',
      routing: r.routing ?? 'bezier',
    });
  }
  function applyEnds(e: 'none' | 'end' | 'both') {
    const p = endsPatch(e);
    patch(look.diagram ? { ...p, fromMarker: e === 'both' ? 'arrow' : 'none', toMarker: e === 'none' ? 'none' : 'arrow' } : p);
  }
</script>

<g class="edge-ink" class:sel={selected} style={ink ? `--ec-custom: ${ink}` : undefined}>
  {#if markers.length}
    <defs>
      {#each markers as m (m.key)}
        <marker id={`${mk}-${m.key}`} orient="auto-start-reverse" markerUnits="userSpaceOnUse" markerWidth="24" markerHeight="24" refX="0" refY="0" style="overflow: visible">
          {#each MARKER_GLYPHS[m.kind] as g, i (i)}<path d={g.d} class={['mk', g.fill]} />{/each}
        </marker>
      {/each}
    </defs>
  {/if}
  <path
    {id}
    bind:this={pathEl}
    d={path}
    class="svelte-flow__edge-path"
    pathLength={animated || look.lineStyle !== 'solid' ? undefined : 1}
    marker-start={url('s', look.fromMarker)}
    marker-end={url('e', look.toMarker)}
    fill="none"
    {style}
    style:stroke-width={look.diagram ? 1.5 : undefined}
    style:stroke-dasharray={dash.dash}
    style:stroke-linecap={dash.cap}
  />
</g>
{#if interactionWidth > 0}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <path
    d={path}
    stroke-opacity={0}
    stroke-width={interactionWidth}
    fill="none"
    class="svelte-flow__edge-interaction"
    ondblclick={startEdit}
  />
{/if}
{#if step && pathEl}
  <FlowPacket path={pathEl} progress={step.progress} zoom={viewport.current.zoom} />
{/if}
{#if chip && step?.data}
  <EdgeLabel x={chip.x} y={chip.y} class="flow-chip" transparent>
    <div class="chip-scale" style:transform={`scale(${Math.min(2.4, 1 / (viewport.current.zoom || 1))})`}>
      <DataChip text={step.data} />
    </div>
  </EdgeLabel>
{/if}
{#if editing}
  <EdgeLabel x={labelX} y={labelY} transparent>
    <input
      class="label-input nodrag nopan nowheel"
      bind:this={input}
      bind:value={draft}
      placeholder="Label"
      spellcheck="false"
      onkeydown={(e) => {
        e.stopPropagation();
        if (e.key === 'Enter') commit();
        else if (e.key === 'Escape') editing = false;
      }}
      onblur={commit}
    />
  </EdgeLabel>
{:else if label || sub}
  <EdgeLabel x={labelX} y={labelY} style={labelStyle} selectEdgeOnClick ondblclick={startEdit}>
    {#if label}<span class="lbl">{label}</span>{/if}
    {#if sub}<span class="sub">{sub}</span>{/if}
  </EdgeLabel>
{/if}
{#if tools && doc}
  <EdgeToolbar x={labelX} y={labelY - 18 / Math.max(0.1, viewport.current.zoom)} alignY="bottom" isVisible>
    <EdgeToolbarBar
      color={doc.color}
      ends={endsOf(doc.fromEnd, doc.toEnd)}
      showEnds={!look.diagram}
      animated={!!doc.animated}
      routing={look.routing}
      lineStyle={look.lineStyle}
      relation={doc.relation}
      fromMarker={look.fromMarker}
      toMarker={look.toMarker}
      oncolor={(c) => patch({ color: c ?? ('' as never) })}
      onends={applyEnds}
      onrouting={(routing) => patch({ routing })}
      onlinestyle={(lineStyle) => patch({ lineStyle })}
      onrelation={applyRelation}
      onanimated={(a) => patch({ animated: a ? true : ('' as never) })}
      oneditlabel={startEdit}
      ondelete={() => post({ type: 'removeEdges', ids: [id] })}
    />
  </EdgeToolbar>
{/if}
{#if tools}
  <EdgeReconnectAnchor type="source" position={{ x: sourceX, y: sourceY }} size={20}><span class="anchor"></span></EdgeReconnectAnchor>
  <EdgeReconnectAnchor type="target" position={{ x: targetX, y: targetY }} size={20}><span class="anchor"></span></EdgeReconnectAnchor>
{/if}

<style>
  /* Marker colour: custom edge colour, else the edge stroke; selected and lint-warning edges follow the path. */
  .edge-ink {
    --ec: var(--ec-custom, var(--xy-edge-stroke, var(--vscode-descriptionForeground, #888)));
  }
  .edge-ink.sel {
    --ec: var(--xy-edge-stroke-selected, var(--vscode-focusBorder, #007fd4));
  }
  :global(.svelte-flow__edge.lint-warn) .edge-ink {
    --ec: var(--vscode-editorWarning-foreground, #cca700);
  }
  .mk {
    fill: none;
    stroke: var(--ec);
    stroke-width: 1.5;
    stroke-linejoin: round;
    stroke-linecap: round;
  }
  .mk.ink {
    fill: var(--ec);
  }
  .mk.bg {
    fill: var(--vscode-editor-background, #1e1e1e);
  }
  :global(.flow-chip) {
    z-index: 1000 !important;
    pointer-events: none !important;
  }
  .chip-scale {
    transform-origin: 50% 50%;
  }
  .lbl,
  .sub {
    display: block;
    text-align: center;
  }
  .sub {
    margin-top: 1px;
    color: var(--vscode-descriptionForeground, #9d9d9d);
    font-size: 0.88em;
  }
  .anchor {
    display: block;
    width: 10px;
    height: 10px;
    margin: 5px;
    box-sizing: border-box;
    border-radius: 50%;
    background: var(--vscode-editor-background, #1e1e1e);
    border: 2px solid var(--vscode-focusBorder, #007fd4);
    cursor: grab;
    transition: transform 100ms ease;
  }
  .anchor:hover {
    transform: scale(1.3);
  }
  .label-input {
    box-sizing: border-box;
    width: 140px;
    height: 24px;
    padding: 0 8px;
    border: 1px solid var(--vscode-focusBorder, #007fd4);
    border-radius: 4px;
    outline: none;
    background: var(--vscode-input-background, #3c3c3c);
    color: var(--vscode-input-foreground, #ccc);
    font: inherit;
    font-size: 12px;
    text-align: center;
  }
</style>
