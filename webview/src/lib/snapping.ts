// Pure snapping for dragged nodes: align edges/centres with other nodes (within a screen-space threshold), else
// snap to the 8px grid. Returns the guide lines and gap labels to draw (in flow coordinates).
import type { Rect } from '../../../src/shared/geometry';

export type { Rect };

/** A guide line. axis 'x' = vertical line at x = pos spanning y from..to; axis 'y' = horizontal line at y = pos. */
export type Guide = { axis: 'x' | 'y'; pos: number; from: number; to: number; kind: 'edge' | 'center' };

/** A gap between the dragged rect and its nearest neighbour. axis 'x' = horizontal gap at height `at`. */
export type DistanceLabel = { axis: 'x' | 'y'; from: number; to: number; at: number; value: number };

export type SnapOptions = {
  /** Canvas zoom; the threshold is `threshold / zoom` flow px. Default 1. */
  zoom?: number;
  /** Screen px within which an edge/centre snaps. Default 6. */
  threshold?: number;
  /** Grid size in flow px used when nothing aligns. Default 8. Use 0 to disable the grid fallback. */
  grid?: number;
};

export type SnapResult = {
  x: number;
  y: number;
  guides: Guide[];
  distances: DistanceLabel[];
  /** How each axis was snapped. */
  snapped: { x: 'guide' | 'grid' | 'none'; y: 'guide' | 'grid' | 'none' };
};

type Axis1 = { start: number; size: number };
const anchors = (a: Axis1): [number, number, number] => [a.start, a.start + a.size / 2, a.start + a.size];

/** Best alignment delta for one axis, or undefined when nothing is within `t`. */
function bestDelta(d: Axis1, others: Axis1[], t: number): number | undefined {
  let best: number | undefined;
  const da = anchors(d);
  for (const o of others) {
    for (const oa of anchors(o)) {
      for (const x of da) {
        const delta = oa - x;
        if (Math.abs(delta) <= t && (best === undefined || Math.abs(delta) < Math.abs(best))) best = delta;
      }
    }
  }
  return best;
}

const EPS = 0.5;

export function snapRect(dragged: Rect, others: readonly Rect[], opts: SnapOptions = {}): SnapResult {
  const zoom = opts.zoom && opts.zoom > 0 ? opts.zoom : 1;
  const t = (opts.threshold ?? 6) / zoom;
  const grid = opts.grid ?? 8;

  const dx = bestDelta({ start: dragged.x, size: dragged.w }, others.map((o) => ({ start: o.x, size: o.w })), t);
  const dy = bestDelta({ start: dragged.y, size: dragged.h }, others.map((o) => ({ start: o.y, size: o.h })), t);

  const snapAxis = (v: number, delta: number | undefined) =>
    delta !== undefined ? v + delta : grid > 0 ? Math.round(v / grid) * grid : v;
  const x = snapAxis(dragged.x, dx);
  const y = snapAxis(dragged.y, dy);
  const r: Rect = { x, y, w: dragged.w, h: dragged.h };

  const guides: Guide[] = [];
  const add = (g: Guide) => {
    const hit = guides.find((q) => q.axis === g.axis && Math.abs(q.pos - g.pos) < EPS);
    if (hit) {
      hit.from = Math.min(hit.from, g.from);
      hit.to = Math.max(hit.to, g.to);
      if (g.kind === 'edge') hit.kind = 'edge';
    } else guides.push(g);
  };
  const names: ('edge' | 'center')[] = ['edge', 'center', 'edge'];
  if (dx !== undefined) {
    const da = anchors({ start: r.x, size: r.w });
    for (const o of others) {
      anchors({ start: o.x, size: o.w }).forEach((oa, j) =>
        da.forEach((a, i) => {
          if (Math.abs(oa - a) < EPS)
            add({ axis: 'x', pos: oa, from: Math.min(r.y, o.y), to: Math.max(r.y + r.h, o.y + o.h), kind: names[i] === 'center' && names[j] === 'center' ? 'center' : 'edge' });
        }),
      );
    }
  }
  if (dy !== undefined) {
    const da = anchors({ start: r.y, size: r.h });
    for (const o of others) {
      anchors({ start: o.y, size: o.h }).forEach((oa, j) =>
        da.forEach((a, i) => {
          if (Math.abs(oa - a) < EPS)
            add({ axis: 'y', pos: oa, from: Math.min(r.x, o.x), to: Math.max(r.x + r.w, o.x + o.w), kind: names[i] === 'center' && names[j] === 'center' ? 'center' : 'edge' });
        }),
      );
    }
  }

  return {
    x,
    y,
    guides,
    distances: guides.length ? gaps(r, others) : [],
    snapped: {
      x: dx !== undefined ? 'guide' : grid > 0 ? 'grid' : 'none',
      y: dy !== undefined ? 'guide' : grid > 0 ? 'grid' : 'none',
    },
  };
}

/** Nearest neighbour gap on each side of `r` (only neighbours overlapping it on the other axis). */
export function gaps(r: Rect, others: readonly Rect[]): DistanceLabel[] {
  const out: DistanceLabel[] = [];
  const overlapY = (o: Rect) => Math.min(r.y + r.h, o.y + o.h) - Math.max(r.y, o.y);
  const overlapX = (o: Rect) => Math.min(r.x + r.w, o.x + o.w) - Math.max(r.x, o.x);

  let left: Rect | undefined;
  let right: Rect | undefined;
  let up: Rect | undefined;
  let down: Rect | undefined;
  for (const o of others) {
    if (overlapY(o) > 0) {
      if (o.x + o.w <= r.x && (!left || o.x + o.w > left.x + left.w)) left = o;
      if (o.x >= r.x + r.w && (!right || o.x < right.x)) right = o;
    }
    if (overlapX(o) > 0) {
      if (o.y + o.h <= r.y && (!up || o.y + o.h > up.y + up.h)) up = o;
      if (o.y >= r.y + r.h && (!down || o.y < down.y)) down = o;
    }
  }
  const midY = (o: Rect) => (Math.max(r.y, o.y) + Math.min(r.y + r.h, o.y + o.h)) / 2;
  const midX = (o: Rect) => (Math.max(r.x, o.x) + Math.min(r.x + r.w, o.x + o.w)) / 2;
  if (left) out.push({ axis: 'x', from: left.x + left.w, to: r.x, at: midY(left), value: r.x - (left.x + left.w) });
  if (right) out.push({ axis: 'x', from: r.x + r.w, to: right.x, at: midY(right), value: right.x - (r.x + r.w) });
  if (up) out.push({ axis: 'y', from: up.y + up.h, to: r.y, at: midX(up), value: r.y - (up.y + up.h) });
  if (down) out.push({ axis: 'y', from: r.y + r.h, to: down.y, at: midX(down), value: down.y - (r.y + r.h) });
  return out.filter((d) => d.value > 0);
}
