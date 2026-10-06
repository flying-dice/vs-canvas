// Pure functions on the on-disk canvas document. No vscode import, so this can be unit tested with plain node.
import type {
  CanvasFile, CanvasFileEdge, CanvasFileNode, FileNode, GroupNode, LineHighlight, Side,
} from '../shared/canvasFile';
import {
  GEOMETRY, area, contains, edgeGeometry, findFree, groupLabelRect, inflate, intersectionArea, polylineHitsRect, rectOf,
  type Dir, type Rect,
} from '../shared/geometry';
import { LINT_DEFAULTS } from '../shared/lint';
import { markerToEnd, relationById, shapeById } from '../shared/shapes';

export const GAP = 80;
export const GROUP_PAD = 40;
export const GROUP_LABEL = 36;

export type PlaceSide = Side | 'below' | 'above';
export type Placement = { x?: number; y?: number; near?: string; side?: PlaceSide };
export type { Rect };
export type IdKind =
  | 'code' | 'ref' | 'note' | 'sticky' | 'text' | 'mermaid' | 'link' | 'group' | 'edge' | 'hl'
  | 'finding' | 'log' | 'service' | 'portal' | 'shape' | 'diff';
export type SizeKind =
  | 'code' | 'reference' | 'note' | 'sticky' | 'text' | 'mermaid' | 'link' | 'group' | 'finding' | 'log' | 'service' | 'portal' | 'shape' | 'diff';

type Distribute<T> = T extends unknown ? Omit<T, 'id' | 'x' | 'y' | 'width' | 'height'> : never;
/** A new node before an id and geometry are assigned. Explicit x/y/width/height are honoured. */
export type NodeSpec = Distribute<CanvasFileNode> & { x?: number; y?: number; width?: number; height?: number };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

// ---------- sizes ----------

export function codeSize(lineCount: number, longestLine = 60): { w: number; h: number } {
  return { w: Math.min(1000, Math.max(420, longestLine * 7.5 + 70)), h: Math.max(1, lineCount) * 18 + 36 };
}

export function defaultSize(kind: SizeKind, opts: { lineCount?: number; longestLine?: number } = {}): { w: number; h: number } {
  switch (kind) {
    case 'code': return codeSize(opts.lineCount ?? 20, opts.longestLine);
    case 'reference': return { w: 320, h: 56 };
    case 'note': return { w: 360, h: 220 };
    case 'sticky': return { w: 220, h: 180 };
    case 'text': return { w: 400, h: 60 };
    case 'mermaid': return { w: 480, h: 360 };
    case 'link': return { w: 320, h: 72 };
    case 'group': return { w: 600, h: 400 };
    case 'finding': return { w: 280, h: 150 };
    case 'log': return { w: 520, h: logHeight(opts.lineCount ?? 8) };
    case 'service': return { w: 320, h: 200 };
    case 'portal': return { w: 360, h: 240 };
    case 'shape': return { w: 176, h: 72 };
    case 'diff': return { w: 560, h: 420 };
  }
}

/** Height of a log card for `lineCount` lines of text (header + 18px lines), capped at 420 (the card scrolls). */
export function logHeight(lineCount: number): number {
  return Math.min(420, Math.max(120, 40 + Math.max(1, lineCount) * 18));
}

export const isCanvasPath = (p: string | undefined) => !!p && p.toLowerCase().endsWith('.canvas.json');

type KindProbe = Pick<CanvasFileNode, 'type'> & Partial<{ display: string; variant: string; file: string }>;

export function sizeKindOf(n: KindProbe): SizeKind {
  switch (n.type) {
    case 'file': return isCanvasPath(n.file) ? 'portal' : n.display === 'reference' ? 'reference' : n.display === 'diff' ? 'diff' : 'code';
    case 'text':
      return n.variant === 'sticky' ? 'sticky' : n.variant === 'plain' ? 'text' : n.variant === 'mermaid' ? 'mermaid'
        : n.variant === 'finding' ? 'finding' : n.variant === 'log' ? 'log' : n.variant === 'service' ? 'service'
          : n.variant === 'shape' ? 'shape' : 'note';
    case 'link': return 'link';
    case 'group': return 'group';
  }
}

/** Default size of a node: the shape's size for shape nodes and frames, else by kind (unknown shapes get the generic shape size). */
export function nodeDefaultSize(
  n: KindProbe & { shape?: string }, opts: { lineCount?: number; longestLine?: number } = {},
): { w: number; h: number } {
  const def = (n.type === 'group' || (n.type === 'text' && n.variant === 'shape')) ? shapeById(n.shape) : undefined;
  return def ? { w: def.size[0], h: def.size[1] } : defaultSize(sizeKindOf(n), opts);
}

export function idKindOf(n: KindProbe): IdKind {
  switch (n.type) {
    case 'file': return isCanvasPath(n.file) ? 'portal' : n.display === 'reference' ? 'ref' : n.display === 'diff' ? 'diff' : 'code';
    case 'text':
      return n.variant === 'sticky' ? 'sticky' : n.variant === 'plain' ? 'text' : n.variant === 'mermaid' ? 'mermaid'
        : n.variant === 'finding' ? 'finding' : n.variant === 'log' ? 'log' : n.variant === 'service' ? 'service'
          : n.variant === 'shape' ? 'shape' : 'note';
    case 'link': return 'link';
    case 'group': return 'group';
  }
}

// ---------- subpath / lines ----------

export const subpathFor = (lines: [number, number]) => `#L${lines[0]}-L${lines[1]}`;

export function parseSubpath(s: string | undefined): [number, number] | undefined {
  const m = s ? /^#L(\d+)(?:-L?(\d+))?$/.exec(s) : null;
  if (!m) return undefined;
  const a = Number(m[1]);
  const b = m[2] ? Number(m[2]) : a;
  return a >= 1 && b >= a ? [a, b] : undefined;
}

/** Keep `subpath` in sync with `lines` on a file node (mutates). */
export function syncSubpath<T extends CanvasFileNode>(n: T): T {
  if (n.type !== 'file') return n;
  if (n.display === 'diff') delete n.subpath;
  else if (n.lines) n.subpath = subpathFor(n.lines);
  else delete n.subpath;
  return n;
}

// ---------- parse / serialize ----------

export function parseCanvas(text: string, label = 'canvas file'): CanvasFile {
  if (!text.trim()) return { nodes: [], edges: [] };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    throw new Error(`Invalid JSON in ${label}: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (!isObj(raw)) throw new Error(`Invalid canvas in ${label}: the top level must be a JSON object with "nodes" and "edges".`);
  const nodes = (Array.isArray(raw.nodes) ? raw.nodes : []).filter(isObj).map((n) => {
    const node = { ...n } as unknown as CanvasFileNode;
    const d = nodeDefaultSize(node as never);
    if (!num(node.x)) node.x = 0;
    if (!num(node.y)) node.y = 0;
    if (!num(node.width)) node.width = d.w;
    if (!num(node.height)) node.height = d.h;
    if (node.type === 'file' && !node.lines) {
      const l = parseSubpath(node.subpath);
      if (l) node.lines = l;
    }
    return node;
  });
  const edges = (Array.isArray(raw.edges) ? raw.edges : []).filter(isObj).map((e) => ({ ...e }) as unknown as CanvasFileEdge);
  // Files written before the rebrand keep their metadata under the old key.
  const { canvasIde: legacyMeta, ...rest } = raw as Record<string, unknown>;
  const out = { ...rest, nodes, edges } as CanvasFile;
  if (!out.vsCanvas && isObj(legacyMeta)) out.vsCanvas = legacyMeta as CanvasFile['vsCanvas'];
  // Playable flows were removed; drop the stray key from old files so it is never written back.
  if (isObj(out.vsCanvas) && 'flows' in out.vsCanvas) {
    const { flows: _flows, ...meta } = out.vsCanvas as Record<string, unknown>;
    out.vsCanvas = meta as CanvasFile['vsCanvas'];
  }
  return out;
}

const NODE_KEYS = ['id', 'type', 'x', 'y', 'width', 'height', 'color'];
const KEYS: Record<CanvasFileNode['type'], string[]> = {
  text: [...NODE_KEYS, 'text', 'variant', 'shape', 'fields', 'title', 'findingKind', 'status', 'errorLines', 'entryPoints', 'tags', 'canvas'],
  file: [...NODE_KEYS, 'file', 'subpath', 'display', 'lines', 'highlights', 'title'],
  link: [...NODE_KEYS, 'url', 'title'],
  group: [...NODE_KEYS, 'label', 'sublabel', 'shape'],
};
const EDGE_KEYS = [
  'id', 'fromNode', 'fromSide', 'fromEnd', 'toNode', 'toSide', 'toEnd', 'color', 'label', 'sublabel', 'fromLine', 'toLine', 'animated',
  'relation', 'fromMarker', 'toMarker', 'lineStyle', 'routing',
];
const HL_KEYS = ['id', 'start', 'end', 'color', 'label'];
const META_KEYS = ['version', 'title', 'description', 'kind', 'pinned'];
const ENTRY_KEYS = ['file', 'lines', 'label'];
const ROUNDED = new Set(['x', 'y', 'width', 'height']);

function ordered(obj: Record<string, unknown>, keys: string[], round = false): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const put = (k: string) => {
    const v = obj[k];
    if (v === undefined) return;
    out[k] = round && ROUNDED.has(k) && num(v) ? Math.round(v) : v;
  };
  keys.forEach(put);
  Object.keys(obj).filter((k) => !keys.includes(k)).forEach(put);
  return out;
}

/** Keep JSON Canvas fromEnd/toEnd equal to the closest equivalent of the rich markers (mutates and returns `e`). */
export function syncEnds<T extends CanvasFileEdge>(e: T): T {
  const f = markerToEnd(e.fromMarker);
  const t = markerToEnd(e.toMarker);
  if (f) e.fromEnd = f;
  if (t) e.toEnd = t;
  return e;
}

/** Fill markers/lineStyle/routing from the edge's `relation` preset; fields already set win. Unknown relations are left alone. */
export function expandRelation<T extends Omit<CanvasFileEdge, 'id'>>(e: T): T {
  const rel = relationById(e.relation);
  if (!rel) return e;
  if (e.fromMarker === undefined && rel.fromMarker !== undefined) e.fromMarker = rel.fromMarker;
  if (e.toMarker === undefined) e.toMarker = rel.toMarker;
  if (e.lineStyle === undefined && rel.lineStyle !== undefined) e.lineStyle = rel.lineStyle;
  if (e.routing === undefined && rel.routing !== undefined) e.routing = rel.routing;
  return e;
}

export function serializeCanvas(file: CanvasFile): string {
  const nodes = file.nodes.map((n) => {
    const o = ordered(n as unknown as Record<string, unknown>, KEYS[n.type] ?? NODE_KEYS, true);
    if (Array.isArray(o.highlights)) o.highlights = o.highlights.map((h) => ordered(h as Record<string, unknown>, HL_KEYS));
    if (Array.isArray(o.lines)) o.lines = o.lines.map((v) => Math.round(v as number));
    if (Array.isArray(o.entryPoints)) o.entryPoints = o.entryPoints.map((h) => ordered(h as Record<string, unknown>, ENTRY_KEYS));
    if (isObj(o.fields)) o.fields = ordered(o.fields, shapeById(o.shape as string | undefined)?.fields?.map((f) => f.key) ?? []);
    return o;
  });
  const edges = file.edges.map((e) => ordered(syncEnds({ ...e }) as unknown as Record<string, unknown>, EDGE_KEYS));
  const out: Record<string, unknown> = {};
  if (typeof file.$schema === 'string') out.$schema = file.$schema;
  out.nodes = nodes;
  out.edges = edges;
  if (file.vsCanvas) {
    const meta = ordered(file.vsCanvas as Record<string, unknown>, META_KEYS);
    delete meta.flows; // legacy playable flows are never written
    out.vsCanvas = meta;
  }
  for (const [k, v] of Object.entries(file)) if (!(k in out) && v !== undefined) out[k] = v;
  // Keep `lines` pairs on one line. Real newlines never occur inside JSON strings, so this cannot touch text values.
  return JSON.stringify(out, null, 2).replace(/\[\s*(\d+),\s*(\d+)\s*\]/g, '[$1, $2]') + '\n';
}

// ---------- ids ----------

const ID_RE = /^[A-Za-z]+-(\d+)$/;

function allIds(file: CanvasFile): string[] {
  const ids: string[] = [];
  for (const n of file.nodes) {
    ids.push(n.id);
    if (n.type === 'file') n.highlights?.forEach((h) => ids.push(h.id));
  }
  file.edges.forEach((e) => ids.push(e.id));
  return ids;
}

export function newId(file: CanvasFile, kind: IdKind): string {
  const ids = allIds(file);
  let max = 0;
  for (const id of ids) {
    const m = ID_RE.exec(id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${kind}-${max + 1}`;
}

// ---------- lookup ----------

export const findNode = (file: CanvasFile, id: string) => file.nodes.find((n) => n.id === id);

export function requireNode(file: CanvasFile, id: string): CanvasFileNode {
  const n = findNode(file, id);
  if (!n) throw new Error(`Node "${id}" not found. Use canvas_get_state to list nodes.`);
  return n;
}

// ---------- placement ----------

/**
 * Pick a position for a new w x h node. Groups are spatial frames, so a new node never straddles a group border:
 * when `near` is a member of a group the node goes fully inside it if there is room, otherwise fully outside.
 * It keeps the lint minimum gap to other nodes. Explicit x and y are honoured as given.
 */
export function placeNode(file: CanvasFile, p: Placement, w: number, h: number): { x: number; y: number } {
  if (p.x !== undefined && p.y !== undefined) return { x: p.x, y: p.y };
  const solids = file.nodes.filter((n) => n.type !== 'group');
  const groups = file.nodes.filter((n): n is GroupNode => n.type === 'group');
  let x = 0;
  let y = 0;
  let dirs: Dir[] = ['down', 'right', 'up', 'left']; // collision shift preference
  const anchor = p.near ? findNode(file, p.near) : undefined;
  if (p.near && !anchor) throw new Error(`Node "${p.near}" (near) not found.`);
  if (anchor) {
    const r = rectOf(anchor);
    switch (p.side ?? 'right') {
      case 'right': x = r.x + r.w + GAP; y = r.y; break;
      case 'left': x = r.x - w - GAP; y = r.y; break;
      case 'bottom': case 'below': x = r.x; y = r.y + r.h + GAP; dirs = ['right', 'down', 'left', 'up']; break;
      case 'top': case 'above': x = r.x; y = r.y - h - GAP; dirs = ['right', 'up', 'left', 'down']; break;
    }
  } else if (solids.length) {
    x = Math.max(...solids.map((n) => n.x + n.width)) + GAP;
    y = solids[solids.length - 1].y;
  }
  if (p.x !== undefined) x = p.x;
  if (p.y !== undefined) y = p.y;
  x = Math.round(x);
  y = Math.round(y);

  const gap = LINT_DEFAULTS.minGap;
  const blockers = {
    solids: solids.map(rectOf),
    groups: groups.map((g) => ({ id: g.id, rect: rectOf(g), label: groupLabelRect(g) })),
  };
  const start: Rect = { x, y, w, h };
  if (anchor) {
    const ar = rectOf(anchor);
    const homes = groups.filter((g) => g !== anchor && contains(rectOf(g), ar));
    if (homes.length) {
      // Stay in the anchor's group(s): clamp into the innermost one (below its label), then avoid collisions.
      const inner = homes.reduce((a, b) => (b.width * b.height < a.width * a.height ? b : a));
      const top = inner.y + (inner.label ? GEOMETRY.groupLabelHeight : 0);
      const c: Rect = {
        x: Math.min(Math.max(start.x, inner.x), Math.max(inner.x, inner.x + inner.width - w)),
        y: Math.min(Math.max(start.y, top), Math.max(top, inner.y + inner.height - h)),
        w, h,
      };
      const f = findFree(c, blockers, gap, new Set(homes.map((g) => g.id)), dirs);
      if (f) return { x: f.x, y: f.y };
    }
  }
  const f = findFree(start, blockers, gap, new Set(), dirs);
  if (f) return { x: f.x, y: f.y };
  const right = Math.max(0, ...solids.map((n) => n.x + n.width), ...groups.map((g) => g.x + g.width));
  return { x: Math.ceil(right + GAP), y };
}

/** Bounding box around the given nodes plus padding and room for the label. */
export function fitGroup(file: CanvasFile, nodeIds: string[]): { x: number; y: number; width: number; height: number } {
  const nodes = nodeIds.map((id) => requireNode(file, id));
  if (!nodes.length) throw new Error('nodeIds is empty.');
  const x1 = Math.min(...nodes.map((n) => n.x));
  const y1 = Math.min(...nodes.map((n) => n.y));
  const x2 = Math.max(...nodes.map((n) => n.x + n.width));
  const y2 = Math.max(...nodes.map((n) => n.y + n.height));
  return {
    x: x1 - GROUP_PAD,
    y: y1 - GROUP_PAD - GROUP_LABEL,
    width: x2 - x1 + 2 * GROUP_PAD,
    height: y2 - y1 + 2 * GROUP_PAD + GROUP_LABEL,
  };
}

/** Ids of non-group nodes whose rectangle lies fully inside the group. */
export function groupMembers(file: CanvasFile, g: GroupNode): string[] {
  return file.nodes
    .filter((n) => n.id !== g.id && n.x >= g.x && n.y >= g.y && n.x + n.width <= g.x + g.width && n.y + n.height <= g.y + g.height)
    .map((n) => n.id);
}

// ---------- mutation helpers ----------

/** Assign an id and geometry, then append (groups are inserted first so they render behind their members). */
export function addNode(file: CanvasFile, spec: NodeSpec, placement?: Placement): CanvasFileNode {
  const d = nodeDefaultSize(spec as never, {
    lineCount:
      spec.type === 'file' && spec.lines ? spec.lines[1] - spec.lines[0] + 1
        : spec.type === 'text' && spec.variant === 'log' ? spec.text.split('\n').length : undefined,
  });
  const width = spec.width ?? d.w;
  const height = spec.height ?? d.h;
  const pos = placeNode(file, placement ?? { x: spec.x, y: spec.y }, width, height);
  const node = { ...spec, id: newId(file, idKindOf(spec as never)), x: pos.x, y: pos.y, width, height } as unknown as CanvasFileNode;
  syncSubpath(node);
  if (node.type === 'group') file.nodes.unshift(node);
  else file.nodes.push(node);
  return node;
}

export function addEdge(file: CanvasFile, spec: Omit<CanvasFileEdge, 'id'>): CanvasFileEdge {
  for (const id of [spec.fromNode, spec.toNode]) requireNode(file, id);
  const edge = syncEnds(expandRelation({ ...spec, id: newId(file, 'edge') } as CanvasFileEdge));
  file.edges.push(edge);
  return edge;
}

/** Removes nodes and every edge attached to them. Returns the removed node and edge ids. */
export function removeNodes(file: CanvasFile, ids: string[]): { nodes: string[]; edges: string[] } {
  const s = new Set(ids);
  const nodes = file.nodes.filter((n) => s.has(n.id)).map((n) => n.id);
  const gone = new Set(nodes);
  const edges = file.edges.filter((e) => gone.has(e.fromNode) || gone.has(e.toNode)).map((e) => e.id);
  const es = new Set(edges);
  file.nodes = file.nodes.filter((n) => !gone.has(n.id));
  file.edges = file.edges.filter((e) => !es.has(e.id));
  return { nodes, edges };
}

export function removeEdges(file: CanvasFile, ids: string[]): string[] {
  const s = new Set(ids);
  const removed = file.edges.filter((e) => s.has(e.id)).map((e) => e.id);
  file.edges = file.edges.filter((e) => !s.has(e.id));
  return removed;
}

/** Remove a line highlight by id from whichever file node holds it. */
export function removeHighlights(file: CanvasFile, ids: string[]): string[] {
  const removed: string[] = [];
  for (const n of file.nodes) {
    if (n.type !== 'file' || !n.highlights) continue;
    const keep = n.highlights.filter((h) => !ids.includes(h.id));
    removed.push(...n.highlights.filter((h) => ids.includes(h.id)).map((h) => h.id));
    n.highlights = keep;
    if (!keep.length) delete n.highlights;
  }
  return removed;
}

export function addHighlights(file: CanvasFile, node: FileNode, ranges: Omit<LineHighlight, 'id'>[], replace: boolean): LineHighlight[] {
  const base = replace ? [] : [...(node.highlights ?? [])];
  const created: LineHighlight[] = [];
  // ids are derived from the whole file, so add one at a time to a scratch copy of the node's list.
  node.highlights = base;
  for (const r of ranges) {
    const h: LineHighlight = { id: newId(file, 'hl'), ...r };
    node.highlights.push(h);
    created.push(h);
  }
  return created;
}

// ---------- anchors ----------

export const isCodeNode = (n: CanvasFileNode): n is FileNode => n.type === 'file' && n.display !== 'reference' && n.display !== 'diff';

/** Displayed line range of a code node; whole file when `lines` is unset (needs totalLines). */
export function displayedRange(n: FileNode, totalLines?: number): [number, number] | undefined {
  if (n.lines) return n.lines;
  return totalLines ? [1, totalLines] : undefined;
}

/** Throws unless `line` is a valid anchor/highlight line of a code file node. */
export function checkLine(n: CanvasFileNode, line: number, totalLines: number | undefined, what: string): void {
  if (!isCodeNode(n)) throw new Error(`${what}: node "${n.id}" is not a code node, so it has no lines to anchor to.`);
  if (!Number.isInteger(line) || line < 1) throw new Error(`${what} must be a positive integer.`);
  const r = displayedRange(n, totalLines);
  if (r && (line < r[0] || line > r[1])) {
    throw new Error(`${what} ${line} is outside the lines displayed in ${n.id} (${r[0]}-${r[1]}).`);
  }
}

/** Anchors (lines) referenced by edges, per node id. */
export function anchorsOf(file: CanvasFile, nodeId: string): { in: number[]; out: number[] } {
  const inn = new Set<number>();
  const out = new Set<number>();
  for (const e of file.edges) {
    if (e.fromNode === nodeId && e.fromLine) out.add(e.fromLine);
    if (e.toNode === nodeId && e.toLine) inn.add(e.toLine);
  }
  const asc = (s: Set<number>) => [...s].sort((a, b) => a - b);
  return { in: asc(inn), out: asc(out) };
}


// ---------- edge rerouting ----------

const SIDES: Side[] = ['top', 'right', 'bottom', 'left'];

/**
 * For the given edges (which must have no line anchors), pick the pair of sides whose rendered path avoids passing
 * through other nodes and keeps its label off them, when the current sides do not. Only changes an edge when a
 * strictly cleaner pair exists (fewest nodes hit, then label overlap, then shortest path). Mutates; returns the ids changed.
 */
export function rerouteEdges(file: CanvasFile, edgeIds: string[]): string[] {
  const byId = new Map(file.nodes.map((n) => [n.id, n]));
  const solids = file.nodes.filter((n) => n.type !== 'group');
  const changed: string[] = [];
  for (const id of edgeIds) {
    const e = file.edges.find((x) => x.id === id);
    if (!e || e.fromLine || e.toLine) continue;
    const cost = (fromSide: Side, toSide: Side): number | undefined => {
      const g = edgeGeometry({ ...e, fromSide, toSide }, byId);
      if (!g) return undefined;
      const hits = solids.filter((n) => n.id !== e.fromNode && n.id !== e.toNode && polylineHitsRect(g.pts, inflate(rectOf(n), -2))).length;
      let labelHits = 0;
      if (e.label) {
        const w = e.label.length * 7 + 12;
        const r: Rect = { x: g.mid.x - w / 2, y: g.mid.y - 10, w, h: 20 };
        labelHits = solids.filter((n) => intersectionArea(r, rectOf(n)) > 0.25 * area(r)).length;
      }
      let len = 0;
      for (let i = 0; i + 1 < g.pts.length; i++) len += Math.abs(g.pts[i + 1].x - g.pts[i].x) + Math.abs(g.pts[i + 1].y - g.pts[i].y);
      return hits * 1e6 + labelHits * 1e4 + len;
    };
    const cur = cost(e.fromSide ?? 'right', e.toSide ?? 'left');
    if (cur === undefined || cur < 1e4) continue; // fine as it is
    let best: { f: Side; t: Side; c: number } | undefined;
    for (const f of SIDES) {
      for (const t of SIDES) {
        const c = cost(f, t);
        if (c !== undefined && (!best || c < best.c)) best = { f, t, c };
      }
    }
    if (best && best.c < cur) {
      e.fromSide = best.f;
      e.toSide = best.t;
      changed.push(id);
    }
  }
  return changed;
}
