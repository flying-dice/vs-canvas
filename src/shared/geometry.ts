// Pure geometry helpers shared by the linter and node placement (no node/vscode imports: the webview uses them too).
import type { CanvasFileEdge, CanvasFileNode, FileNode, GroupNode, Side } from './canvasFile';
import { relationById } from './shapes';

export type Rect = { x: number; y: number; w: number; h: number };
export type Pt = { x: number; y: number };
export type Dir = 'right' | 'down' | 'left' | 'up';

/** Rendered geometry the linter assumes; the webview's CSS must match these. Re-exported from lint.ts. */
export const GEOMETRY = {
  codeHeaderHeight: 31,
  codeBodyPaddingTop: 4,
  codeLineHeight: 18,
  bezierCurvature: 0.25,
  /** Height of the strip a group's label tab occupies at its top-left. */
  groupLabelHeight: 36,
} as const;

export const rectOf = (n: Pick<CanvasFileNode, 'x' | 'y' | 'width' | 'height'>): Rect => ({
  x: n.x, y: n.y, w: n.width, h: n.height,
});

export const inflate = (r: Rect, d: number): Rect => ({ x: r.x - d, y: r.y - d, w: r.w + 2 * d, h: r.h + 2 * d });

/** True when the rects share positive area (touching edges do not count). */
export const intersects = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

/** True when `inner` lies fully inside `outer` (edges may touch). */
export const contains = (outer: Rect, inner: Rect): boolean =>
  inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.w <= outer.x + outer.w && inner.y + inner.h <= outer.y + outer.h;

export const area = (r: Rect) => Math.max(0, r.w) * Math.max(0, r.h);

export function intersectionArea(a: Rect, b: Rect): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

/** Distance between the closest edges of two rects (0 when they touch or overlap). */
export function rectGap(a: Rect, b: Rect): number {
  const dx = Math.max(0, Math.max(a.x, b.x) - Math.min(a.x + a.w, b.x + b.w));
  const dy = Math.max(0, Math.max(a.y, b.y) - Math.min(a.y + a.h, b.y + b.h));
  return Math.hypot(dx, dy);
}

/** Width of a group's label tab (estimated from the label), and the tab rect; undefined for unlabeled groups. */
export function groupLabelRect(g: Pick<GroupNode, 'x' | 'y' | 'width' | 'label'>): Rect | undefined {
  if (!g.label) return undefined;
  return { x: g.x, y: g.y, w: Math.min(g.width, Math.max(60, g.label.length * 8 + 24)), h: GEOMETRY.groupLabelHeight };
}

export const isCode = (n: CanvasFileNode): n is FileNode => n.type === 'file' && n.display !== 'reference';

// ---------- handles ----------

export function sidePoint(n: Pick<CanvasFileNode, 'x' | 'y' | 'width' | 'height'>, side: Side): Pt {
  switch (side) {
    case 'top': return { x: n.x + n.width / 2, y: n.y };
    case 'bottom': return { x: n.x + n.width / 2, y: n.y + n.height };
    case 'left': return { x: n.x, y: n.y + n.height / 2 };
    case 'right': return { x: n.x + n.width, y: n.y + n.height / 2 };
  }
}

/** Y of the code line `line` of a code node (center of the line). */
export function lineY(n: FileNode, line: number): number {
  const first = n.lines?.[0] ?? 1;
  return n.y + GEOMETRY.codeHeaderHeight + GEOMETRY.codeBodyPaddingTop + (line - first + 0.5) * GEOMETRY.codeLineHeight;
}

export type EdgeGeom = {
  s: Pt; t: Pt; sPos: Side; tPos: Side;
  /** Sampled cubic bezier polyline, source to target. */
  pts: Pt[];
  /** Where svelte-flow draws the label: bezier midpoint (t = 0.5), the path center of a step path, or the segment midpoint. */
  mid: Pt;
  routing: 'bezier' | 'orthogonal' | 'straight';
};

export type EdgeRouting = 'bezier' | 'orthogonal' | 'straight';

/** Routing an edge is drawn with: its own `routing`, else its relation preset's, else bezier. */
export function effectiveRouting(e: Pick<CanvasFileEdge, 'routing' | 'relation'>): EdgeRouting {
  return e.routing ?? relationById(e.relation)?.routing ?? 'bezier';
}

export const SMOOTH_STEP = { borderRadius: 8, offset: 20 } as const;

const HANDLE_DIR: Record<Side, Pt> = { left: { x: -1, y: 0 }, right: { x: 1, y: 0 }, top: { x: 0, y: -1 }, bottom: { x: 0, y: 1 } };

/**
 * Point list of @xyflow/system's getSmoothStepPath (its internal getPoints), corners not rounded: source, gapped
 * source, bend points, gapped target, target. `label` is the (labelX, labelY) xyflow draws the label at.
 * Keep in sync with node_modules/@xyflow/system/dist/esm/index.js getPoints.
 */
export function smoothStepPoints(
  source: Pt, sourcePosition: Side, target: Pt, targetPosition: Side, offset: number = SMOOTH_STEP.offset, stepPosition = 0.5,
): { pts: Pt[]; label: Pt } {
  const sourceDir = HANDLE_DIR[sourcePosition];
  const targetDir = HANDLE_DIR[targetPosition];
  const sourceGapped = { x: source.x + sourceDir.x * offset, y: source.y + sourceDir.y * offset };
  const targetGapped = { x: target.x + targetDir.x * offset, y: target.y + targetDir.y * offset };
  const dir =
    sourcePosition === 'left' || sourcePosition === 'right'
      ? (sourceGapped.x < targetGapped.x ? { x: 1, y: 0 } : { x: -1, y: 0 })
      : (sourceGapped.y < targetGapped.y ? { x: 0, y: 1 } : { x: 0, y: -1 });
  const acc: 'x' | 'y' = dir.x !== 0 ? 'x' : 'y';
  const currDir = dir[acc];
  let points: Pt[] = [];
  let centerX: number;
  let centerY: number;
  const sourceGapOffset = { x: 0, y: 0 };
  const targetGapOffset = { x: 0, y: 0 };

  if (sourceDir[acc] * targetDir[acc] === -1) {
    if (acc === 'x') {
      centerX = sourceGapped.x + (targetGapped.x - sourceGapped.x) * stepPosition;
      centerY = (sourceGapped.y + targetGapped.y) / 2;
    } else {
      centerX = (sourceGapped.x + targetGapped.x) / 2;
      centerY = sourceGapped.y + (targetGapped.y - sourceGapped.y) * stepPosition;
    }
    const verticalSplit = [{ x: centerX, y: sourceGapped.y }, { x: centerX, y: targetGapped.y }];
    const horizontalSplit = [{ x: sourceGapped.x, y: centerY }, { x: targetGapped.x, y: centerY }];
    if (sourceDir[acc] === currDir) points = acc === 'x' ? verticalSplit : horizontalSplit;
    else points = acc === 'x' ? horizontalSplit : verticalSplit;
  } else {
    const sourceTarget = [{ x: sourceGapped.x, y: targetGapped.y }];
    const targetSource = [{ x: targetGapped.x, y: sourceGapped.y }];
    if (acc === 'x') points = sourceDir.x === currDir ? targetSource : sourceTarget;
    else points = sourceDir.y === currDir ? sourceTarget : targetSource;
    if (sourcePosition === targetPosition) {
      const diff = Math.abs(source[acc] - target[acc]);
      if (diff <= offset) {
        const gapOffset = Math.min(offset - 1, offset - diff);
        if (sourceDir[acc] === currDir) sourceGapOffset[acc] = (sourceGapped[acc] > source[acc] ? -1 : 1) * gapOffset;
        else targetGapOffset[acc] = (targetGapped[acc] > target[acc] ? -1 : 1) * gapOffset;
      }
    }
    if (sourcePosition !== targetPosition) {
      const opp: 'x' | 'y' = acc === 'x' ? 'y' : 'x';
      const isSameDir = sourceDir[acc] === targetDir[opp];
      const sourceGtTargetOppo = sourceGapped[opp] > targetGapped[opp];
      const sourceLtTargetOppo = sourceGapped[opp] < targetGapped[opp];
      const flip =
        (sourceDir[acc] === 1 && ((!isSameDir && sourceGtTargetOppo) || (isSameDir && sourceLtTargetOppo))) ||
        (sourceDir[acc] !== 1 && ((!isSameDir && sourceLtTargetOppo) || (isSameDir && sourceGtTargetOppo)));
      if (flip) points = acc === 'x' ? sourceTarget : targetSource;
    }
    const sg = { x: sourceGapped.x + sourceGapOffset.x, y: sourceGapped.y + sourceGapOffset.y };
    const tg = { x: targetGapped.x + targetGapOffset.x, y: targetGapped.y + targetGapOffset.y };
    const maxX = Math.max(Math.abs(sg.x - points[0].x), Math.abs(tg.x - points[0].x));
    const maxY = Math.max(Math.abs(sg.y - points[0].y), Math.abs(tg.y - points[0].y));
    if (maxX >= maxY) { centerX = (sg.x + tg.x) / 2; centerY = points[0].y; }
    else { centerX = points[0].x; centerY = (sg.y + tg.y) / 2; }
  }
  const gs = { x: sourceGapped.x + sourceGapOffset.x, y: sourceGapped.y + sourceGapOffset.y };
  const gt = { x: targetGapped.x + targetGapOffset.x, y: targetGapped.y + targetGapOffset.y };
  const pts = [
    source,
    ...(gs.x !== points[0].x || gs.y !== points[0].y ? [gs] : []),
    ...points,
    ...(gt.x !== points[points.length - 1].x || gt.y !== points[points.length - 1].y ? [gt] : []),
    target,
  ];
  return { pts, label: { x: centerX, y: centerY } };
}

function controlOffset(distance: number, curvature: number): number {
  return distance >= 0 ? 0.5 * distance : curvature * 25 * Math.sqrt(-distance);
}

// Mirrors @xyflow/system getControlWithCurvature.
function control(pos: Side, p: Pt, q: Pt, c: number): Pt {
  switch (pos) {
    case 'left': return { x: p.x - controlOffset(p.x - q.x, c), y: p.y };
    case 'right': return { x: p.x + controlOffset(q.x - p.x, c), y: p.y };
    case 'top': return { x: p.x, y: p.y - controlOffset(p.y - q.y, c) };
    case 'bottom': return { x: p.x, y: p.y + controlOffset(q.y - p.y, c) };
  }
}

export function bezier(s: Pt, sPos: Side, t: Pt, tPos: Side, curvature: number = GEOMETRY.bezierCurvature, samples = 24) {
  const c1 = control(sPos, s, t, curvature);
  const c2 = control(tPos, t, s, curvature);
  const at = (u: number): Pt => {
    const v = 1 - u;
    const a = v * v * v, b = 3 * v * v * u, c = 3 * v * u * u, d = u * u * u;
    return { x: a * s.x + b * c1.x + c * c2.x + d * t.x, y: a * s.y + b * c1.y + c * c2.y + d * t.y };
  };
  const pts: Pt[] = [];
  for (let i = 0; i <= samples; i++) pts.push(at(i / samples));
  return { pts, mid: { x: s.x * 0.125 + c1.x * 0.375 + c2.x * 0.375 + t.x * 0.125, y: s.y * 0.125 + c1.y * 0.375 + c2.y * 0.375 + t.y * 0.125 } };
}

/** Rendered geometry of an edge, or undefined when an endpoint is missing or is a group (groups have no handles). */
export function edgeGeometry(
  e: CanvasFileEdge,
  byId: ReadonlyMap<string, CanvasFileNode>,
  samples = 24,
): EdgeGeom | undefined {
  const a = byId.get(e.fromNode);
  const b = byId.get(e.toNode);
  if (!a || !b || a.type === 'group' || b.type === 'group') return undefined;
  const sPos: Side = e.fromLine && isCode(a) ? 'right' : (e.fromSide ?? 'right');
  const tPos: Side = e.toLine && isCode(b) ? 'left' : (e.toSide ?? 'left');
  const s = e.fromLine && isCode(a) ? { x: a.x + a.width, y: lineY(a, e.fromLine) } : sidePoint(a, sPos);
  const t = e.toLine && isCode(b) ? { x: b.x, y: lineY(b, e.toLine) } : sidePoint(b, tPos);
  const routing = effectiveRouting(e);
  if (routing === 'orthogonal') {
    const { pts, label } = smoothStepPoints(s, sPos, t, tPos);
    return { s, t, sPos, tPos, pts, mid: label, routing };
  }
  if (routing === 'straight') return { s, t, sPos, tPos, pts: [s, t], mid: { x: (s.x + t.x) / 2, y: (s.y + t.y) / 2 }, routing };
  const { pts, mid } = bezier(s, sPos, t, tPos, GEOMETRY.bezierCurvature, samples);
  return { s, t, sPos, tPos, pts, mid, routing };
}

// ---------- segments ----------

/** Liang-Barsky: does the segment p-q pass through the rect's interior? */
export function segmentHitsRect(p: Pt, q: Pt, r: Rect): boolean {
  let t0 = 0;
  let t1 = 1;
  const dx = q.x - p.x;
  const dy = q.y - p.y;
  const clip = (pp: number, qq: number) => {
    if (pp === 0) return qq >= 0;
    const u = qq / pp;
    if (pp < 0) { if (u > t1) return false; if (u > t0) t0 = u; }
    else { if (u < t0) return false; if (u < t1) t1 = u; }
    return true;
  };
  return (
    clip(-dx, p.x - r.x) && clip(dx, r.x + r.w - p.x) && clip(-dy, p.y - r.y) && clip(dy, r.y + r.h - p.y) && t1 >= t0
  );
}

export function polylineHitsRect(pts: Pt[], r: Rect): boolean {
  for (let i = 0; i + 1 < pts.length; i++) if (segmentHitsRect(pts[i], pts[i + 1], r)) return true;
  return false;
}

/** Segment intersection including touching at a vertex (sampled curves cross exactly on a sample point); collinear overlaps do not count. */
export function segmentsCross(a: Pt, b: Pt, c: Pt, d: Pt): boolean {
  const o = (p: Pt, q: Pt, r: Pt) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const d1 = o(a, b, c), d2 = o(a, b, d), d3 = o(c, d, a), d4 = o(c, d, b);
  if ((d1 === 0 && d2 === 0) || (d3 === 0 && d4 === 0)) return false;
  return d1 * d2 <= 0 && d3 * d4 <= 0;
}

export function polylinesCross(p: Pt[], q: Pt[]): boolean {
  for (let i = 0; i + 1 < p.length; i++) {
    for (let j = 0; j + 1 < q.length; j++) if (segmentsCross(p[i], p[i + 1], q[j], q[j + 1])) return true;
  }
  return false;
}

// ---------- free-space search ----------

export type Blockers = {
  /** Non-group node rects (excluding the node being placed). */
  solids: Rect[];
  /** Group rects. */
  groups: { id: string; rect: Rect; label?: Rect }[];
};

/**
 * Why a candidate rect is not acceptable, or undefined when it is: overlaps a solid (inflated by `gap`), is not
 * fully inside every group in `inside`, touches a group not in `inside`, or covers a label tab of a group it is in.
 */
export function blocker(r: Rect, b: Blockers, gap: number, inside: ReadonlySet<string>): Rect | undefined {
  for (const s of b.solids) if (intersects(inflate(r, gap), s)) return s;
  for (const g of b.groups) {
    if (inside.has(g.id)) {
      if (!contains(g.rect, r)) return g.rect;
      if (g.label && intersects(r, g.label)) return g.label;
    } else if (intersects(r, g.rect)) return g.rect;
  }
  return undefined;
}

function push(r: Rect, dir: Dir, by: Rect, g: number): Rect {
  switch (dir) {
    case 'right': return { ...r, x: Math.ceil(by.x + by.w + g) };
    case 'left': return { ...r, x: Math.floor(by.x - g - r.w) };
    case 'down': return { ...r, y: Math.ceil(by.y + by.h + g) };
    case 'up': return { ...r, y: Math.floor(by.y - g - r.h) };
  }
}

/**
 * Find the nearest acceptable position for `start`: check it as is, then push it along each direction in turn past
 * whatever blocks it. Returns undefined when no direction works (e.g. `inside` groups are too small).
 */
export function findFree(
  start: Rect,
  b: Blockers,
  gap: number,
  inside: ReadonlySet<string>,
  dirs: Dir[] = ['right', 'down', 'left', 'up'],
): Rect | undefined {
  if (!blocker(start, b, gap, inside)) return start;
  for (const dir of dirs) {
    let r = start;
    for (let i = 0; i < 40; i++) {
      const hit = blocker(r, b, gap, inside);
      if (!hit) return r;
      // A block by a group we must stay inside cannot be pushed past; give up on this direction.
      if (b.groups.some((g) => inside.has(g.id) && (g.rect === hit || g.label === hit))) break;
      r = push(r, dir, hit, gap);
    }
  }
  return undefined;
}
