# Wiring the new components into Canvas.svelte

Everything below is presentational and already unit/story tested. Canvas.svelte needs the following wiring.

## 1. Node types
```ts
import FindingNode from './nodes/FindingNode.svelte';
import LogNode from './nodes/LogNode.svelte';
import ServiceNode from './nodes/ServiceNode.svelte';
import PortalNode from './nodes/PortalNode.svelte';
const nodeTypes = { ...existing, finding: FindingNode, log: LogNode, service: ServiceNode, portal: PortalNode };
```
`lib/flow.ts` `kindOf()` already returns `finding | log | service | portal` (a file node whose `file` ends in
`.canvas.json` is a `portal`), and all four are in `RESIZABLE` (size comes from the document). They are not auto-measured
(do not add them to `AUTO`).

## 2. Extra data in `FlowData` (`lib/flow.ts`)
When building each flow node's `data`, from the `document` message:
- service nodes: `entryCode: { [index]: ResolvedCode }`, built from `msg.entryCode['${nodeId}#${index}']`
- portal nodes: `portal: msg.portals?.[nodeId]`

Both update on every `document` message; the adapters react to changes.

## 3. Semantic zoom
Adapters (`ServiceNode`, `CodeNode`) call `useLod()` (`lib/lod.svelte.ts`), which follows `useViewport().current.zoom` with
hysteresis (far < 0.45 <= mid < 0.9 <= near). Nothing to wire. Pure helpers live in `lib/lod.ts`. `CodeNode` now passes
`lod` to `CodeCard`; in `far` the card keeps its measured size (overlay), so the `measure` reporting stays correct.

## 4. Flow playback
```ts
import { createPlayer } from './lib/playback';
const player = createPlayer(flow, { measure: (edgeId) => pathEl(edgeId)?.getTotalLength() });
player.subscribe((s) => (playback = s));   // PlaybackState per frame
```
- On `{type:'playFlow', flowId, fromStep}`: `player.setFlow(flow); player.seekStep(...)/seek(...); player.play()`.
- Render `<PlaybackBar>` inside the canvas wrapper (it is `position:absolute; bottom-center`; the wrapper must be
  `position:relative`). Props map 1:1 to `PlaybackState`: `playing`, `progress`, `ticks={player.timeline.ticks}`,
  `currentIndex={s.groupIndex}`, `stepCount={player.timeline.groups.length}`, `caption`, `speed`. Callbacks:
  `onplaypause={player.toggle}`, `onstep={player.step}`, `onseek={player.seekFraction}`,
  `onseekstep={(i) => player.seekStep(player.timeline.entries[player.timeline.groups[i].entries[0]].index)}`,
  `onspeed={player.setSpeed}`, `onflowchange` (create a new player / `setFlow`). Space and arrow keys are handled by the
  bar itself (`keyboard` prop).
- In `CanvasEdge.svelte`, for each `activeSteps` entry whose `edgeId === id`, render inside the edge SVG
  `<FlowPacket path={pathEl} progress={a.progress} zoom={viewport.zoom} />` (bind the `BaseEdge` path element).
  Render `<DataChip text={a.data}>` in an `EdgeLabel`/`ViewportPortal` at the packet position
  (`path.getPointAtLength(progress * len)`), or at the target node for node steps.
- Camera follow: on `currentIndex` change call `camera.request([targetNodeId])` (see `lib/camera.ts`); light the target
  `lines` by adding a temporary highlight/pulse to that code node.

## 5. Interaction chrome
- `QuickAddMenu`: on `onConnectEnd` over the empty pane, or pane double-click, render it at the screen point (relative
  to the wrapper). `onselect(id)` ids: `sticky note text code finding log mermaid service link`. `code` -> post
  `pickFile`; others -> `addConnected` (or `addNode`) with the defaults for that kind (`finding`: `variant:'finding'`,
  `findingKind:'hypothesis'`, `status:'open'`; `log`: `variant:'log'`; `service`: `variant:'service'`).
- `NodeToolbar` / `EdgeToolbar`: wrap in xyflow's `<NodeToolbar isVisible={selected}>` (`nodes/*` adapters) or
  `<EdgeToolbar>` in `CanvasEdge`. Colour -> `updateNode`/`updateEdge` patch `{color}`. Edge ends: use `endsOf` /
  `endsPatch` exported from `EdgeToolbar.svelte`. Actions map: `open` -> `openFile`, `callers`/`callees` -> `trace`,
  `more` -> `expandRange`, `layout` -> `fixLayout`, `del` -> `removeNodes`.
- `AlignmentGuides` + `lib/snapping.ts`: in `onnodedrag` call `snapRect(draggedRect, otherRects, { zoom })`, set the
  node position to `{x,y}` from the result and render `<AlignmentGuides guides distances zoom>` inside a
  `<ViewportPortal target="back">`. Clear on drag stop.
- `CommandBar` (Cmd/Ctrl+K handled inside, `bind:open`), `Breadcrumbs` (`msg.breadcrumbs`; `onnavigate` -> `openCanvas`),
  `ZoomIndicator` (`zoom={viewport.current.zoom}`, `onreset={() => setViewport({...vp, zoom: 1})}`): place in absolutely
  positioned corners of the wrapper (breadcrumbs top-left, zoom indicator bottom-left).

## 6. Demo
`?demo=showcase` (standalone vite dev only) sends `lib/showcase.ts`: a service map with 4 services in 2 purple groups plus
a portal, an investigation (log, 2 code nodes, 3 findings), an order-flow row of 5 code nodes and two flows in
`vsCanvas.flows` (`order` includes a parallel fork).
