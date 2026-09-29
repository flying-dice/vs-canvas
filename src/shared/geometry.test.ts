import { getSmoothStepPath, Position } from '@xyflow/system';
import { describe, expect, it } from 'vitest';
import type { CanvasFileEdge, CanvasFileNode, Side } from './canvasFile';
import { edgeGeometry, effectiveRouting, polylineHitsRect, smoothStepPoints, type Pt } from './geometry';

const POS: Record<Side, Position> = { left: Position.Left, right: Position.Right, top: Position.Top, bottom: Position.Bottom };

/** Vertices of an xyflow smooth-step path drawn with borderRadius 0 (consecutive duplicates removed). */
function xyflowPoints(s: Pt, sp: Side, t: Pt, tp: Side) {
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX: s.x, sourceY: s.y, sourcePosition: POS[sp], targetX: t.x, targetY: t.y, targetPosition: POS[tp], borderRadius: 0, offset: 20,
  });
  const nums = (path.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
  const pts: Pt[] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) {
    const p = { x: nums[i], y: nums[i + 1] };
    const last = pts[pts.length - 1];
    if (!last || last.x !== p.x || last.y !== p.y) pts.push(p);
  }
  return { pts, label: { x: labelX, y: labelY } };
}

describe('smoothStepPoints mirrors @xyflow/system getSmoothStepPath', () => {
  const sides: Side[] = ['left', 'right', 'top', 'bottom'];
  const targets: Pt[] = [{ x: 300, y: 40 }, { x: 300, y: -90 }, { x: -200, y: 60 }, { x: 10, y: 200 }, { x: 5, y: -150 }, { x: 310, y: 8 }];
  const s = { x: 100, y: 50 };
  for (const sp of sides) {
    for (const tp of sides) {
      it(`${sp} -> ${tp}`, () => {
        for (const t of targets) {
          const mine = smoothStepPoints(s, sp, t, tp);
          const ref = xyflowPoints(s, sp, t, tp);
          const dedup = mine.pts.filter((p, i) => i === 0 || p.x !== mine.pts[i - 1].x || p.y !== mine.pts[i - 1].y);
          expect(dedup).toEqual(ref.pts);
          expect(mine.label).toEqual(ref.label);
        }
      });
    }
  }
});

const box = (id: string, x: number, y: number, w = 100, h = 60): CanvasFileNode =>
  ({ id, type: 'text', variant: 'shape', shape: 'flowchart.process', text: id, x, y, width: w, height: h }) as CanvasFileNode;
const byId = (...ns: CanvasFileNode[]) => new Map(ns.map((n) => [n.id, n]));

describe('edgeGeometry routing', () => {
  const a = box('a', 0, 0);
  const b = box('b', 300, 200);
  const e = (o: Partial<CanvasFileEdge> = {}): CanvasFileEdge => ({ id: 'e', fromNode: 'a', toNode: 'b', ...o });

  it('straight is one segment with the midpoint label', () => {
    const g = edgeGeometry(e({ routing: 'straight' }), byId(a, b))!;
    expect(g.pts).toEqual([g.s, g.t]);
    expect(g.mid).toEqual({ x: (g.s.x + g.t.x) / 2, y: (g.s.y + g.t.y) / 2 });
  });
  it('orthogonal has axis-aligned segments and the xyflow label position', () => {
    const g = edgeGeometry(e({ routing: 'orthogonal' }), byId(a, b))!;
    for (let i = 0; i + 1 < g.pts.length; i++) expect(g.pts[i].x === g.pts[i + 1].x || g.pts[i].y === g.pts[i + 1].y).toBe(true);
    expect(g.mid).toEqual(xyflowPoints(g.s, g.sPos, g.t, g.tPos).label);
  });
  it('a relation preset supplies the routing unless the edge sets its own', () => {
    expect(effectiveRouting({ relation: 'uml.inheritance' })).toBe('orthogonal');
    expect(effectiveRouting({ relation: 'uml.inheritance', routing: 'straight' })).toBe('straight');
    expect(effectiveRouting({})).toBe('bezier');
  });
  it('orthogonal polylines hit nodes that the bezier would miss', () => {
    const wall = box('w', 180, 90, 40, 20); // in the vertical run of the step path (x = 200)
    const g = edgeGeometry(e({ routing: 'orthogonal' }), byId(a, b, wall))!;
    expect(polylineHitsRect(g.pts, { x: 180, y: 90, w: 40, h: 20 })).toBe(true);
  });
});
