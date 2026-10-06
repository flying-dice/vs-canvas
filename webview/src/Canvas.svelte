<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import {
    SvelteFlow,
    Background,
    BackgroundVariant,
    MiniMap,
    Panel,
    ViewportPortal,
    ConnectionMode,
    useSvelteFlow,
    useViewport,
    useConnection,
    type Node,
    type Edge,
    type Connection,
    type NodeTypes,
    type EdgeTypes,
    type OnConnectEnd,
  } from '@xyflow/svelte';
  import {
    handleId,
    parseHandle,
    type CanvasFile,
    type CanvasFileEdge,
    type CanvasFileNode,
    type ConnectFrom,
    type FileNode,
    type ResolvedCode,
    type TextNode as DocTextNode,
    type ToWebview,
  } from '../../src/shared/protocol';
  import CodeNode from './nodes/CodeNode.svelte';
  import FileRefNode from './nodes/FileRefNode.svelte';
  import NoteNode from './nodes/NoteNode.svelte';
  import StickyNode from './nodes/StickyNode.svelte';
  import TextNode from './nodes/TextNode.svelte';
  import MermaidNode from './nodes/MermaidNode.svelte';
  import LinkNode from './nodes/LinkNode.svelte';
  import GroupNode from './nodes/GroupNode.svelte';
  import FindingNode from './nodes/FindingNode.svelte';
  import LogNode from './nodes/LogNode.svelte';
  import DiffNode from './nodes/DiffNode.svelte';
  import ServiceNode from './nodes/ServiceNode.svelte';
  import PortalNode from './nodes/PortalNode.svelte';
  import ShapeNode from './nodes/ShapeNode.svelte';
  import CanvasEdge from './nodes/CanvasEdge.svelte';
  import EmptyState from './ui/organisms/EmptyState.svelte';
  import LintBadge from './ui/atoms/LintBadge.svelte';
  import AlignmentGuides from './ui/atoms/AlignmentGuides.svelte';
  import IssuesPanel from './ui/organisms/IssuesPanel.svelte';
  import CommandBar, { type CommandSelection } from './ui/organisms/CommandBar.svelte';
  import QuickAddMenu, { QUICK_ADD_ITEMS } from './ui/molecules/QuickAddMenu.svelte';
  import ShapePalette from './ui/organisms/ShapePalette.svelte';
  import { SHAPE_MIME, newShapeById, shapeIdOfKind, shapeKind } from './lib/shapes/create';
  import Breadcrumbs, { type Crumb } from './ui/molecules/Breadcrumbs.svelte';
  import type { IconName } from './ui/atoms/Icon.svelte';
  import ConnectionLine from './canvas/ConnectionLine.svelte';
  import DropHighlight from './canvas/DropHighlight.svelte';
  import SelectionChrome from './canvas/SelectionChrome.svelte';
  import TopToolbar from './canvas/TopToolbar.svelte';
  import ZoomControls from './canvas/ZoomControls.svelte';
  import { KIND_DEFAULTS, CODE_SIZE, dirBetween, placeAtEdge, placeCentered, type Dir } from './canvas/kinds';
  import { alignBoxes, distributeBoxes, groupAround, lineAt, lineTop, nearestSide, type Align, type Box } from './canvas/geometry';
  import { lintCanvas, type LintDiagnostic, type LintSeverity } from '../../src/shared/lint';
  import { snapRect, type DistanceLabel, type Guide, type Rect } from './lib/snapping';
  import { post, onMessage, getState, setState } from './lib/vscode';
  import { Camera } from './lib/camera';
  import { MOTION, dur, easeOutCubic, reducedMotion } from './lib/motion';
  import { resizing } from './lib/interaction';
  import { canvasColor } from './lib/colors';
  import { theme } from './lib/theme.svelte';
  import { ui, type DropTarget } from './lib/ui.svelte';
  import { kindOf, RESIZABLE, type FlowData, type FlowKind } from './lib/flow';

  const nodeTypes = {
    code: CodeNode,
    fileRef: FileRefNode,
    note: NoteNode,
    sticky: StickyNode,
    text: TextNode,
    mermaid: MermaidNode,
    link: LinkNode,
    group: GroupNode,
    finding: FindingNode,
    log: LogNode,
    service: ServiceNode,
    portal: PortalNode,
    shape: ShapeNode,
    diff: DiffNode,
  } as unknown as NodeTypes;
  const edgeTypes = { canvas: CanvasEdge } as unknown as EdgeTypes;

  let nodes = $state.raw<Node[]>([]);
  let edges = $state.raw<Edge[]>([]);
  let mcpUrl = $state<string | null>(null);
  let canvasPath = $state('');
  let breadcrumbs = $state.raw<Crumb[]>([]);
  let docState = $state.raw<CanvasFile | null>(null);
  let wrap = $state<HTMLDivElement>();

  const { getViewport, setViewport, getInternalNode, screenToFlowPosition, fitView } = useSvelteFlow();
  const viewport = useViewport();
  const connection = useConnection();

  /** Auto-sized kinds: measured by xyflow and reported back to the document. */
  const AUTO = new Set(['code', 'fileRef']);

  let seenDocument = false;
  let fittedInitially = false;
  /** Document size and position per node id, to detect measured auto-sized nodes that differ. */
  const docSize = new Map<string, { width: number; height: number }>();
  const docPos = new Map<string, { x: number; y: number }>();
  let lastCanvas: CanvasFile | null = null;

  // ---- transient visual state (class names on xyflow wrappers) ----
  let enterNodes = new Set<string>();
  let enterEdges = new Set<string>();
  const exitNodes = new Set<string>();
  const exitEdges = new Set<string>();
  let flashNodes = new Set<string>();
  let warnEdges = new Set<string>();
  let issuesOpen = $state(getState<{ issuesOpen: boolean }>().issuesOpen ?? false);

  function nodeClass(id: string, kind?: string): string | undefined {
    const c = [
      kind === 'group' ? 'group-node' : '',
      enterNodes.has(id) ? 'node-enter' : '',
      exitNodes.has(id) ? 'node-exit' : '',
      flashNodes.has(id) ? 'lint-flash' : '',
    ].filter(Boolean);
    return c.length ? c.join(' ') : undefined;
  }
  function edgeClass(id: string): string | undefined {
    const c = [
      enterEdges.has(id) ? 'edge-enter' : '',
      exitEdges.has(id) ? 'edge-exit' : '',
      issuesOpen && warnEdges.has(id) ? 'lint-warn' : '',
    ].filter(Boolean);
    return c.length ? c.join(' ') : undefined;
  }
  /** Recompute class names from the transient sets without touching anything else. */
  function restyle() {
    nodes = nodes.map((n) => {
      const cls = nodeClass(n.id, n.type);
      return cls === n.class ? n : { ...n, class: cls };
    });
    edges = edges.map((e) => {
      const cls = edgeClass(e.id);
      return cls === e.class ? e : { ...e, class: cls };
    });
  }

  // ---- position / size tween (external changes only) ----
  type Box2 = { x: number; y: number; w?: number; h?: number };
  type Tween = { from: Box2; to: Box2; t0: number };
  const tweens = new Map<string, Tween>();
  let tweenRaf = 0;

  const near = (a: Box2, b: Box2) =>
    Math.abs(a.x - b.x) < 0.5 &&
    Math.abs(a.y - b.y) < 0.5 &&
    Math.abs((a.w ?? 0) - (b.w ?? 0)) < 0.5 &&
    Math.abs((a.h ?? 0) - (b.h ?? 0)) < 0.5;

  function tweenStep(now: number) {
    tweenRaf = 0;
    if (!tweens.size) return;
    const upd = new Map<string, Box2>();
    for (const [id, t] of tweens) {
      const p = Math.min(1, Math.max(0, (now - t.t0) / dur(MOTION.moveMs)));
      const e = dur(MOTION.moveMs) === 0 ? 1 : easeOutCubic(p);
      const lerp = (a: number, b: number) => a + (b - a) * e;
      upd.set(id, {
        x: lerp(t.from.x, t.to.x),
        y: lerp(t.from.y, t.to.y),
        w: t.to.w === undefined ? undefined : lerp(t.from.w ?? t.to.w, t.to.w),
        h: t.to.h === undefined ? undefined : lerp(t.from.h ?? t.to.h, t.to.h),
      });
      if (p >= 1) tweens.delete(id);
    }
    // One state write per frame for every moving node.
    nodes = nodes.map((n) => {
      const b = upd.get(n.id);
      if (!b) return n;
      return { ...n, position: { x: b.x, y: b.y }, ...(b.w !== undefined ? { width: b.w, height: b.h } : {}) };
    });
    if (tweens.size) tweenRaf = requestAnimationFrame(tweenStep);
  }
  function startTweens() {
    if (!tweenRaf && tweens.size) tweenRaf = requestAnimationFrame(tweenStep);
  }

  // ---- exit / settle timers ----
  let exitTimer: ReturnType<typeof setTimeout> | undefined;
  let settleTimer: ReturnType<typeof setTimeout> | undefined;

  function scheduleExit() {
    clearTimeout(exitTimer);
    if (!exitNodes.size && !exitEdges.size) return;
    exitTimer = setTimeout(() => {
      nodes = nodes.filter((n) => !exitNodes.has(n.id));
      edges = edges.filter((e) => !exitEdges.has(e.id) && !exitNodes.has(e.source) && !exitNodes.has(e.target));
      exitNodes.clear();
      exitEdges.clear();
    }, MOTION.exitMs + 40);
  }
  function scheduleSettle() {
    clearTimeout(settleTimer);
    settleTimer = setTimeout(() => {
      if (!enterNodes.size && !enterEdges.size) return;
      enterNodes = new Set();
      enterEdges = new Set();
      restyle();
    }, MOTION.edgeDrawMs + 300);
  }

  type DocMsg = Extract<ToWebview, { type: 'document' }>;

  function applyDocument(msg: DocMsg) {
    const { canvas, code } = msg;
    const first = !seenDocument;
    seenDocument = true;
    const animate = !first && !reducedMotion();
    const prev = new Map(nodes.map((n) => [n.id, n]));
    const prevEdges = new Map(edges.map((e) => [e.id, e]));
    const now = performance.now();

    const anchors = new Map<string, { in: Set<number>; out: Set<number> }>();
    const slot = (id: string) => {
      let a = anchors.get(id);
      if (!a) anchors.set(id, (a = { in: new Set(), out: new Set() }));
      return a;
    };
    for (const e of canvas.edges) {
      if (e.fromLine) slot(e.fromNode).out.add(e.fromLine);
      if (e.toLine) slot(e.toNode).in.add(e.toLine);
    }

    lastCanvas = canvas;
    docState = canvas;
    docSize.clear();
    docPos.clear();
    enterNodes = new Set();
    enterEdges = new Set();
    const docIds = new Set(canvas.nodes.map((n) => n.id));

    const next: Node[] = canvas.nodes.map((n) => {
      const kind = kindOf(n);
      docSize.set(n.id, { width: n.width, height: n.height });
      docPos.set(n.id, { x: n.x, y: n.y });
      const a = anchors.get(n.id);
      const data: FlowData = {
        node: n,
        code: code[n.id],
        ...(kind === 'diff' ? { diffBase: msg.diffBase?.[n.id] } : {}),
        anchors: { in: [...(a?.in ?? [])], out: [...(a?.out ?? [])] },
      };
      if (kind === 'service' && msg.entryCode) {
        const eps = (n as DocTextNode).entryPoints ?? [];
        const map: Record<number, ResolvedCode> = {};
        eps.forEach((_, i) => {
          const c = msg.entryCode![`${n.id}#${i}`];
          if (c) map[i] = c;
        });
        data.entryCode = map;
      }
      if (kind === 'portal' && msg.portals?.[n.id]) data.portal = msg.portals[n.id];
      const p = prev.get(n.id);
      const resizable = RESIZABLE.has(kind);
      exitNodes.delete(n.id); // came back before it finished fading out
      if (!p && !first) enterNodes.add(n.id);

      let position = { x: n.x, y: n.y };
      let size: { width?: number; height?: number } = resizable ? { width: n.width, height: n.height } : {};
      if (p) {
        const to: Box2 = { x: n.x, y: n.y, ...(resizable ? { w: n.width, h: n.height } : {}) };
        if (p.dragging || resizing.has(n.id)) {
          // The user owns this node right now; keep what is rendered.
          tweens.delete(n.id);
          position = p.position;
          if (resizable) size = { width: p.width ?? n.width, height: p.height ?? n.height };
        } else if (animate) {
          const cur: Box2 = { x: p.position.x, y: p.position.y, ...(resizable ? { w: p.width ?? n.width, h: p.height ?? n.height } : {}) };
          if (near(cur, to)) tweens.delete(n.id); // already there (e.g. echo of the user's own drag)
          else {
            const running = tweens.get(n.id);
            // Keep an in-flight tween that already heads to this target; otherwise retarget from where it is now.
            if (!running || !near(running.to, to)) tweens.set(n.id, { from: cur, to, t0: now });
            position = { x: cur.x, y: cur.y };
            if (resizable) size = { width: cur.w, height: cur.h };
          }
        } else tweens.delete(n.id);
      }
      return {
        ...p,
        id: n.id,
        type: kind,
        position,
        data,
        // Groups sit below everything else; they are spatial, not xyflow parents.
        zIndex: kind === 'group' ? -1 : 0,
        // Auto-sized kinds are measured, not given width/height.
        ...size,
        class: nodeClass(n.id, kind),
        // Header is the drag area for code nodes and the label tab for groups.
        ...(kind === 'code' ? { dragHandle: '.node-drag-handle' } : {}),
        ...(kind === 'group' ? { dragHandle: '.group-label' } : {}),
      } as Node;
    });

    // Removed nodes fade out before leaving the state.
    for (const p of prev.values()) {
      if (docIds.has(p.id)) continue;
      tweens.delete(p.id);
      if (animate && !p.dragging) {
        exitNodes.add(p.id);
        next.push({ ...p, selected: false, class: nodeClass(p.id, p.type) } as Node);
      } else exitNodes.delete(p.id);
    }

    const nextEdges: Edge[] = canvas.edges.map((e) => {
      const color = canvasColor(e.color);
      exitEdges.delete(e.id);
      if (!prevEdges.has(e.id) && !first) enterEdges.add(e.id);
      return {
        id: e.id,
        type: 'canvas',
        source: e.fromNode,
        target: e.toNode,
        sourceHandle: handleId.out(e),
        targetHandle: handleId.in(e),
        label: e.label,
        animated: e.animated,
        selected: prevEdges.get(e.id)?.selected,
        style: color ? `stroke: ${color};` : undefined,
        class: edgeClass(e.id),
        data: { edge: e },
      } satisfies Edge;
    });
    const liveIds = new Set(nextEdges.map((e) => e.id));
    const nodeIdsNext = new Set(next.map((n) => n.id));
    for (const e of prevEdges.values()) {
      if (liveIds.has(e.id)) continue;
      // Line-anchored edges cannot fade: their line handles disappear with the document change.
      const anchored = `${e.sourceHandle}${e.targetHandle}`.includes('-L');
      if (animate && !anchored && nodeIdsNext.has(e.source) && nodeIdsNext.has(e.target)) {
        exitEdges.add(e.id);
        nextEdges.push({ ...e, selected: false, class: edgeClass(e.id) });
      } else exitEdges.delete(e.id);
    }

    nodes = next;
    edges = nextEdges;
    startTweens();
    scheduleExit();
    scheduleSettle();
    scheduleLint();

    // Fit a restored canvas once on load; later changes use explicit focus messages.
    if (!fittedInitially && canvas.nodes.length) {
      fittedInitially = true;
      camera.request(undefined, { instant: true, force: true });
    }
  }

  // ---- camera ----
  let pointerDown = false;
  let nodeDragging = false;
  let userMoving = $state(false);
  let lastWheel = 0;

  const camera = new Camera({
    getViewport: () => getViewport(),
    setViewport: (v, o) => setViewport(v, o),
    size: () => ({ width: wrap?.clientWidth ?? window.innerWidth, height: wrap?.clientHeight ?? window.innerHeight }),
    nodeIds: () => nodes.filter((n) => !exitNodes.has(n.id)).map((n) => n.id),
    measured: (id) => !!getInternalNode(id)?.measured?.width,
    nodeBounds: (id) => {
      const n = nodes.find((q) => q.id === id);
      const m = getInternalNode(id)?.measured;
      if (!n) return null;
      const t = tweens.get(id)?.to;
      const width = t?.w ?? m?.width ?? n.width;
      const height = t?.h ?? m?.height ?? n.height;
      if (!width || !height) return null;
      return { x: t?.x ?? n.position.x, y: t?.y ?? n.position.y, width, height };
    },
    // The user always wins: dragging, panning, wheeling or connecting defers programmatic moves.
    busy: () =>
      pointerDown || nodeDragging || userMoving || ui.connectFrom !== null || performance.now() - lastWheel < MOTION.wheelQuietMs,
  });

  function handleMessage(m: ToWebview) {
    if (m.type === 'document') {
      canvasPath = m.canvasPath;
      breadcrumbs = m.breadcrumbs ?? [];
      applyDocument(m);
    } else if (m.type === 'info') mcpUrl = m.mcpUrl;
    else if (m.type === 'focus') camera.request(m.nodeIds, m.zoom ? { fit: true } : {});
    else if (m.type === 'select') selectNodes(m.nodeIds, m.edit);
  }

  /** Select exactly these nodes (after the document containing them), calmly bring them into view, maybe edit. */
  function selectNodes(ids: string[], edit?: boolean) {
    const want = new Set(ids);
    nodes = nodes.map((n) => (want.has(n.id) === !!n.selected ? n : { ...n, selected: want.has(n.id) }));
    edges = edges.map((e) => (e.selected ? { ...e, selected: false } : e));
    if (ids.length) camera.request(ids);
    if (edit && ids[0]) {
      const target = ids[0];
      ui.requestEdit(target);
      setTimeout(() => {
        if (ui.editId === target) ui.editId = null; // this kind has no inline editor
      }, 4000);
    }
  }

  onMount(() => {
    const off = onMessage(handleMessage);
    const up = () => (pointerDown = false);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    window.addEventListener('pointermove', onWindowPointerMove, { passive: true });
    post({ type: 'ready' });
    return () => {
      off();
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      window.removeEventListener('pointermove', onWindowPointerMove);
      camera.dispose();
      cancelAnimationFrame(tweenRaf);
      cancelAnimationFrame(dropRaf);
      clearTimeout(exitTimer);
      clearTimeout(settleTimer);
      clearTimeout(lintTimer);
      clearTimeout(flashTimer);
    };
  });

  // ---- lint ----
  let diagnostics = $state.raw<LintDiagnostic[]>([]);
  let lintTimer: ReturnType<typeof setTimeout> | undefined;
  let lintSig = '';
  let flashTimer: ReturnType<typeof setTimeout> | undefined;

  function scheduleLint() {
    clearTimeout(lintTimer);
    lintTimer = setTimeout(runLint, 200);
  }
  function runLint() {
    if (!lastCanvas) return;
    // Lint the document layout, but with the sizes xyflow measured for auto-sized nodes.
    const copy: CanvasFile = {
      ...lastCanvas,
      nodes: lastCanvas.nodes.map((n) => {
        if (n.type !== 'file') return n;
        const m = getInternalNode(n.id)?.measured;
        return m?.width && m?.height ? { ...n, width: Math.round(m.width), height: Math.round(m.height) } : n;
      }),
    };
    let result: LintDiagnostic[] = [];
    try {
      result = lintCanvas(copy);
    } catch {
      result = []; // linter unavailable: render nothing
    }
    diagnostics = result;
    warnEdges = new Set(
      result.filter((d) => d.rule === 'edge-through-node' || d.rule === 'edge-label-overlap').flatMap((d) => d.edgeIds),
    );
    untrack(restyle);
  }

  const lintByNode = $derived.by(() => {
    const m = new Map<string, LintDiagnostic[]>();
    for (const d of diagnostics) for (const id of d.nodeIds) (m.get(id) ?? m.set(id, []).get(id)!).push(d);
    return m;
  });
  const rank: Record<LintSeverity, number> = { error: 0, warning: 1, info: 2 };
  const worst = (ds: LintDiagnostic[]) => ds.reduce((a, d) => (rank[d.severity] < rank[a] ? d.severity : a), ds[0].severity);
  const issueSeverity = $derived(diagnostics.length ? worst(diagnostics) : 'warning');
  const badges = $derived(
    nodes
      .filter((n) => lintByNode.has(n.id) && !n.class?.includes('node-exit'))
      .map((n) => {
        const ds = lintByNode.get(n.id)!;
        return {
          id: n.id,
          right: n.position.x + (n.measured?.width ?? n.width ?? 0),
          top: n.position.y,
          severity: worst(ds),
          messages: ds.map((d) => d.message),
        };
      }),
  );
  const badgeScale = $derived(Math.min(2.5, 1 / (viewport.current.zoom || 1)));
  // Group and edge labels grow as the canvas zooms out so they stay readable on a map (capped).
  const labelScale = $derived(Math.min(2.4, Math.max(1, 0.9 / (viewport.current.zoom || 1))));
  // Far-level (semantic zoom) titles counter-scale so they stay ~15px+ on screen; cards cap it by their width.
  const farScale = $derived(Math.min(3, Math.max(1, 0.5 / (viewport.current.zoom || 1))));

  function toggleIssues() {
    issuesOpen = !issuesOpen;
    setState({ issuesOpen });
    restyle();
  }

  function selectIssue(d: LintDiagnostic) {
    const ids = new Set(d.nodeIds);
    for (const eid of d.edgeIds) {
      const e = edges.find((q) => q.id === eid);
      if (e) {
        ids.add(e.source);
        ids.add(e.target);
      }
    }
    const list = [...ids].filter((id) => nodes.some((n) => n.id === id));
    if (!list.length) return;
    flashNodes = new Set(list);
    restyle();
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => {
      flashNodes = new Set();
      restyle();
    }, MOTION.flashMs);
    camera.request(list, { immediate: true });
  }

  const fixLayout = (nodeIds?: string[]) => post({ type: 'fixLayout', ...(nodeIds?.length ? { nodeIds } : {}) });
  function fixIssue(d: LintDiagnostic) {
    const ids = new Set([...d.nodeIds, ...(d.fix?.moves?.map((m) => m.id) ?? [])]);
    // A diagnostic with no nodes (e.g. legacy-flows) must fix only its own rule, not run the whole layout fix.
    if (!ids.size) post({ type: 'fixLayout', rules: [d.rule] });
    else fixLayout([...ids]);
  }

  // Auto-sized nodes (code, fileRef): report their measured size back into the document.
  type Change = { id: string; x: number; y: number; width?: number; height?: number };
  const pending = new Map<string, Change>();
  const sent = new Map<string, { w: number; h: number }>();
  let flushTimer: ReturnType<typeof setTimeout> | undefined;

  $effect(() => {
    let sig = '';
    for (const n of nodes) {
      if (!AUTO.has(n.type ?? '')) continue;
      const doc = docSize.get(n.id);
      if (!doc || !n.measured?.width || !n.measured?.height) continue;
      const w = Math.round(n.measured.width);
      const h = Math.round(n.measured.height);
      sig += `${n.id}:${w}x${h};`;
      if (Math.abs(w - doc.width) <= 2 && Math.abs(h - doc.height) <= 2) {
        pending.delete(n.id);
        sent.delete(n.id);
        continue;
      }
      const s = sent.get(n.id);
      if (s && Math.abs(w - s.w) <= 2 && Math.abs(h - s.h) <= 2) continue; // already reported; do not loop
      const pos = docPos.get(n.id) ?? n.position; // the document's position, not a mid-tween one
      pending.set(n.id, { id: n.id, x: pos.x, y: pos.y, width: w, height: h });
    }
    if (sig !== lintSig) {
      lintSig = sig;
      scheduleLint(); // measured sizes changed: lint again
    }
    if (pending.size) {
      clearTimeout(flushTimer);
      flushTimer = setTimeout(() => {
        const changes = [...pending.values()];
        pending.clear();
        for (const c of changes) sent.set(c.id, { w: c.width!, h: c.height! });
        if (changes.length) post({ type: 'nodesChanged', reason: 'measure', changes });
      }, 300);
    }
  });

  // ---- sizes & boxes ----
  const sizeOf = (n: Node) => ({ w: n.measured?.width ?? n.width ?? 0, h: n.measured?.height ?? n.height ?? 0 });
  function boxOf(n: Node): Box {
    const s = sizeOf(n);
    return { id: n.id, x: n.position.x, y: n.position.y, w: s.w, h: s.h };
  }
  const docNode = (id: string): CanvasFileNode | undefined => lastCanvas?.nodes.find((n) => n.id === id);

  // ---- connections ----
  let quick = $state<{ sx: number; sy: number; flow: { x: number; y: number }; from?: ConnectFrom; dir?: Dir } | null>(null);
  let reconnecting: { edge: Edge; type: 'source' | 'target' } | null = null;

  /** Post a connection between two nodes with optional side / line anchors on either end. */
  function postConnect(
    fromNode: string,
    fromAnchor: { side?: CanvasFileEdge['fromSide']; line?: number },
    toNode: string,
    toAnchor: { side?: CanvasFileEdge['toSide']; line?: number },
    extra: Partial<CanvasFileEdge> = {},
  ) {
    post({
      type: 'connect',
      edge: {
        ...extra,
        fromNode,
        toNode,
        ...(fromAnchor.line ? { fromLine: fromAnchor.line } : fromAnchor.side ? { fromSide: fromAnchor.side } : {}),
        ...(toAnchor.line ? { toLine: toAnchor.line } : toAnchor.side ? { toSide: toAnchor.side } : {}),
      },
    });
  }

  // Handle-to-handle connections are posted here; xyflow's own optimistic edge is suppressed (the document echo
  // draws the real one), so there is never a duplicate.
  function onbeforeconnect(c: Connection) {
    postConnect(c.source, parseHandle(c.sourceHandle), c.target, parseHandle(c.targetHandle));
    return undefined;
  }

  let dropRaf = 0;
  let px = 0;
  let py = 0;
  function onWindowPointerMove(e: PointerEvent) {
    if (ui.connectFrom === null) return;
    px = e.clientX;
    py = e.clientY;
    if (!dropRaf) dropRaf = requestAnimationFrame(updateDrop);
  }
  function updateDrop() {
    dropRaf = 0;
    if (ui.connectFrom === null) return;
    const c = connection.current;
    // Over a real handle: xyflow shows its own snap; do not compete with it.
    const t = c.inProgress && c.toHandle && c.isValid ? null : computeDrop(px, py, ui.connectFrom);
    const p = ui.dropTarget;
    if (!t && !p) return;
    if (t && p && t.id === p.id && t.line?.n === p.line?.n && t.snap.side === p.snap.side && t.snap.y === p.snap.y) return;
    ui.dropTarget = t;
  }

  /** The node (and code line) under a screen point, with where the arrow would land. */
  function computeDrop(clientX: number, clientY: number, exclude: string | null): DropTarget | null {
    const p = screenToFlowPosition({ x: clientX, y: clientY });
    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i];
      if (n.type === 'group' || n.id === exclude || exitNodes.has(n.id)) continue;
      const w = n.measured?.width ?? n.width ?? 0;
      const h = n.measured?.height ?? n.height ?? 0;
      const x = n.position.x;
      const y = n.position.y;
      if (p.x < x || p.x > x + w || p.y < y || p.y > y + h) continue;
      const box: Box = { id: n.id, x, y, w, h };
      let side = nearestSide(box, p.x, p.y);
      let line: DropTarget['line'];
      if (n.type === 'code') {
        const code = (n.data as FlowData).code;
        const ln = code && !code.error ? lineAt(box, code.firstLine, code.lines.length, p.y) : undefined;
        if (ln !== undefined) {
          line = { n: ln, y: lineTop(box, code!.firstLine, ln), h: 18 };
          side = p.x < x + w / 2 ? 'left' : 'right';
        }
      }
      const sx = side === 'left' ? x : side === 'right' ? x + w : x + w / 2;
      const sy = line ? line.y + 9 : side === 'top' ? y : side === 'bottom' ? y + h : y + h / 2;
      return { id: n.id, x, y, w, h, line, snap: { x: sx, y: sy, side } };
    }
    return null;
  }

  const onconnectstart = (_: unknown, p: { nodeId: string | null }) => {
    ui.connectFrom = p.nodeId;
  };

  const onconnectend: OnConnectEnd = (event, state) => {
    ui.connectFrom = null;
    ui.dropTarget = null;
    cancelAnimationFrame(dropRaf);
    dropRaf = 0;
    if (state.isValid && state.toHandle) return; // a real handle: onbeforeconnect / onbeforereconnect handled it
    const from = state.fromHandle;
    if (!from) return;
    const pt = 'changedTouches' in event ? event.changedTouches[0] : (event as MouseEvent);
    const el = event.target as Element | null;
    if (el?.closest?.('.svelte-flow__panel, .svelte-flow__node-toolbar, .menu, .bar, .scrim')) return;
    const anchor = parseHandle(from.id);
    const drop = computeDrop(pt.clientX, pt.clientY, from.nodeId);

    if (reconnecting) {
      // Dragged an existing edge's end: onto a node body it reconnects there, onto empty canvas it stays put.
      if (drop) reconnectTo(reconnecting.edge, reconnecting.type, drop);
      return;
    }
    if (drop) {
      const to = drop.line ? { line: drop.line.n } : { side: drop.snap.side };
      if (from.type === 'source') postConnect(from.nodeId, anchor, drop.id, to);
      else postConnect(drop.id, to, from.nodeId, anchor);
      return;
    }
    // Empty canvas: ask what to create there.
    const flow = screenToFlowPosition({ x: pt.clientX, y: pt.clientY });
    const origin = state.from ?? flow;
    openQuick(pt.clientX, pt.clientY, {
      flow,
      dir: dirBetween(origin, flow),
      from: {
        nodeId: from.nodeId,
        ...(anchor.line ? { line: anchor.line } : anchor.side ? { side: anchor.side } : {}),
        handleType: from.type,
      },
    });
  };

  function reconnectTo(edge: Edge, end: 'source' | 'target', drop: DropTarget) {
    const doc = (edge.data as { edge?: CanvasFileEdge } | undefined)?.edge;
    if (!doc) return;
    const anchor = drop.line ? { line: drop.line.n } : { side: drop.snap.side };
    applyReconnect(doc, end === 'source' ? { fromNode: drop.id, from: anchor } : { toNode: drop.id, to: anchor });
  }

  type Anchor = { side?: CanvasFileEdge['fromSide']; line?: number };
  function applyReconnect(doc: CanvasFileEdge, change: { fromNode?: string; from?: Anchor; toNode?: string; to?: Anchor }) {
    const fromNode = change.fromNode ?? doc.fromNode;
    const toNode = change.toNode ?? doc.toNode;
    const from: Anchor = change.from ?? { side: doc.fromSide, line: doc.fromLine };
    const to: Anchor = change.to ?? { side: doc.toSide, line: doc.toLine };
    if (fromNode === doc.fromNode && toNode === doc.toNode) {
      const none = '' as never;
      post({
        type: 'updateEdge',
        id: doc.id,
        patch: {
          fromSide: from.line ? none : (from.side ?? none),
          fromLine: from.line ?? none,
          toSide: to.line ? none : (to.side ?? none),
          toLine: to.line ?? none,
        },
      });
      return;
    }
    const { id: _id, fromNode: _a, toNode: _b, fromSide: _c, fromLine: _d, toSide: _e, toLine: _f, ...rest } = doc;
    post({ type: 'removeEdges', ids: [doc.id] });
    postConnect(fromNode, from, toNode, to, rest);
  }

  // Handle-to-handle reconnect: same nodes -> updateEdge, other node -> remove + connect.
  function onbeforereconnect(c: Edge, oldEdge: Edge) {
    const doc = (oldEdge.data as { edge?: CanvasFileEdge } | undefined)?.edge;
    if (doc)
      applyReconnect(doc, {
        fromNode: c.source,
        from: parseHandle(c.sourceHandle),
        toNode: c.target,
        to: parseHandle(c.targetHandle),
      });
    return false as const;
  }

  // ---- shape palette ----
  let shapesOpen = $state(getState<{ shapesOpen: boolean }>().shapesOpen ?? false);
  const PALETTE_W = 240;
  function toggleShapes() {
    shapesOpen = !shapesOpen;
    setState({ shapesOpen });
  }
  let lastAdd = { t: 0, n: 0 };
  /** Click in the palette: add at the centre of the visible canvas (beside the panel), stepping so clicks never stack. */
  function addShapeAtCenter(id: string) {
    const now = Date.now();
    lastAdd = { t: now, n: now - lastAdd.t < 4000 ? (lastAdd.n + 1) % 6 : 0 };
    const c = viewportCenter();
    const p = screenToFlowPosition({ x: c.x + (shapesOpen ? PALETTE_W / 2 : 0), y: c.y });
    const z = viewport.current.zoom || 1;
    createKind(shapeKind(id), { x: p.x + (lastAdd.n * 24) / z, y: p.y + (lastAdd.n * 24) / z });
  }
  function ondragover(e: DragEvent) {
    if (!e.dataTransfer?.types.includes(SHAPE_MIME)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }
  function ondrop(e: DragEvent) {
    const id = e.dataTransfer?.getData(SHAPE_MIME);
    if (!id) return;
    e.preventDefault();
    createKind(shapeKind(id), screenToFlowPosition({ x: e.clientX, y: e.clientY }));
  }

  // ---- quick add ----
  function openQuick(clientX: number, clientY: number, extra: { flow?: { x: number; y: number }; from?: ConnectFrom; dir?: Dir } = {}) {
    const r = wrap?.getBoundingClientRect();
    if (!r) return;
    quick = {
      sx: clientX - r.left,
      sy: clientY - r.top,
      flow: extra.flow ?? screenToFlowPosition({ x: clientX, y: clientY }),
      from: extra.from,
      dir: extra.dir,
    };
  }
  function viewportCenter() {
    const r = wrap?.getBoundingClientRect();
    return { x: (r?.left ?? 0) + (r?.width ?? window.innerWidth) / 2, y: (r?.top ?? 0) + (r?.height ?? window.innerHeight) / 2 };
  }

  function createKind(kind: string, flow: { x: number; y: number }, from?: ConnectFrom, dir?: Dir) {
    const shape = newShapeById(shapeIdOfKind(kind) ?? '');
    const size = shape?.size ?? (kind === 'code' ? CODE_SIZE : KIND_DEFAULTS[kind]?.size);
    if (!size) return;
    const at = from && dir ? placeAtEdge(flow, size, dir) : placeCentered(flow, size);
    if (kind === 'code') {
      post({ type: 'pickFile', at, ...(from ? { from } : {}) });
      return;
    }
    const d = shape ?? KIND_DEFAULTS[kind];
    const node = { ...d.node, x: at.x, y: at.y, width: size[0], height: size[1] } as Parameters<typeof post>[0] extends infer M
      ? M extends { type: 'addNode'; node: infer N }
        ? N
        : never
      : never;
    if (from) post({ type: 'addConnected', node, from });
    else post({ type: 'addNode', node });
  }

  function chooseQuick(kind: string) {
    const q = quick;
    quick = null;
    if (q) createKind(kind, q.flow, q.from, q.dir);
  }

  function ondblclick(e: MouseEvent) {
    if (!(e.target as Element | null)?.classList?.contains('svelte-flow__pane')) return;
    openQuick(e.clientX, e.clientY);
  }

  // ---- dragging: 8px grid + alignment guides (hold Alt / Option to move freely) ----
  let snapOthers: Rect[] = [];
  const lastSnap = new Map<string, { x: number; y: number }>();
  let guides = $state.raw<Guide[]>([]);
  let distances = $state.raw<DistanceLabel[]>([]);
  let dragging = $state(false);

  function ondragstart(dragged: Node[]) {
    nodeDragging = true;
    dragging = true;
    lastSnap.clear();
    const ids = new Set(dragged.map((n) => n.id));
    snapOthers = [];
    for (const n of nodes) {
      if (ids.has(n.id) || n.type === 'group' || exitNodes.has(n.id)) continue;
      const b = boxOf(n);
      snapOthers.push({ x: b.x, y: b.y, w: b.w, h: b.h });
    }
    for (const n of dragged) tweens.delete(n.id);
  }

  function ondrag(dragged: Node[], event: MouseEvent | TouchEvent) {
    if (!dragged.length) return;
    if ('altKey' in event && event.altKey) {
      lastSnap.clear();
      if (guides.length) guides = [];
      if (distances.length) distances = [];
      return;
    }
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    for (const n of dragged) {
      const s = sizeOf(n);
      if (n.position.x < x1) x1 = n.position.x;
      if (n.position.y < y1) y1 = n.position.y;
      if (n.position.x + s.w > x2) x2 = n.position.x + s.w;
      if (n.position.y + s.h > y2) y2 = n.position.y + s.h;
    }
    const r = snapRect({ x: x1, y: y1, w: x2 - x1, h: y2 - y1 }, snapOthers, { zoom: viewport.current.zoom });
    const dx = r.x - x1;
    const dy = r.y - y1;
    guides = r.guides;
    distances = r.distances;
    const moved = new Map<string, { x: number; y: number }>();
    for (const n of dragged) moved.set(n.id, { x: n.position.x + dx, y: n.position.y + dy });
    for (const [id, p] of moved) lastSnap.set(id, p);
    nodes = nodes.map((n) => {
      const p = moved.get(n.id);
      return p && (p.x !== n.position.x || p.y !== n.position.y) ? { ...n, position: p } : n;
    });
  }

  function ondragstop(dragged: Node[]) {
    nodeDragging = false;
    dragging = false;
    guides = [];
    distances = [];
    const changes = dragged.map((n) => {
      const p = lastSnap.get(n.id) ?? n.position;
      return { id: n.id, x: Math.round(p.x), y: Math.round(p.y) };
    });
    lastSnap.clear();
    snapOthers = [];
    if (!changes.length) return;
    // Keep what is rendered in step with what is posted (the last drag event may have been raw).
    const by = new Map(changes.map((c) => [c.id, c]));
    nodes = nodes.map((n) => {
      const c = by.get(n.id);
      return c && (c.x !== n.position.x || c.y !== n.position.y) ? { ...n, position: { x: c.x, y: c.y } } : n;
    });
    post({ type: 'nodesChanged', reason: 'user', changes });
  }

  // ---- selection ----
  const selectedNodes = $derived(nodes.filter((n) => n.selected && !exitNodes.has(n.id)));
  const selectedEdges = $derived(edges.filter((e) => e.selected));
  $effect(() => {
    ui.toolEdge = selectedEdges.length === 1 && selectedNodes.length === 0 ? selectedEdges[0].id : null;
  });

  let shiftBase: Set<string> | null = null;
  function onselectionstart(e: PointerEvent) {
    shiftBase = e.shiftKey ? new Set(nodes.filter((n) => n.selected).map((n) => n.id)) : null;
  }
  function onselectionend() {
    const base = shiftBase;
    shiftBase = null;
    // A marquee selects the edges between its nodes too; keep the selection to nodes.
    edges = edges.map((e) => (e.selected ? { ...e, selected: false } : e));
    if (base?.size) nodes = nodes.map((n) => (base.has(n.id) && !n.selected ? { ...n, selected: true } : n));
  }

  const selectNone = () => {
    if (nodes.some((n) => n.selected)) nodes = nodes.map((n) => (n.selected ? { ...n, selected: false } : n));
    if (edges.some((e) => e.selected)) edges = edges.map((e) => (e.selected ? { ...e, selected: false } : e));
  };

  // ---- node actions ----
  const colorPatch = (c: string | undefined) => (c ?? null) as never;

  function duplicate(ids: string[]) {
    for (const id of ids) {
      const n = docNode(id);
      if (!n) continue;
      const { id: _id, ...rest } = structuredClone(n);
      post({ type: 'addNode', node: { ...rest, x: n.x + 24, y: n.y + 24 } as never });
    }
  }

  function nodeAction(id: string, action: string) {
    const n = docNode(id);
    if (action === 'duplicate') return duplicate([id]);
    if (action === 'del') return post({ type: 'removeNodes', ids: [id] });
    if (!n) return;
    if (action.startsWith('status:')) {
      return post({ type: 'updateNode', id, patch: { status: action.slice(7) } as Partial<CanvasFileNode> });
    }
    if (n.type === 'file') {
      const flow = nodes.find((q) => q.id === id);
      const code = (flow?.data as FlowData | undefined)?.code;
      const first = (n as FileNode).highlights?.[0]?.start ?? code?.firstLine ?? (n as FileNode).lines?.[0] ?? 1;
      const isDiff = (n as FileNode).display === 'diff'; // whole-file compare: no line-based trace / expand
      if (isDiff && (action === 'callers' || action === 'callees' || action === 'more')) return;
      switch (action) {
        case 'open': return post({ type: 'openFile', path: n.file, line: first });
        case 'callers': return post({ type: 'trace', nodeId: id, line: first, direction: 'incoming' });
        case 'callees': return post({ type: 'trace', nodeId: id, line: first, direction: 'outgoing' });
        case 'more': return post({ type: 'expandRange', nodeId: id, before: 0, after: 10 });
        case 'layout': return fixLayout([id]);
        case 'canvas': return post({ type: 'openCanvas', path: n.file });
      }
    }
    if (action === 'canvas' && n.type === 'text' && n.canvas) return post({ type: 'openCanvas', path: n.canvas });
    if (action === 'open' && n.type === 'link') return post({ type: 'openUrl', url: n.url });
  }

  function moveBoxes(m: Map<string, { x: number; y: number }>) {
    if (!m.size) return;
    nodes = nodes.map((n) => {
      const p = m.get(n.id);
      return p ? { ...n, position: p } : n;
    });
    post({
      type: 'nodesChanged',
      reason: 'user',
      changes: [...m].map(([id, p]) => ({ id, x: Math.round(p.x), y: Math.round(p.y) })),
    });
  }

  function multiAction(action: string) {
    const sel = selectedNodes;
    const ids = sel.map((n) => n.id);
    if (action.startsWith('align:')) return moveBoxes(alignBoxes(sel.map(boxOf), action.slice(6) as Align));
    if (action.startsWith('distribute:')) return moveBoxes(distributeBoxes(sel.map(boxOf), action.slice(11) as 'x' | 'y'));
    if (action === 'group') {
      const g = groupAround(sel.filter((n) => n.type !== 'group').map(boxOf));
      return post({ type: 'addNode', node: { type: 'group', label: 'Group', ...g } });
    }
    if (action === 'layout') return fixLayout(ids);
    if (action === 'del') return post({ type: 'removeNodes', ids });
  }

  // ---- camera helpers ----
  const focusIds = (ids: string[]) => camera.request(ids, { force: true, immediate: true });
  const fitAll = () => void fitView({ padding: 0.1, minZoom: 0.1, maxZoom: 1, duration: dur(400) });
  function zoomToSelection() {
    const sel = selectedNodes;
    if (!sel.length) return fitAll();
    void fitView({ nodes: sel.map((n) => ({ id: n.id })), padding: 0.25, minZoom: 0.1, maxZoom: 1, duration: dur(400) });
  }
  function resetZoom() {
    const v = getViewport();
    const w = wrap?.clientWidth ?? window.innerWidth;
    const h = wrap?.clientHeight ?? window.innerHeight;
    const cx = (w / 2 - v.x) / v.zoom;
    const cy = (h / 2 - v.y) / v.zoom;
    void setViewport({ x: w / 2 - cx, y: h / 2 - cy, zoom: 1 }, { duration: dur(200) });
  }

  // ---- toolbar / command bar ----
  const pinned = $derived(!!docState?.vsCanvas?.pinned);
  const crumbs = $derived.by<Crumb[]>(() => {
    if (!breadcrumbs.length) return [];
    const last = breadcrumbs[breadcrumbs.length - 1];
    if (last.path === canvasPath) return breadcrumbs;
    const title = docState?.vsCanvas?.title || canvasPath.split('/').pop()?.replace(/\.canvas\.json$/i, '') || 'Canvas';
    return [...breadcrumbs, { path: canvasPath, title }];
  });
  const canvasTitle = $derived(docState?.vsCanvas?.title || canvasPath.split('/').pop()?.replace(/\.canvas\.json$/i, '') || '');

  let cmdOpen = $state(false);

  const KIND_ICON: Record<FlowKind, IconName> = {
    code: 'code', fileRef: 'file', note: 'note', sticky: 'sticky', text: 'text', mermaid: 'mermaid', link: 'link',
    group: 'group', finding: 'hypothesis', log: 'log', service: 'service', portal: 'portal', shape: 'shapes', diff: 'diff',
  };
  function nodeTitle(n: Node): string {
    const d = (n.data as FlowData).node;
    if (d.type === 'file') return d.title ?? d.file.split('/').pop() ?? d.file;
    if (d.type === 'link') return d.title ?? d.url;
    if (d.type === 'group') return d.label ?? 'Group';
    return d.title ?? d.text.split('\n')[0].replace(/^#+\s*/, '').slice(0, 60);
  }
  const cmdNodes = $derived.by(() => {
    if (!cmdOpen) return [];
    return nodes
      .filter((n) => !exitNodes.has(n.id))
      .map((n) => {
        const d = (n.data as FlowData).node;
        return {
          id: n.id,
          title: nodeTitle(n),
          path: d.type === 'file' ? d.file : undefined,
          text: d.type === 'text' ? d.text.slice(0, 200) : undefined,
          icon: KIND_ICON[n.type as FlowKind] ?? 'note',
        };
      });
  });
  const cmdCanvases = $derived.by(() => {
    if (!cmdOpen) return [];
    const m = new Map<string, string>();
    for (const c of breadcrumbs) if (c.path !== canvasPath) m.set(c.path, c.title);
    for (const n of docState?.nodes ?? []) {
      if (n.type === 'file' && n.file.endsWith('.canvas.json')) m.set(n.file, n.title ?? n.file.split('/').pop()!.replace(/\.canvas\.json$/i, ''));
      if (n.type === 'text' && n.canvas) m.set(n.canvas, n.title ?? n.canvas.split('/').pop()!.replace(/\.canvas\.json$/i, ''));
    }
    return [...m].map(([path, title]) => ({ path, title }));
  });
  const cmdActions = $derived([
    { id: 'fit', label: 'Fit all', shortcut: '⇧1', icon: 'fit' as IconName },
    { id: 'zoom100', label: 'Reset zoom to 100%', shortcut: '⌘0', icon: 'search' as IconName },
    { id: 'layout', label: 'Fix layout', icon: 'layout' as IconName },
    { id: 'pin', label: pinned ? 'Unpin canvas' : 'Pin canvas', icon: (pinned ? 'pinFilled' : 'pin') as IconName },
    ...QUICK_ADD_ITEMS.map((i) => ({ id: `add:${i.id}`, label: `Add ${i.label.replace('…', '').toLowerCase()}`, icon: i.icon })),
  ]);

  function onCommand(sel: CommandSelection) {
    if (sel.group === 'node') {
      selectNodes([sel.id]);
      focusIds([sel.id]);
    } else if (sel.group === 'canvas') post({ type: 'openCanvas', path: sel.id });
    else if (sel.id === 'fit') fitAll();
    else if (sel.id === 'zoom100') resetZoom();
    else if (sel.id === 'layout') fixLayout();
    else if (sel.id === 'pin') post({ type: 'setPinned', pinned: !pinned });
    else if (sel.id.startsWith('add:')) {
      const c = viewportCenter();
      createKind(sel.id.slice(4), screenToFlowPosition(c));
    }
  }

  // ---- keyboard (canvas focused; never while typing) ----
  const typing = (t: EventTarget | null) => {
    const el = t as HTMLElement | null;
    return !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
  };

  function onkeydown(e: KeyboardEvent) {
    if (typing(e.target) || quick || cmdOpen) return;
    const mod = e.metaKey || e.ctrlKey;
    const k = e.key;
    if (mod && k.toLowerCase() === 'd') {
      e.preventDefault();
      if (selectedNodes.length) duplicate(selectedNodes.map((n) => n.id));
    } else if (mod && k.toLowerCase() === 'a') {
      e.preventDefault();
      nodes = nodes.map((n) => (n.selected || n.type === 'group' ? n : { ...n, selected: true }));
    } else if (mod && k.toLowerCase() === 'g') {
      e.preventDefault();
      if (selectedNodes.length > 1) multiAction('group');
    } else if (mod && k === '0') {
      e.preventDefault();
      resetZoom();
    } else if (e.shiftKey && !mod && e.code === 'Digit1') {
      e.preventDefault();
      fitAll();
    } else if (e.shiftKey && !mod && !e.altKey && e.code === 'KeyS') {
      e.preventDefault();
      toggleShapes();
    } else if (e.shiftKey && !mod && e.code === 'Digit2') {
      e.preventDefault();
      zoomToSelection();
    } else if (!mod && !e.altKey && k === '/') {
      e.preventDefault();
      const c = viewportCenter();
      openQuick(c.x - 160, c.y - 120, { flow: screenToFlowPosition(c) });
    } else if (k === 'Escape') {
      selectNone();
      ui.dropTarget = null;
    } else if (k === 'Enter' && !mod && selectedNodes.length === 1) {
      e.preventDefault();
      ui.requestEdit(selectedNodes[0].id);
      const t = selectedNodes[0].id;
      setTimeout(() => ui.editId === t && (ui.editId = null), 400);
    } else if (k.startsWith('Arrow') && !mod && !e.altKey) {
      if (selectedNodes.length) {
        e.preventDefault();
        const step = e.shiftKey ? 1 : 8;
        const dx = k === 'ArrowLeft' ? -step : k === 'ArrowRight' ? step : 0;
        const dy = k === 'ArrowUp' ? -step : k === 'ArrowDown' ? step : 0;
        moveBoxes(new Map(selectedNodes.map((n) => [n.id, { x: n.position.x + dx, y: n.position.y + dy }])));
      }
    }
  }

  /** Zoom about the viewport centre (the zoom buttons). */
  function zoomBy(f: number) {
    const v = getViewport();
    const z = Math.min(2, Math.max(0.1, v.zoom * f));
    const w = wrap?.clientWidth ?? window.innerWidth;
    const h = wrap?.clientHeight ?? window.innerHeight;
    const cx = (w / 2 - v.x) / v.zoom;
    const cy = (h / 2 - v.y) / v.zoom;
    void setViewport({ x: w / 2 - cx * z, y: h / 2 - cy * z, zoom: z }, { duration: dur(160) });
  }
</script>

<svelte:window {onkeydown} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="wrap"
  class:connecting={ui.connectFrom !== null}
  class:moving={userMoving}
  class:palette-open={shapesOpen}
  style:--cv-label-scale={labelScale}
  style:--cv-far-scale={farScale}
  bind:this={wrap}
  {ondblclick}
  {ondragover}
  {ondrop}
  onpointerdowncapture={(e) => {
    if (!(e.target as Element).closest('.svelte-flow__panel')) pointerDown = true;
  }}
  onwheelcapture={() => (lastWheel = performance.now())}
>
  <SvelteFlow
    bind:nodes
    bind:edges
    {nodeTypes}
    {edgeTypes}
    colorMode={theme.mode}
    connectionMode={ConnectionMode.Loose}
    connectionLineComponent={ConnectionLine}
    zIndexMode="manual"
    zoomOnDoubleClick={false}
    minZoom={0.1}
    maxZoom={2}
    panOnScroll
    panOnScrollSpeed={0.9}
    zoomOnScroll={false}
    zoomOnPinch
    panOnDrag={[1]}
    selectionOnDrag
    selectionKey="F24"
    multiSelectionKey={['Meta', 'Control', 'Shift']}
    deleteKey={['Backspace', 'Delete']}
    disableKeyboardA11y
    clickConnect={false}
    connectionRadius={24}
    onmovestart={(e) => {
      if (e) userMoving = true; // user-initiated pan/zoom (programmatic moves pass no event)
    }}
    onmoveend={() => (userMoving = false)}
    onnodedragstart={({ targetNode, nodes: dragged }) => ondragstart(dragged.length ? dragged : targetNode ? [targetNode] : [])}
    onnodedrag={({ targetNode, nodes: dragged, event }) => ondrag(dragged.length ? dragged : targetNode ? [targetNode] : [], event)}
    onnodedragstop={({ targetNode, nodes: dragged }) => ondragstop(dragged.length ? dragged : targetNode ? [targetNode] : [])}
    onnodepointerenter={({ node }) => (ui.hoverNodeId = node.id)}
    onnodepointerleave={({ node }) => {
      if (ui.hoverNodeId === node.id) ui.hoverNodeId = null;
    }}
    {onselectionstart}
    {onselectionend}
    ondelete={({ nodes: dn, edges: de }) => {
      if (dn.length) post({ type: 'removeNodes', ids: dn.map((n) => n.id) });
      if (de.length) post({ type: 'removeEdges', ids: de.map((e) => e.id) });
    }}
    {onbeforeconnect}
    {onconnectstart}
    {onconnectend}
    onreconnectstart={(_e, edge, type) => (reconnecting = { edge, type: type as 'source' | 'target' })}
    onreconnectend={() => (reconnecting = null)}
    {onbeforereconnect}
  >
    <Background variant={BackgroundVariant.Dots} gap={24} />
    <MiniMap pannable zoomable />
    <Panel position="top-left">
      <div class="top-left">
        <TopToolbar
          {pinned}
          issueCount={diagnostics.length}
          {issueSeverity}
          {issuesOpen}
          {shapesOpen}
          title={crumbs.length > 1 ? undefined : canvasTitle}
          {canvasPath}
          onadd={(r) => {
            const c = viewportCenter();
            openQuick(r.left, r.bottom + 6, { flow: screenToFlowPosition(c) });
          }}
          onshapes={toggleShapes}
          onissues={toggleIssues}
          onpin={() => post({ type: 'setPinned', pinned: !pinned })}
          oncommand={() => (cmdOpen = true)}
        />
        <Breadcrumbs trail={crumbs} onnavigate={(path) => post({ type: 'openCanvas', path })} />
      </div>
    </Panel>
    <Panel position="bottom-left">
      <ZoomControls
        zoom={viewport.current.zoom}
        onzoomout={() => zoomBy(1 / 1.25)}
        onzoomin={() => zoomBy(1.25)}
        onreset={resetZoom}
        onfit={fitAll}
      />
    </Panel>
    {#if issuesOpen && diagnostics.length}
      <Panel position="top-right">
        <IssuesPanel {diagnostics} onselect={selectIssue} onclose={toggleIssues} onfixlayout={() => fixLayout()} onfix={fixIssue} />
      </Panel>
    {/if}
    <ViewportPortal target="back">
      <AlignmentGuides {guides} {distances} zoom={viewport.current.zoom} />
    </ViewportPortal>
    <ViewportPortal target="front">
      {#each badges as b (b.id)}
        <div class="badge-anchor" style:transform={`translate(${b.right}px, ${b.top}px) scale(${badgeScale}) translate(-100%, -60%)`}>
          <LintBadge severity={b.severity} messages={b.messages} />
        </div>
      {/each}
      <DropHighlight zoom={viewport.current.zoom} />
    </ViewportPortal>
    <SelectionChrome
      selected={selectedNodes}
      busy={dragging}
      onaction={nodeAction}
      oncolor={(ids, c) => ids.forEach((id) => post({ type: 'updateNode', id, patch: { color: colorPatch(c) } }))}
      onmulti={multiAction}
    />
  </SvelteFlow>

  <CommandBar bind:open={cmdOpen} nodes={cmdNodes} canvases={cmdCanvases} actions={cmdActions} onselect={onCommand} />

  {#if shapesOpen}
    <ShapePalette onadd={addShapeAtCenter} onclose={toggleShapes} />
  {/if}

  {#if quick}
    <QuickAddMenu x={quick.sx} y={quick.sy} frames={!quick.from} onselect={chooseQuick} onclose={() => (quick = null)} />
  {/if}

  {#if nodes.length === 0}
    <EmptyState {mcpUrl} />
  {/if}
</div>

<style>
  .wrap {
    position: relative;
    width: 100%;
    height: 100%;
  }
  /* The palette overlays the left edge: the top-left and bottom-left chrome steps aside. */
  .wrap.palette-open :global(.svelte-flow__panel.left) {
    margin-left: 255px;
  }
  .top-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .badge-anchor {
    position: absolute;
    left: 0;
    top: 0;
    transform-origin: 0 0;
    pointer-events: auto;
    z-index: 5;
  }
</style>
