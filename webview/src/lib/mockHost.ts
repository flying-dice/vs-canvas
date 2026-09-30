// A tiny in-browser stand-in for the extension host (standalone `vite dev` demos only). It applies the edits the
// webview posts to a demo document and echoes a fresh 'document' (then 'select' for new nodes), so every
// interaction can be exercised outside VS Code. It is not a faithful host: layout fixes use the shared linter,
// tracing adds a placeholder node, file picking invents a file.
import { fixCanvas } from '../../../src/shared/lint';
import { defaultRelation, markerToEnd } from '../../../src/shared/shapes';
import type {
  CanvasFile,
  CanvasFileEdge,
  CanvasFileNode,
  FileNode,
  FromWebview,
  ResolvedCode,
  ToWebview,
} from '../../../src/shared/protocol';

type Doc = Extract<ToWebview, { type: 'document' }>;

export type MockHost = { handle(msg: FromWebview): void; dispose(): void };

export function createMockHost(initial: Doc, send: (m: ToWebview) => void): MockHost {
  const canvas: CanvasFile = structuredClone(initial.canvas);
  const code: Record<string, ResolvedCode> = structuredClone(initial.code);
  let counter = 0;
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const later = (fn: () => void, ms: number) => {
    const t = setTimeout(() => {
      timers.delete(t);
      fn();
    }, ms);
    timers.add(t);
  };

  // Known source lines per file, built from the demo's resolved code; anything else is filler.
  const source = new Map<string, Map<number, string>>();
  for (const n of canvas.nodes) {
    const c = code[n.id];
    if (n.type !== 'file' || !c) continue;
    const m = source.get(n.file) ?? source.set(n.file, new Map()).get(n.file)!;
    c.lines.forEach((t, i) => m.set(c.firstLine + i, t));
  }
  const totalOf = new Map<string, number>();
  for (const n of canvas.nodes) if (n.type === 'file' && code[n.id]) totalOf.set(n.file, code[n.id].totalLines);

  function resolve(n: FileNode): ResolvedCode {
    const [a, b] = n.lines ?? [1, 12];
    const m = source.get(n.file) ?? source.set(n.file, new Map()).get(n.file)!;
    const lines: string[] = [];
    for (let i = a; i <= b; i++) lines.push(m.get(i) ?? `  // ${n.file.split('/').pop()}:${i}`);
    return {
      absPath: `/demo/acme-shop/${n.file}`,
      language: n.file.endsWith('.tsx') ? 'tsx' : 'typescript',
      firstLine: a,
      lines,
      totalLines: Math.max(totalOf.get(n.file) ?? 120, b),
    };
  }

  const id = (p: string) => {
    let v: string;
    do v = `${p}${++counter}`;
    while (canvas.nodes.some((n) => n.id === v) || canvas.edges.some((e) => e.id === v));
    return v;
  };

  let echoTimer: ReturnType<typeof setTimeout> | undefined;
  const pendingSelect: { nodeIds: string[]; edit?: boolean }[] = [];
  function echo() {
    clearTimeout(echoTimer);
    echoTimer = setTimeout(() => {
      for (const n of canvas.nodes) if (n.type === 'file' && n.display !== 'reference' && n.display !== 'diff' && !n.file.endsWith('.canvas.json') && !code[n.id]?.error) code[n.id] = resolve(n);
      send({ ...initial, canvas: structuredClone(canvas), code: structuredClone(code) });
      for (const s of pendingSelect.splice(0)) send({ type: 'select', nodeIds: s.nodeIds, ...(s.edit && { edit: true }) });
    }, 30);
  }

  function addNode(spec: Omit<CanvasFileNode, 'id'>, at?: { x: number; y: number }): CanvasFileNode {
    const n = { ...spec, id: id('n') } as CanvasFileNode;
    if (at) {
      n.x = at.x;
      n.y = at.y;
    }
    canvas.nodes.push(n);
    return n;
  }
  /** Like the real host: connecting two shapes of one library applies that library's default relation. */
  function withRelation(e: Omit<CanvasFileEdge, 'id'>): Omit<CanvasFileEdge, 'id'> {
    if (e.relation || e.fromMarker || e.toMarker || e.routing || e.lineStyle) return e;
    const shapeOf = (nid: string) => {
      const n = canvas.nodes.find((q) => q.id === nid);
      return n && (n.type === 'text' || n.type === 'group') ? n.shape : undefined;
    };
    const r = defaultRelation(shapeOf(e.fromNode), shapeOf(e.toNode));
    if (!r) return e;
    return {
      ...e,
      relation: r.id,
      ...(r.fromMarker ? { fromMarker: r.fromMarker } : {}),
      toMarker: r.toMarker,
      fromEnd: markerToEnd(r.fromMarker) ?? 'none',
      toEnd: markerToEnd(r.toMarker) ?? 'none',
      ...(r.lineStyle ? { lineStyle: r.lineStyle } : {}),
      ...(r.routing ? { routing: r.routing } : {}),
    };
  }
  function addEdge(e: Omit<CanvasFileEdge, 'id'>): CanvasFileEdge {
    const edge = { ...withRelation(e), id: id('e') } as CanvasFileEdge;
    for (const k of Object.keys(edge) as (keyof CanvasFileEdge)[]) if (edge[k] === undefined) delete edge[k];
    canvas.edges.push(edge);
    return edge;
  }
  function connectFrom(from: Extract<FromWebview, { type: 'addConnected' }>['from'], nodeId: string) {
    addEdge(
      from.handleType === 'source'
        ? { fromNode: from.nodeId, fromLine: from.line, fromSide: from.line ? undefined : from.side, toNode: nodeId }
        : { fromNode: nodeId, toNode: from.nodeId, toLine: from.line, toSide: from.line ? undefined : from.side },
    );
  }
  function removeNodes(ids: string[]) {
    const s = new Set(ids);
    canvas.nodes = canvas.nodes.filter((n) => !s.has(n.id));
    canvas.edges = canvas.edges.filter((e) => !s.has(e.fromNode) && !s.has(e.toNode));
  }

  function handle(m: FromWebview) {
    switch (m.type) {
      case 'nodesChanged':
        for (const c of m.changes) {
          const n = canvas.nodes.find((q) => q.id === c.id);
          if (!n) continue;
          n.x = c.x;
          n.y = c.y;
          if (c.width !== undefined) n.width = c.width;
          if (c.height !== undefined) n.height = c.height;
        }
        if (m.reason === 'user') echo();
        break;
      case 'addNode':
        addNode(m.node as Omit<CanvasFileNode, 'id'>);
        echo();
        break;
      case 'addConnected': {
        const n = addNode(m.node as Omit<CanvasFileNode, 'id'>);
        connectFrom(m.from, n.id);
        pendingSelect.push({ nodeIds: [n.id], edit: n.type === 'text' });
        echo();
        break;
      }
      case 'pickFile': {
        const n = addNode({
          type: 'file', file: 'src/demo/picked.ts', display: 'code', lines: [1, 8], x: m.at.x, y: m.at.y, width: 520, height: 184,
        } as Omit<CanvasFileNode, 'id'>);
        if (m.from) connectFrom(m.from, n.id);
        pendingSelect.push({ nodeIds: [n.id] });
        echo();
        break;
      }
      case 'updateNode': {
        const n = canvas.nodes.find((q) => q.id === m.id);
        if (!n) break;
        for (const [k, v] of Object.entries(m.patch)) {
          if (k === 'id' || k === 'type') continue;
          if (v === undefined || v === null) delete (n as Record<string, unknown>)[k];
          else (n as Record<string, unknown>)[k] = v;
        }
        echo();
        break;
      }
      case 'updateEdge': {
        const e = canvas.edges.find((q) => q.id === m.id);
        if (!e) break;
        for (const [k, v] of Object.entries(m.patch)) {
          if (k === 'id' || k === 'fromNode' || k === 'toNode') continue;
          if (v === undefined || v === null || v === '') delete (e as unknown as Record<string, unknown>)[k];
          else (e as unknown as Record<string, unknown>)[k] = v;
        }
        echo();
        break;
      }
      case 'removeNodes':
        removeNodes(m.ids);
        echo();
        break;
      case 'removeEdges':
        canvas.edges = canvas.edges.filter((e) => !m.ids.includes(e.id));
        echo();
        break;
      case 'connect':
        addEdge(m.edge);
        echo();
        break;
      case 'setPinned':
        canvas.vsCanvas = { ...canvas.vsCanvas, version: 1, ...(m.pinned ? { pinned: true } : {}) };
        if (!m.pinned) delete canvas.vsCanvas.pinned;
        echo();
        break;
      case 'fixLayout': {
        const r = fixCanvas(canvas);
        const want = m.nodeIds?.length ? new Set(m.nodeIds) : null;
        for (const f of r.canvas.nodes) {
          const n = canvas.nodes.find((q) => q.id === f.id);
          if (!n || (want && !want.has(n.id))) continue;
          n.x = f.x;
          n.y = f.y;
          n.width = f.width;
          n.height = f.height;
        }
        if (!want) canvas.edges = r.canvas.edges;
        echo();
        break;
      }
      case 'expandRange': {
        const n = canvas.nodes.find((q) => q.id === m.nodeId);
        if (n?.type === 'file' && n.lines) {
          n.lines = [Math.max(1, n.lines[0] - m.before), n.lines[1] + m.after];
          n.height += (m.before + m.after) * 18;
          echo();
        }
        break;
      }
      case 'trace': {
        const n = canvas.nodes.find((q) => q.id === m.nodeId);
        if (!n) break;
        const out = m.direction === 'outgoing';
        const t = addNode({
          type: 'file', file: `src/demo/${out ? 'callee' : 'caller'}.ts`, display: 'code', lines: [1, 6],
          x: out ? n.x + n.width + 120 : n.x - 640, y: n.y, width: 520, height: 150,
        } as Omit<CanvasFileNode, 'id'>);
        addEdge(out ? { fromNode: n.id, fromLine: m.line, toNode: t.id } : { fromNode: t.id, toNode: n.id, toLine: m.line });
        pendingSelect.push({ nodeIds: [t.id] });
        echo();
        break;
      }
      default:
        console.debug('[vs-canvas] (mock host) ignored', m);
    }
  }

  return {
    handle,
    dispose() {
      clearTimeout(echoTimer);
      timers.forEach(clearTimeout);
    },
  };
}
