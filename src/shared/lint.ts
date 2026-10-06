// Canvas linter: detects layout mistakes that give the viewer a bad experience (overlaps, nodes straddling
// group borders, edges routed through nodes, clipped content, broken anchors...).
// Pure and dependency-free: runs in the extension host, the webview (live badges) and the CLI.
import type { CanvasFile, CanvasFileEdge, CanvasFileNode, FileNode, GroupNode, TextNode } from './canvasFile';
import {
  GEOMETRY, area, contains, edgeGeometry, findFree, groupLabelRect, inflate, intersectionArea,
  intersects, isCode, polylineHitsRect, polylinesCross, rectGap, rectOf, type Blockers, type Dir, type EdgeGeom, type Rect,
} from './geometry';
import { SHAPES, shapeById, type ShapeDef } from './shapes';

export { GEOMETRY };

export type LintSeverity = 'error' | 'warning' | 'info';

export type LintRuleId =
  // layout / visual collisions
  | 'node-overlap' // two non-group nodes intersect
  | 'node-crowded' // two non-group nodes closer than minGap
  | 'group-straddle' // node partially inside a group (crosses its border)
  | 'group-label-covered' // a node covers a group's label tab
  | 'edge-through-node' // an edge's rendered curve passes through a node that is neither endpoint
  | 'edge-label-overlap' // an edge label overlaps a node or another label
  | 'edge-crossing' // number of edge crossings above a threshold (reported once per canvas)
  | 'edge-backwards' // edge target is left of source for a left->right handle pair (loops back across)
  | 'text-overflow' // text/sticky/note/shape content likely clipped by its size
  | 'unknown-shape' // node/frame `shape` id is not in the shape registry (or a group's shape is not a frame)
  | 'far-outlier' // node far from all others; makes fit-to-view zoom out to unreadable
  | 'group-order' // group listed after a member (JSON Canvas renders it on top of the member)
  // structural
  | 'duplicate-id'
  | 'dangling-edge' // edge references a missing node
  | 'invalid-anchor' // fromLine/toLine not displayed in that code node, or set on a non-code node
  | 'highlight-out-of-range'
  | 'self-loop'
  | 'duplicate-edge'
  | 'empty-group'
  | 'missing-file' // file node's path (or a diff node's diffFrom) does not exist (needs LintOptions.fileInfo)
  | 'diff-missing-base' // diff node without a diffFrom (left-hand file)
  | 'legacy-flows'; // vsCanvas.flows from the removed flow playback feature (rejected by the schema)

export type LintMove = { id: string; x: number; y: number; width?: number; height?: number };

export type LintFix = {
  description: string;
  moves?: LintMove[];
  removeEdges?: string[];
  removeNodes?: string[];
  /** Keys to delete from the `vsCanvas` metadata object (touches no node or edge). */
  removeMeta?: string[];
  /** Complete new order of the node ids in the `nodes` array (used to put groups behind their members). */
  reorder?: string[];
};

export type LintDiagnostic = {
  rule: LintRuleId;
  severity: LintSeverity;
  message: string;
  nodeIds: string[];
  edgeIds: string[];
  /** A safe, mechanical fix, when one exists. */
  fix?: LintFix;
};

export type LintOptions = {
  /** Per-rule severity override, or 'off'. */
  rules?: Partial<Record<LintRuleId, LintSeverity | 'off'>>;
  /** Minimum comfortable gap between nodes, px (default 24). */
  minGap?: number;
  /** Crossing count above which 'edge-crossing' is reported (default 4). */
  maxCrossings?: number;
  /** Distance from the nearest other node beyond which 'far-outlier' is reported, px (default 2000). */
  outlierDistance?: number;
  /** File lookup for 'missing-file' / anchor checks against real file length. Omit to skip those checks. */
  fileInfo?: (workspaceRelPath: string) => { exists: boolean; totalLines?: number } | undefined;
};


export const LINT_RULES: readonly LintRuleId[] = [
  'node-overlap', 'node-crowded', 'group-straddle', 'group-label-covered', 'edge-through-node', 'edge-label-overlap',
  'edge-crossing', 'edge-backwards', 'text-overflow', 'far-outlier', 'group-order', 'duplicate-id', 'dangling-edge',
  'invalid-anchor', 'highlight-out-of-range', 'self-loop', 'duplicate-edge', 'empty-group', 'missing-file', 'unknown-shape',
  'diff-missing-base', 'legacy-flows',
];

export const DEFAULT_SEVERITY: Record<LintRuleId, LintSeverity> = {
  'node-overlap': 'error',
  'node-crowded': 'warning',
  'group-straddle': 'warning',
  'group-label-covered': 'warning',
  'edge-through-node': 'warning',
  'edge-label-overlap': 'warning',
  'edge-crossing': 'info',
  'edge-backwards': 'info',
  'text-overflow': 'warning',
  'far-outlier': 'info',
  'group-order': 'info',
  'duplicate-id': 'error',
  'dangling-edge': 'error',
  'invalid-anchor': 'error',
  'highlight-out-of-range': 'error',
  'self-loop': 'error',
  'duplicate-edge': 'error',
  'empty-group': 'warning',
  'missing-file': 'error',
  'unknown-shape': 'error',
  'diff-missing-base': 'error',
  'legacy-flows': 'error',
};

export const LINT_DEFAULTS = { minGap: 24, maxCrossings: 4, outlierDistance: 2000, outlierGap: 80 } as const;

/** Rules whose fixes fixCanvas applies without asking (they only move / resize / reorder / drop a dead metadata key). */
export const AUTO_FIX_RULES: ReadonlySet<LintRuleId> = new Set<LintRuleId>([
  'group-order', 'text-overflow', 'group-straddle', 'group-label-covered', 'node-overlap', 'node-crowded', 'far-outlier',
  'legacy-flows',
]);
/** Rules whose fixes delete edges; fixCanvas applies them only with `destructive: true`. */
export const DESTRUCTIVE_FIX_RULES: ReadonlySet<LintRuleId> = new Set<LintRuleId>(['dangling-edge', 'duplicate-edge', 'self-loop']);

// Fix order within a pass: cheap structural repairs first, then things that resize, then things that move.
const FIX_PRIORITY: LintRuleId[] = [
  'dangling-edge', 'self-loop', 'duplicate-edge', 'group-order', 'text-overflow', 'group-straddle', 'group-label-covered',
  'node-overlap', 'node-crowded', 'far-outlier', 'legacy-flows',
];

// ---------- text height estimate ----------

const wrapRows = (text: string, avail: number, charW: number) =>
  Math.max(1, Math.ceil((text.length * charW) / Math.max(1, avail)));

/**
 * Rough height in px the text of a text node needs when rendered (undefined for mermaid, which is not estimated).
 * Deliberately conservative for markdown (7.5px per character).
 */
export function estimateTextHeight(n: Pick<TextNode, 'text' | 'variant' | 'title' | 'width'>): number | undefined {
  const text = n.text ?? '';
  switch (n.variant ?? 'note') {
    case 'mermaid':
      return undefined;
    case 'log':
      return undefined; // monospace card that scrolls; never clipped in a harmful way
    case 'sticky': {
      const avail = n.width - 24;
      return 24 + text.split('\n').reduce((h, l) => h + 20 * wrapRows(l, avail, 7), 0);
    }
    case 'plain': {
      const avail = n.width - 8;
      const big = text.trimStart().startsWith('#');
      const [lh, cw] = big ? [36, 15] : [20, 7];
      return 8 + text.split('\n').reduce((h, l) => h + lh * wrapRows(l.replace(/^\s*#+\s*/, ''), avail, cw), 0);
    }
    default: {
      const avail = n.width - 24;
      // finding/service cards carry a title row plus a status/tag row
      let h = 24 + (n.title ? 30 : 0) + (n.variant === 'finding' || n.variant === 'service' ? 30 : 0);
      let fence: 'code' | 'mermaid' | undefined;
      for (const l of text.split('\n')) {
        if (/^\s*```/.test(l)) {
          if (fence) fence = undefined;
          else {
            fence = /^\s*```\s*mermaid/i.test(l) ? 'mermaid' : 'code';
            if (fence === 'mermaid') h += 240;
          }
          continue;
        }
        if (fence === 'mermaid') continue;
        if (fence === 'code') { h += 18; continue; }
        const m = /^(#{1,6})\s+(.*)$/.exec(l);
        if (m) {
          const lv = m[1].length;
          const [lh, cw] = lv === 1 ? [34, 13] : lv === 2 ? [28, 11] : lv === 3 ? [24, 9.5] : [22, 8.5];
          h += lh * wrapRows(m[2], avail, cw) + 8;
        } else if (!l.trim()) h += 10;
        else h += 20 * wrapRows(l, avail, 7.5);
      }
      return h;
    }
  }
}

// ---------- shape text estimate ----------

const linesOf = (v: string | string[] | undefined): string[] =>
  v === undefined ? [] : (Array.isArray(v) ? v : v.split('\n')).filter((x) => x.trim() !== '');

/**
 * Rough height in px a shape node needs for its text and fields, per the shape's label layout (undefined when there is
 * nothing to fit or the shape is unknown). center: label wraps inside ~70% of the width for decision/terminator/io
 * shapes (the diamond also loses vertical room); compartments/table: header 32px + 20px per field line;
 * below: label under the figure (half the default height) so height >= figure + label; top: 16px padding + text + fields.
 */
export function estimateShapeHeight(n: Pick<TextNode, 'text' | 'fields' | 'shape' | 'width'>): number | undefined {
  const def = shapeById(n.shape);
  if (!def) return undefined;
  const text = (n.text ?? '').trim();
  const rows = (avail: number, cw: number) =>
    (n.text ?? '').split('\n').reduce((h, l) => h + wrapRows(l, avail, cw), 0);
  const fieldLines = () => def.fields?.reduce((c, f) => c + linesOf(n.fields?.[f.key]).length, 0) ?? 0;
  switch (def.layout) {
    case 'center': {
      if (!text) return undefined;
      const narrow = /^flowchart\.(decision|terminator|io)$/.test(def.id);
      const r = rows(narrow ? n.width * 0.7 : n.width - 24, 7.5);
      const need = r * 20 + 16;
      return def.id === 'flowchart.decision' ? Math.ceil(need / 0.6) : need;
    }
    case 'compartments':
    case 'table': {
      const nameRows = Math.max(1, rows(n.width - 24, 8));
      return 32 + (nameRows - 1) * 20 + fieldLines() * 20;
    }
    case 'below': {
      if (!text || def.size[1] < 96) return undefined; // small event/gateway figures put the label outside the box
      return Math.ceil(def.size[1] / 2) + rows(n.width - 16, 7.5) * 20 + 16;
    }
    case 'top': {
      if (!text && !fieldLines()) return undefined;
      return 16 + (text ? rows(n.width - 24, 7.5) * 20 : 0) + fieldLines() * 20 + 8;
    }
  }
}

// ---------- context ----------

type Ctx = {
  canvas: CanvasFile;
  nodes: CanvasFileNode[];
  edges: CanvasFileEdge[];
  byId: Map<string, CanvasFileNode>;
  solids: CanvasFileNode[];
  groups: GroupNode[];
  minGap: number;
  opts: LintOptions;
};

function makeCtx(canvas: CanvasFile, opts: LintOptions): Ctx {
  const byId = new Map<string, CanvasFileNode>();
  for (const n of canvas.nodes) if (!byId.has(n.id)) byId.set(n.id, n);
  return {
    canvas,
    nodes: canvas.nodes,
    edges: canvas.edges,
    byId,
    solids: canvas.nodes.filter((n) => n.type !== 'group'),
    groups: canvas.nodes.filter((n): n is GroupNode => n.type === 'group'),
    minGap: opts.minGap ?? LINT_DEFAULTS.minGap,
    opts,
  };
}

const sevOf = (c: Ctx, rule: LintRuleId): LintSeverity | undefined => {
  const s = c.opts.rules?.[rule] ?? DEFAULT_SEVERITY[rule];
  return s === 'off' ? undefined : s;
};

function mk(
  c: Ctx, rule: LintRuleId, message: string, nodeIds: string[], edgeIds: string[] = [], fix?: LintFix,
): LintDiagnostic | undefined {
  const severity = sevOf(c, rule);
  return severity ? { rule, severity, message, nodeIds, edgeIds, ...(fix && { fix }) } : undefined;
}

/** A group's members: nodes whose rect lies fully inside it (a nested group counts when strictly smaller). */
const isMember = (g: GroupNode, n: CanvasFileNode) =>
  n !== g && contains(rectOf(g), rectOf(n)) && (n.type !== 'group' || area(rectOf(n)) < area(rectOf(g)));

const round = (r: Rect): Rect => ({ x: Math.round(r.x), y: Math.round(r.y), w: r.w, h: r.h });
const move = (n: CanvasFileNode, r: Rect): LintMove => ({ id: n.id, x: Math.round(r.x), y: Math.round(r.y) });
const fmt = (n: CanvasFileNode) => `${n.id}`;

function blockersFor(c: Ctx, self: CanvasFileNode): Blockers {
  return {
    solids: c.solids.filter((n) => n !== self).map(rectOf),
    groups: c.groups.filter((g) => g !== self).map((g) => ({ id: g.id, rect: rectOf(g), label: groupLabelRect(g) })),
  };
}

/** Ids of the groups that fully contain `r` (excluding `self`). */
const groupsContaining = (c: Ctx, r: Rect, self?: CanvasFileNode) =>
  new Set(c.groups.filter((g) => g !== self && contains(rectOf(g), r)).map((g) => g.id));

const disp = (a: Rect, b: Rect) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));

// ---------- layout fixes ----------

/** Move `n` (the later node) away from `o` along the axis of least penetration, keeping minGap and group membership. */
function separateFix(c: Ctx, o: CanvasFileNode, n: CanvasFileNode): LintFix | undefined {
  const a = rectOf(o);
  const r = round(rectOf(n));
  const g = c.minGap;
  const options: { dir: Dir; dist: number; start: Rect }[] = [
    { dir: 'right', dist: a.x + a.w + g - r.x, start: { ...r, x: Math.ceil(a.x + a.w + g) } },
    { dir: 'down', dist: a.y + a.h + g - r.y, start: { ...r, y: Math.ceil(a.y + a.h + g) } },
    { dir: 'left', dist: r.x + r.w + g - a.x, start: { ...r, x: Math.floor(a.x - g - r.w) } },
    { dir: 'up', dist: r.y + r.h + g - a.y, start: { ...r, y: Math.floor(a.y - g - r.h) } },
  ];
  options.sort((p, q) => p.dist - q.dist); // stable: ties keep right, down, left, up
  const b = blockersFor(c, n);
  const inside = groupsContaining(c, rectOf(n), n);
  for (const opt of options) {
    const dirs: Dir[] = [opt.dir, ...options.map((x) => x.dir).filter((d) => d !== opt.dir)];
    const f = findFree(opt.start, b, g, inside, dirs);
    if (f) return { description: `Move ${fmt(n)} to (${f.x}, ${f.y}) clear of ${fmt(o)}`, moves: [move(n, f)] };
  }
  // Nowhere works while keeping its groups: leave them and go right of everything.
  const right = Math.max(...c.solids.map((s) => s.x + s.width), ...c.groups.map((x) => x.x + x.width));
  const f = { ...r, x: Math.ceil(right + g) };
  return { description: `Move ${fmt(n)} to (${f.x}, ${f.y}) clear of ${fmt(o)}`, moves: [move(n, f)] };
}

function straddleFix(c: Ctx, n: CanvasFileNode, g: GroupNode): LintFix | undefined {
  const r = round(rectOf(n));
  const gr = rectOf(g);
  const gap = c.minGap;
  const b = blockersFor(c, n);
  const labelH = g.label ? GEOMETRY.groupLabelHeight : 0;
  if (intersectionArea(r, gr) > 0.5 * area(r) && r.w <= gr.w && r.h <= gr.h - labelH) {
    const m = r.w <= gr.w - 32 && r.h <= gr.h - labelH - 32 ? 16 : 0;
    const start = round({
      ...r,
      x: clamp(r.x, gr.x + m, gr.x + gr.w - r.w - m),
      y: clamp(r.y, gr.y + labelH + m, gr.y + gr.h - r.h - m),
    });
    const inside = groupsContaining(c, start, n);
    inside.add(g.id);
    const f = findFree(start, b, gap, inside);
    if (f) return { description: `Move ${fmt(n)} fully inside ${fmt(g)}`, moves: [move(n, f)] };
  }
  const keep = groupsContaining(c, rectOf(n), n);
  const cands: { dir: Dir; start: Rect }[] = [
    { dir: 'right', start: { ...r, x: Math.ceil(gr.x + gr.w + gap) } },
    { dir: 'down', start: { ...r, y: Math.ceil(gr.y + gr.h + gap) } },
    { dir: 'left', start: { ...r, x: Math.floor(gr.x - gap - r.w) } },
    { dir: 'up', start: { ...r, y: Math.floor(gr.y - gap - r.h) } },
  ];
  let best: Rect | undefined;
  for (const cand of cands) {
    const dirs: Dir[] = [cand.dir, 'right', 'down', 'left', 'up'];
    const f = findFree(cand.start, b, gap, keep, dirs);
    if (f && (!best || disp(f, r) < disp(best, r))) best = f;
  }
  if (!best) return undefined;
  return { description: `Move ${fmt(n)} fully outside ${fmt(g)}`, moves: [move(n, best)] };
}

function labelFix(c: Ctx, n: CanvasFileNode, g: GroupNode): LintFix | undefined {
  const r = round(rectOf(n));
  const gr = rectOf(g);
  const start: Rect = { ...r, y: Math.ceil(gr.y + GEOMETRY.groupLabelHeight + 8) };
  const moves: LintMove[] = [];
  let ok = start.y + start.h <= gr.y + gr.h;
  if (ok) {
    const inside = groupsContaining(c, start, n);
    inside.add(g.id);
    const f = findFree(start, blockersFor(c, n), c.minGap, inside, ['down', 'right', 'left', 'up']);
    if (f) return { description: `Move ${fmt(n)} below the label of ${fmt(g)}`, moves: [move(n, f)] };
    ok = false;
  }
  // Not enough room: grow the group downward, unless that would swallow a foreign node.
  const grown = { ...gr, h: start.y + start.h + 16 - gr.y };
  const swallows = c.solids.some((s) => s !== n && !isMember(g, s) && intersects(rectOf(s), grown));
  if (swallows) return undefined;
  moves.push(move(n, start), { id: g.id, x: g.x, y: g.y, width: g.width, height: Math.ceil(grown.h) });
  return { description: `Move ${fmt(n)} below the label of ${fmt(g)} and grow the group`, moves };
}

function outlierFix(c: Ctx, n: CanvasFileNode, others: CanvasFileNode[]): LintFix | undefined {
  const r = rectOf(n);
  const connected = new Set<string>();
  for (const e of c.edges) {
    if (e.fromNode === n.id) connected.add(e.toNode);
    if (e.toNode === n.id) connected.add(e.fromNode);
  }
  const pool = others.filter((o) => connected.has(o.id));
  const from = pool.length ? pool : others;
  let target = from[0];
  for (const o of from) if (rectGap(r, rectOf(o)) < rectGap(r, rectOf(target))) target = o;
  if (!target) return undefined;
  const t = rectOf(target);
  const start = round({ ...r, x: t.x + t.w + LINT_DEFAULTS.outlierGap, y: t.y });
  const f = findFree(start, blockersFor(c, n), c.minGap, new Set<string>());
  if (!f) return undefined;
  return { description: `Move ${fmt(n)} next to ${fmt(target)}`, moves: [move(n, f)] };
}

// ---------- metadata ----------

function metaRules(c: Ctx): LintDiagnostic[] {
  const meta = c.canvas.vsCanvas as Record<string, unknown> | undefined;
  if (!meta || typeof meta !== 'object' || !('flows' in meta)) return [];
  const d = mk(c, 'legacy-flows',
    'vsCanvas.flows is from the removed flow playback feature and is no longer supported; remove it.', [], [],
    { description: 'Remove vsCanvas.flows', removeMeta: ['flows'] });
  return d ? [d] : [];
}

// ---------- node-level detection (cheap; also drives fixCanvas) ----------

function nodeRules(c: Ctx): LintDiagnostic[] {
  const out: LintDiagnostic[] = [];
  const push = (d: LintDiagnostic | undefined) => { if (d) out.push(d); };
  const { solids, groups, minGap } = c;

  // group-order
  if (sevOf(c, 'group-order')) {
    c.nodes.forEach((g, gi) => {
      if (g.type !== 'group') return;
      let first = -1;
      c.nodes.forEach((m, mi) => { if (first < 0 && mi < gi && isMember(g, m)) first = mi; });
      if (first < 0) return;
      const order = c.nodes.map((n) => n.id);
      order.splice(gi, 1);
      order.splice(first, 0, g.id);
      push(mk(c, 'group-order',
        `Group ${g.id} is listed after nodes it contains, so it is drawn on top of them; list groups before their members.`,
        [g.id], [], { description: `Move ${g.id} before its members in the node order`, reorder: order }));
    });
  }

  // text-overflow
  if (sevOf(c, 'text-overflow')) {
    for (const n of solids) {
      if (n.type !== 'text') continue;
      const need = n.variant === 'shape' ? estimateShapeHeight(n) : estimateTextHeight(n);
      if (need === undefined || need <= n.height) continue;
      const h = Math.ceil(need);
      push(mk(c, 'text-overflow', `${n.id} text needs about ${h}px of height but is ${Math.round(n.height)}px; content will be clipped.`,
        [n.id], [], { description: `Grow ${n.id} to height ${h}`, moves: [{ id: n.id, x: n.x, y: n.y, width: n.width, height: h }] }));
    }
  }

  // group-straddle / group-label-covered
  for (const n of solids) {
    for (const g of groups) {
      const r = rectOf(n);
      const gr = rectOf(g);
      if (intersectionArea(r, gr) > 0 && !contains(gr, r)) {
        push(mk(c, 'group-straddle', `${n.id} crosses the border of group ${g.id}; it should be fully inside or fully outside.`,
          [n.id, g.id], [], straddleFix(c, n, g)));
      } else if (contains(gr, r)) {
        const tab = groupLabelRect(g);
        if (tab && intersects(r, tab)) {
          push(mk(c, 'group-label-covered', `${n.id} covers the label of group ${g.id}; keep the top ${GEOMETRY.groupLabelHeight}px of the group clear.`,
            [n.id, g.id], [], labelFix(c, n, g)));
        }
      }
    }
  }

  // node-overlap / node-crowded
  for (let i = 0; i < solids.length; i++) {
    for (let j = i + 1; j < solids.length; j++) {
      const a = rectOf(solids[i]);
      const b = rectOf(solids[j]);
      if (intersects(a, b)) {
        const w = Math.round(Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
        const h = Math.round(Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
        push(mk(c, 'node-overlap', `${solids[i].id} and ${solids[j].id} overlap (${w}x${h}px).`,
          [solids[i].id, solids[j].id], [], separateFix(c, solids[i], solids[j])));
      } else if (intersects(inflate(a, minGap), b)) {
        push(mk(c, 'node-crowded', `${solids[i].id} and ${solids[j].id} are closer than ${minGap}px.`,
          [solids[i].id, solids[j].id], [], separateFix(c, solids[i], solids[j])));
      }
    }
  }

  // far-outlier
  if (sevOf(c, 'far-outlier') && solids.length > 1) {
    const limit = c.opts.outlierDistance ?? LINT_DEFAULTS.outlierDistance;
    for (const n of solids) {
      const others = solids.filter((o) => o !== n);
      const d = Math.min(...others.map((o) => rectGap(rectOf(n), rectOf(o))));
      if (d > limit) {
        push(mk(c, 'far-outlier', `${n.id} is ${Math.round(d)}px from the nearest node; fit-to-view will zoom out until everything is unreadable.`,
          [n.id], [], outlierFix(c, n, others)));
      }
    }
  }
  return out;
}

// ---------- structural ----------

function structural(c: Ctx): LintDiagnostic[] {
  const out: LintDiagnostic[] = [];
  const push = (d: LintDiagnostic | undefined) => { if (d) out.push(d); };
  const fileInfo = c.opts.fileInfo;

  // duplicate-id
  const seen = new Map<string, { nodes: number; edges: number; hls: number }>();
  const bump = (id: string, k: 'nodes' | 'edges' | 'hls') => {
    const v = seen.get(id) ?? { nodes: 0, edges: 0, hls: 0 };
    v[k]++;
    seen.set(id, v);
  };
  for (const n of c.nodes) {
    bump(n.id, 'nodes');
    if (n.type === 'file') n.highlights?.forEach((h) => bump(h.id, 'hls'));
  }
  for (const e of c.edges) bump(e.id, 'edges');
  for (const [id, v] of seen) {
    if (v.nodes + v.edges + v.hls > 1) {
      push(mk(c, 'duplicate-id', `Id "${id}" is used ${v.nodes + v.edges + v.hls} times; ids must be unique.`,
        v.nodes ? [id] : [], v.edges ? [id] : []));
    }
  }

  // edges
  const sig = new Map<string, string>();
  for (const e of c.edges) {
    const a = c.byId.get(e.fromNode);
    const b = c.byId.get(e.toNode);
    if (!a || !b) {
      push(mk(c, 'dangling-edge', `Edge ${e.id} references missing node ${!a ? e.fromNode : e.toNode}.`,
        [e.fromNode, e.toNode].filter((id) => c.byId.has(id)), [e.id],
        { description: `Remove edge ${e.id}`, removeEdges: [e.id] }));
      continue;
    }
    if (a === b) {
      push(mk(c, 'self-loop', `Edge ${e.id} connects ${a.id} to itself.`, [a.id], [e.id],
        { description: `Remove edge ${e.id}`, removeEdges: [e.id] }));
    }
    const key = JSON.stringify([e.fromNode, e.fromSide ?? null, e.fromLine ?? null, e.toNode, e.toSide ?? null, e.toLine ?? null]);
    const prior = sig.get(key);
    if (prior) {
      push(mk(c, 'duplicate-edge', `Edge ${e.id} duplicates ${prior} (same endpoints, sides and lines).`, [a.id, b.id], [e.id, prior],
        { description: `Remove edge ${e.id}`, removeEdges: [e.id] }));
    } else sig.set(key, e.id);

    for (const [end, node, line] of [['fromLine', a, e.fromLine], ['toLine', b, e.toLine]] as const) {
      if (line === undefined) continue;
      if (!isCode(node)) {
        push(mk(c, 'invalid-anchor', `Edge ${e.id} ${end}=${line} but ${node.id} is not a code file node (diff and reference nodes have no lines), so it has no lines.`, [node.id], [e.id]));
        continue;
      }
      const r = displayRange(c, node);
      if (!Number.isInteger(line) || line < r[0] || line > r[1]) {
        push(mk(c, 'invalid-anchor',
          `Edge ${e.id} ${end}=${line} is outside the lines displayed in ${node.id} (${r[0]}-${Number.isFinite(r[1]) ? r[1] : 'end'}).`,
          [node.id], [e.id]));
      }
    }
  }

  // nodes
  for (const n of c.nodes) {
    if (n.type === 'file') {
      if (isCode(n)) {
        const r = displayRange(c, n);
        for (const h of n.highlights ?? []) {
          if (h.end < h.start || h.start < r[0] || h.end > r[1]) {
            push(mk(c, 'highlight-out-of-range',
              `Highlight ${h.id} (${h.start}-${h.end}) is outside the lines displayed in ${n.id} (${r[0]}-${Number.isFinite(r[1]) ? r[1] : 'end'}).`, [n.id]));
          }
        }
      }
      const info = fileInfo?.(n.file);
      if (info && !info.exists) push(mk(c, 'missing-file', `${n.id} references ${n.file}, which does not exist.`, [n.id]));
      if (n.display === 'diff') {
        if (!n.diffFrom) {
          push(mk(c, 'diff-missing-base', `Diff node ${n.id} has no diffFrom (the left-hand / before file).`, [n.id]));
        } else {
          const base = fileInfo?.(n.diffFrom);
          if (base && !base.exists) push(mk(c, 'missing-file', `${n.id} diffFrom references ${n.diffFrom}, which does not exist.`, [n.id]));
        }
      }
    }
    if (n.type === 'text' && (n.variant === 'shape' || n.shape !== undefined) && !shapeById(n.shape)) {
      push(mk(c, 'unknown-shape', `${n.id} has unknown shape ${n.shape === undefined ? '(none)' : `"${n.shape}"`}; it renders as a plain card. ${shapeHint(n.shape)}`, [n.id]));
    }
    if (n.type === 'group' && n.shape !== undefined) {
      const def: ShapeDef | undefined = shapeById(n.shape);
      if (!def || !def.frame) {
        push(mk(c, 'unknown-shape', `Group ${n.id} has ${def ? `shape "${n.shape}", which is not a frame shape` : `unknown shape "${n.shape}"`}; it renders as a plain group.`, [n.id]));
      }
    }
    if (n.type === 'group' && !c.nodes.some((m) => isMember(n, m))) {
      push(mk(c, 'empty-group', `Group ${n.id} contains no nodes.`, [n.id]));
    }
  }
  return out;
}

function shapeHint(id: string | undefined): string {
  const lib = id?.split('.')[0];
  const ids = SHAPES_IN(lib);
  return ids.length ? `Valid ${lib} shapes: ${ids.join(', ')}.` : 'See canvas_list_shapes for valid ids.';
}
const SHAPES_IN = (lib: string | undefined) => SHAPES.filter((x) => x.library === lib).map((x) => x.id);

function displayRange(c: Ctx, n: FileNode): [number, number] {
  if (n.lines) return n.lines;
  return [1, c.opts.fileInfo?.(n.file)?.totalLines ?? Infinity];
}

// ---------- edges ----------

const LABEL_H = 20;
const labelRect = (label: string, mid: { x: number; y: number }): Rect => {
  const w = label.length * 7 + 12;
  return { x: mid.x - w / 2, y: mid.y - LABEL_H / 2, w, h: LABEL_H };
};

function edgeRules(c: Ctx): LintDiagnostic[] {
  const out: LintDiagnostic[] = [];
  const push = (d: LintDiagnostic | undefined) => { if (d) out.push(d); };
  const geoms: { e: CanvasFileEdge; g: EdgeGeom }[] = [];
  for (const e of c.edges) {
    const g = e.fromNode === e.toNode ? undefined : edgeGeometry(e, c.byId); // self-loops are reported by self-loop
    if (g) geoms.push({ e, g });
  }

  for (const { e, g } of geoms) {
    // edge-through-node
    const hit = c.solids.filter(
      (n) => n.id !== e.fromNode && n.id !== e.toNode && polylineHitsRect(g.pts, inflate(rectOf(n), -2)),
    );
    if (hit.length) {
      push(mk(c, 'edge-through-node', `Edge ${e.id} passes through ${hit.map((n) => n.id).join(', ')}; move the node(s) or pick other sides.`,
        hit.map((n) => n.id), [e.id]));
    }
    // edge-backwards
    if (g.sPos === 'right' && g.tPos === 'left' && g.t.x < g.s.x) {
      push(mk(c, 'edge-backwards', `Edge ${e.id} runs right-to-left (target ${e.toNode} is left of source ${e.fromNode}) and loops back across the canvas; place the target to the right or use other sides.`,
        [e.fromNode, e.toNode], [e.id]));
    }
  }

  // edge-label-overlap
  const labels = geoms.filter(({ e }) => e.label).map(({ e, g }) => ({ e, r: labelRect(e.label as string, g.mid) }));
  for (let i = 0; i < labels.length; i++) {
    const { e, r } = labels[i];
    const hit = c.solids.filter((n) => intersectionArea(r, rectOf(n)) > 0.25 * area(r));
    if (hit.length) {
      push(mk(c, 'edge-label-overlap', `Label of edge ${e.id} ("${e.label}") sits over ${hit.map((n) => n.id).join(', ')}; move nodes further apart or shorten the label.`,
        hit.map((n) => n.id), [e.id]));
    }
    for (let j = i + 1; j < labels.length; j++) {
      if (intersects(r, labels[j].r)) {
        push(mk(c, 'edge-label-overlap', `Labels of edges ${e.id} and ${labels[j].e.id} overlap.`, [], [e.id, labels[j].e.id]));
      }
    }
  }

  // edge-crossing
  if (sevOf(c, 'edge-crossing')) {
    const max = c.opts.maxCrossings ?? LINT_DEFAULTS.maxCrossings;
    let count = 0;
    const involved = new Set<string>();
    for (let i = 0; i < geoms.length; i++) {
      for (let j = i + 1; j < geoms.length; j++) {
        const a = geoms[i], b = geoms[j];
        // Edges fanning out of / into the same handle only touch at that point.
        if ((a.g.s.x === b.g.s.x && a.g.s.y === b.g.s.y) || (a.g.t.x === b.g.t.x && a.g.t.y === b.g.t.y)) continue;
        if (polylinesCross(a.g.pts, b.g.pts)) {
          count++;
          involved.add(a.e.id);
          involved.add(b.e.id);
        }
      }
    }
    if (count > max) {
      push(mk(c, 'edge-crossing', `${count} edge crossings (more than ${max}); rearrange nodes so flows do not cross.`, [], [...involved]));
    }
  }
  return out;
}

// ---------- public API ----------

export function lintCanvas(canvas: CanvasFile, opts: LintOptions = {}): LintDiagnostic[] {
  const c = makeCtx(canvas, opts);
  return [...structural(c), ...metaRules(c), ...nodeRules(c), ...edgeRules(c)];
}

const finite = (n: number | undefined, d: number) => (n !== undefined && Number.isFinite(n) ? Math.round(n) : d);

function applyInPlace(work: CanvasFile, fix: LintFix): void {
  const byId = new Map<string, CanvasFileNode>();
  for (const n of work.nodes) if (!byId.has(n.id)) byId.set(n.id, n);
  for (const m of fix.moves ?? []) {
    const n = byId.get(m.id);
    if (!n) continue;
    n.x = finite(m.x, n.x);
    n.y = finite(m.y, n.y);
    if (m.width !== undefined) n.width = finite(m.width, n.width);
    if (m.height !== undefined) n.height = finite(m.height, n.height);
  }
  if (fix.removeEdges?.length) {
    const s = new Set(fix.removeEdges);
    work.edges = work.edges.filter((e) => !s.has(e.id));
  }
  if (fix.removeNodes?.length) {
    const s = new Set(fix.removeNodes);
    work.nodes = work.nodes.filter((n) => !s.has(n.id));
    work.edges = work.edges.filter((e) => !s.has(e.fromNode) && !s.has(e.toNode));
  }
  if (fix.removeMeta?.length && work.vsCanvas) {
    const meta = work.vsCanvas as Record<string, unknown>;
    for (const k of fix.removeMeta) delete meta[k];
  }
  if (fix.reorder) {
    const pool = [...work.nodes];
    const next: CanvasFileNode[] = [];
    for (const id of fix.reorder) {
      const i = pool.findIndex((n) => n.id === id);
      if (i >= 0) next.push(...pool.splice(i, 1));
    }
    work.nodes = [...next, ...pool];
  }
}

/** Apply one fix to a copy of the canvas (used for single-diagnostic quick fixes). */
export function applyLintFix(canvas: CanvasFile, fix: LintFix): CanvasFile {
  const work = structuredClone(canvas);
  applyInPlace(work, fix);
  return work;
}

/**
 * Apply the fixes of all fixable diagnostics to a copy of the canvas. Each pass re-detects after every applied fix
 * (so positions are always chosen against the current layout) and moves each node at most once, until nothing is
 * left to fix or maxPasses is reached. Only moves/resizes/reorders are applied unless `destructive` is set, which
 * also removes dangling, duplicate and self-loop edges.
 */
export function fixCanvas(
  canvas: CanvasFile,
  opts: LintOptions & { maxPasses?: number; rules?: LintOptions['rules']; destructive?: boolean } = {},
): { canvas: CanvasFile; applied: LintDiagnostic[]; remaining: LintDiagnostic[] } {
  const work = structuredClone(canvas);
  const applied: LintDiagnostic[] = [];
  const fixable = new Set<LintRuleId>(AUTO_FIX_RULES);
  if (opts.destructive) DESTRUCTIVE_FIX_RULES.forEach((r) => fixable.add(r));
  const rank = (r: LintRuleId) => FIX_PRIORITY.indexOf(r);

  for (let pass = 0; pass < (opts.maxPasses ?? 8); pass++) {
    const touched = new Set<string>();
    let progressed = false;
    for (let guard = 0; guard < work.nodes.length * 4 + work.edges.length + 20; guard++) {
      const c = makeCtx(work, opts);
      const diags = [...(opts.destructive ? structural(c) : []), ...metaRules(c), ...nodeRules(c)];
      const idsOf = (f: LintFix) => [
        ...(f.moves ?? []).map((m) => m.id), ...(f.removeEdges ?? []), ...(f.removeNodes ?? []),
        ...(f.removeMeta ?? []).map((k) => `meta:${k}`),
        ...(f.reorder ? [`reorder:${diagKey(f)}`] : []),
      ];
      const next = diags
        .filter((d) => d.fix && fixable.has(d.rule) && idsOf(d.fix).every((id) => !touched.has(id)))
        .sort((a, b) => rank(a.rule) - rank(b.rule))[0];
      if (!next?.fix) break;
      applyInPlace(work, next.fix);
      idsOf(next.fix).forEach((id) => touched.add(id));
      applied.push(next);
      progressed = true;
    }
    if (!progressed) break;
  }
  return { canvas: work, applied, remaining: lintCanvas(work, opts) };
}

const diagKey = (f: LintFix) => f.description;
