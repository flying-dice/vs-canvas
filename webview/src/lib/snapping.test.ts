import { describe, expect, it } from 'vitest';
import { snapRect } from './snapping';

const other = { x: 100, y: 100, w: 200, h: 100 };

describe('snapRect', () => {
  it('snaps a left edge to another left edge within the threshold', () => {
    const r = snapRect({ x: 104, y: 400, w: 80, h: 40 }, [other]);
    expect(r.x).toBe(100);
    expect(r.snapped.x).toBe('guide');
    expect(r.guides.some((g) => g.axis === 'x' && g.pos === 100)).toBe(true);
  });

  it('snaps centres', () => {
    // other centre x = 200; dragged centre = 197 + 40 = 237 -> no; use w 80 at x 157 -> centre 197
    const r = snapRect({ x: 157, y: 400, w: 80, h: 40 }, [other]);
    expect(r.x).toBe(160);
    const g = r.guides.find((q) => q.axis === 'x');
    expect(g?.pos).toBe(200);
    expect(g?.kind).toBe('center');
  });

  it('snaps right edge to left edge (abutting)', () => {
    const r = snapRect({ x: 12, y: 104, w: 90, h: 50 }, [other]);
    expect(r.x).toBe(10); // right edge 100
    expect(r.y).toBe(100); // top aligned
  });

  it('threshold is 6 screen px: shrinks in flow px with zoom', () => {
    const near = snapRect({ x: 104, y: 400, w: 80, h: 40 }, [other], { zoom: 2, grid: 0 });
    expect(near.x).toBe(104); // 4 flow px = 8 screen px > 6
    expect(near.snapped.x).toBe('none');
    const far = snapRect({ x: 120, y: 400, w: 60, h: 40 }, [other], { zoom: 0.25, grid: 0 });
    expect(far.x).toBe(100); // 20 flow px = 5 screen px
  });

  it('falls back to the 8px grid when nothing aligns', () => {
    const r = snapRect({ x: 517, y: 843, w: 80, h: 40 }, [other]);
    expect(r.x).toBe(520);
    expect(r.y).toBe(840);
    expect(r.snapped).toEqual({ x: 'grid', y: 'grid' });
    expect(r.guides).toEqual([]);
  });

  it('can disable the grid', () => {
    const r = snapRect({ x: 517, y: 843, w: 80, h: 40 }, [], { grid: 0 });
    expect(r.x).toBe(517);
    expect(r.y).toBe(843);
  });

  it('merges guide extents across multiple aligned rects', () => {
    const a = { x: 100, y: 0, w: 50, h: 50 };
    const b = { x: 100, y: 300, w: 50, h: 50 };
    const r = snapRect({ x: 103, y: 150, w: 50, h: 50 }, [a, b], { grid: 0 });
    const g = r.guides.find((q) => q.axis === 'x' && q.pos === 100);
    expect(g?.from).toBe(0);
    expect(g?.to).toBe(350);
  });

  it('reports gaps to the nearest neighbours when aligned', () => {
    const r = snapRect({ x: 400, y: 102, w: 80, h: 40 }, [other]);
    expect(r.y).toBe(100);
    const d = r.distances.find((q) => q.axis === 'x');
    expect(d?.value).toBe(100); // 300 -> 400
  });
});
