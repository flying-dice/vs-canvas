// Pure auto-layout for a set of canvas nodes. No vscode import.
// Returns moves instead of mutating, so callers can apply them inside a single document edit.
import type { CanvasFile, CanvasFileNode } from '../shared/canvasFile';
import { fixCanvas, type LintOptions } from '../shared/lint';
import { contains, findFree, groupLabelRect, rectOf, type Blockers, type Rect } from '../shared/geometry';

export const LAYER_GAP = 120;
export const NODE_GAP = 32;

export type LayoutAlgorithm = 'layered' | 'grid' | 'column';
export type LayoutMove = { id: string; x: number; y: number };
export type LayoutOptions = {
  algorithm?: LayoutAlgorithm;
  /** Keep this node (it must be in the set) exactly where it is; everything else is laid out around it. */
  anchor?: string;
  /** Top-left of the result. Defaults to the top-left of the set's current bounding box. */
  origin?: { x: number; y: number };
  layerGap?: number;
  nodeGap?: number;
  /** layered only: 'LR' (default) puts layers in columns left to right; 'TB' puts them in rows top to bottom. */
  direction?: 'LR' | 'TB';
};

type Pos = Map<string, { x: number; y: number }>;

/** Longest-path layers (cycles broken by ignoring back edges found by DFS in node order). */
export function assignLayers(ids: string[], edges: { from: string; to: string }[]): Map<string, number> {
  const idx = new Map(ids.map((id, i) => [id, i]));
  const out = new Map<string, string[]>(ids.map((id) => [id, []]));
  const seen = new Set<string>();
  for (const e of edges) {
    if (e.from === e.to || !idx.has(e.from) || !idx.has(e.to)) continue;
    const k = `${e.from}\0${e.to}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.get(e.from)!.push(e.to);
  }
  // Drop back edges.
  const state = new Map<string, 0 | 1 | 2>();
  const dag = new Map<string, string[]>(ids.map((id) => [id, []]));
  const visit = (u: string) => {
    state.set(u, 1);
    for (const v of out.get(u)!) {
      const st = state.get(v) ?? 0;
      if (st === 1) continue; // back edge
      dag.get(u)!.push(v);
      if (st === 0) visit(v);
    }
    state.set(u, 2);
  };
  for (const id of ids) if (!state.has(id)) visit(id);
  // Longest path via memoised DFS over the DAG.
  const layer = new Map<string, number>();
  const preds = new Map<string, string[]>(ids.map((id) => [id, []]));
  for (const [u, vs] of dag) for (const v of vs) preds.get(v)!.push(u);
  const depth = (v: string): number => {
    const known = layer.get(v);
    if (known !== undefined) return known;
    const l = preds.get(v)!.reduce((m, p) => Math.max(m, depth(p) + 1), 0);
    layer.set(v, l);
    return l;
  };
  ids.forEach(depth);
  // Pull sources (nodes with no incoming edges, e.g. a stack trace or a finding pointing at code) into the layer
  // just before their nearest successor, so evidence sits next to what it explains instead of in column 0.
  for (const id of ids) {
    if (preds.get(id)!.length) continue;
    const succ = dag.get(id)!;
    if (!succ.length) continue;
    const target = Math.min(...succ.map((v) => layer.get(v)!)) - 1;
    if (target > layer.get(id)!) layer.set(id, target);
  }
  return layer;
}

function layered(nodes: CanvasFileNode[], edges: CanvasFile['edges'], o: Required<Pick<LayoutOptions, 'layerGap' | 'nodeGap' | 'direction'>>): Pos {
  const ids = nodes.map((n) => n.id);
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const es = edges.map((e) => ({ from: e.fromNode, to: e.toNode }));
  const layerOf = assignLayers(ids, es);
  const depthMax = Math.max(0, ...layerOf.values());
  const cols: string[][] = Array.from({ length: depthMax + 1 }, () => []);
  ids.forEach((id) => cols[layerOf.get(id)!].push(id));

  // Barycenter ordering: sweep down (by predecessors) and up (by successors) a few times.
  const neighbours = (id: string, dir: 'in' | 'out') =>
    es.filter((e) => (dir === 'in' ? e.to === id : e.from === id) && layerOf.has(e.from) && layerOf.has(e.to))
      .map((e) => (dir === 'in' ? e.from : e.to));
  const rank = new Map<string, number>();
  const reindex = () => cols.forEach((c) => c.forEach((id, i) => rank.set(id, i)));
  reindex();
  const sweep = (order: number[], dir: 'in' | 'out') => {
    for (const l of order) {
      const bary = new Map<string, number>();
      cols[l].forEach((id, i) => {
        const ns = neighbours(id, dir).filter((n) => layerOf.get(n) !== l);
        bary.set(id, ns.length ? ns.reduce((s, n) => s + rank.get(n)!, 0) / ns.length : i);
      });
      cols[l] = [...cols[l]].sort((a, b) => bary.get(a)! - bary.get(b)! || rank.get(a)! - rank.get(b)!);
      cols[l].forEach((id, i) => rank.set(id, i));
    }
  };
  const asc = cols.map((_, i) => i);
  for (let pass = 0; pass < 4; pass++) {
    sweep(asc.slice(1), 'in');
    sweep([...asc].reverse().slice(1), 'out');
  }

  const pos: Pos = new Map();
  const tb = o.direction === 'TB';
  // main = axis along which layers advance, cross = axis nodes of one layer are stacked on
  const mainOf = (n: CanvasFileNode) => (tb ? n.height : n.width);
  const crossOf = (n: CanvasFileNode) => (tb ? n.width : n.height);
  let main = 0;
  const extents = cols.map((c) => c.reduce((s, id) => s + crossOf(byId.get(id)!), 0) + Math.max(0, c.length - 1) * o.nodeGap);
  const widest = Math.max(0, ...extents);
  cols.forEach((c, l) => {
    let cross = (widest - extents[l]) / 2;
    let size = 0;
    for (const id of c) {
      const n = byId.get(id)!;
      pos.set(id, tb ? { x: cross, y: main } : { x: main, y: cross });
      cross += crossOf(n) + o.nodeGap;
      size = Math.max(size, mainOf(n));
    }
    main += size + o.layerGap;
  });
  return pos;
}

function column(nodes: CanvasFileNode[], gap: number): Pos {
  const pos: Pos = new Map();
  let y = 0;
  for (const n of nodes) {
    pos.set(n.id, { x: 0, y });
    y += n.height + gap;
  }
  return pos;
}

function grid(nodes: CanvasFileNode[], gap: number): Pos {
  const pos: Pos = new Map();
  const cols = Math.max(1, Math.ceil(Math.sqrt(nodes.length)));
  const rows: CanvasFileNode[][] = [];
  nodes.forEach((n, i) => (rows[Math.floor(i / cols)] ??= []).push(n));
  const colW = Array.from({ length: cols }, (_, c) => Math.max(0, ...rows.map((r) => r[c]?.width ?? 0)));
  let y = 0;
  for (const r of rows) {
    let x = 0;
    r.forEach((n, c) => {
      pos.set(n.id, { x, y });
      x += colW[c] + gap;
    });
    y += Math.max(...r.map((n) => n.height)) + gap;
  }
  return pos;
}

/**
 * Compute new positions for the non-group nodes among `ids`. Nodes not in the set never move and are avoided:
 * the whole arrangement is shifted clear of them, and any node that still collides is pushed with `findFree`.
 * Positions are integers. Unknown ids are ignored.
 */
export function layoutNodes(file: CanvasFile, ids: string[], opts: LayoutOptions = {}): LayoutMove[] {
  const wanted = new Set(ids);
  const nodes = file.nodes.filter((n) => wanted.has(n.id) && n.type !== 'group');
  if (!nodes.length) return [];
  const layerGap = opts.layerGap ?? LAYER_GAP;
  const nodeGap = opts.nodeGap ?? NODE_GAP;
  const inSet = new Set(nodes.map((n) => n.id));
  const edges = file.edges.filter((e) => inSet.has(e.fromNode) && inSet.has(e.toNode) && e.fromNode !== e.toNode);

  const rel =
    opts.algorithm === 'grid' ? grid(nodes, nodeGap)
      : opts.algorithm === 'column' ? column(nodes, nodeGap)
        : layered(nodes, edges, { layerGap, nodeGap, direction: opts.direction ?? 'LR' });

  const anchor = opts.anchor ? nodes.find((n) => n.id === opts.anchor) : undefined;
  const box = nodes.reduce(
    (b, n) => ({ x: Math.min(b.x, n.x), y: Math.min(b.y, n.y) }),
    { x: Infinity, y: Infinity },
  );
  const origin = opts.origin ?? box;
  let dx = origin.x;
  let dy = origin.y;
  if (anchor) {
    const a = rel.get(anchor.id)!;
    dx = anchor.x - a.x;
    dy = anchor.y - a.y;
  }

  // Blockers: everything not being laid out, except groups that hold part of the set (nodes may stay inside them).
  const fixedSolids = file.nodes.filter((n) => n.type !== 'group' && !inSet.has(n.id));
  const setRects = nodes.map(rectOf);
  const groups = file.nodes
    .filter((n) => n.type === 'group' && !wanted.has(n.id) && !setRects.some((r) => contains(rectOf(n), r)))
    .map((g) => ({ id: g.id, rect: rectOf(g), label: g.type === 'group' ? groupLabelRect(g) : undefined }));
  const blockers: Blockers = { solids: fixedSolids.map(rectOf), groups };
  const none = new Set<string>();

  // Shift the whole arrangement clear of fixed nodes when it has no anchor.
  if (!anchor && (blockers.solids.length || groups.length)) {
    const bounds = [...rel].reduce(
      (b, [id, p]) => {
        const n = nodes.find((m) => m.id === id)!;
        return { x2: Math.max(b.x2, p.x + n.width), y2: Math.max(b.y2, p.y + n.height) };
      },
      { x2: 0, y2: 0 },
    );
    const start: Rect = { x: dx, y: dy, w: bounds.x2, h: bounds.y2 };
    const free = findFree(start, blockers, nodeGap, none, ['right', 'down']);
    if (free) {
      dx = free.x;
      dy = free.y;
    }
  }

  const placed: Rect[] = anchor ? [rectOf(anchor)] : [];
  const moves: LayoutMove[] = [];
  for (const n of nodes) {
    const p = rel.get(n.id)!;
    let r: Rect = { x: Math.round(p.x + dx), y: Math.round(p.y + dy), w: n.width, h: n.height };
    if (n.id !== anchor?.id) {
      const f = findFree(r, { ...blockers, solids: [...blockers.solids, ...placed] }, nodeGap, none, ['down', 'right']);
      if (f) r = f;
    }
    placed.push(r);
    moves.push({ id: n.id, x: Math.round(r.x), y: Math.round(r.y) });
  }
  return moves;
}

/** Apply layout moves in place. */
export function applyMoves(file: CanvasFile, moves: LayoutMove[]): void {
  const byId = new Map(file.nodes.map((n) => [n.id, n]));
  for (const m of moves) {
    const n = byId.get(m.id);
    if (n) {
      n.x = m.x;
      n.y = m.y;
    }
  }
}

/**
 * Run the linter's automatic layout fixes, but keep only the geometry changes of `ids`; every other node stays where
 * it is. Mutates `file`. Returns the number of nodes that moved or resized.
 */
export function fixOnly(file: CanvasFile, ids: string[], opts: LintOptions = {}): number {
  const want = new Set(ids);
  const res = fixCanvas(file, opts);
  const fixed = new Map(res.canvas.nodes.map((n) => [n.id, n]));
  let changed = 0;
  for (const n of file.nodes) {
    const f = fixed.get(n.id);
    if (!want.has(n.id) || !f) continue;
    if (n.x !== f.x || n.y !== f.y || n.width !== f.width || n.height !== f.height) changed++;
    n.x = f.x;
    n.y = f.y;
    n.width = f.width;
    n.height = f.height;
  }
  return changed;
}
