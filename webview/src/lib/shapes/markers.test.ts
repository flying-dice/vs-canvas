import { describe, expect, it } from 'vitest';
import { EDGE_MARKERS, RELATIONS } from '../../../../src/shared/shapes';
import { MARKER_GLYPHS, MARKER_REACH, dashFor, edgeLook } from './markers';

describe('marker glyphs', () => {
  it('has a glyph set for every EdgeMarker', () => {
    for (const m of EDGE_MARKERS) expect(MARKER_GLYPHS[m], m).toBeDefined();
  });
  it('draws every glyph behind the path end (x <= 0) within the reach', () => {
    for (const [m, gs] of Object.entries(MARKER_GLYPHS)) {
      for (const g of gs) {
        const nums = g.d.match(/-?\d+(\.\d+)?/g)!.map(Number);
        expect(nums.every((n) => Number.isFinite(n)), m).toBe(true);
        expect(Math.min(...nums), m).toBeGreaterThanOrEqual(-MARKER_REACH);
      }
    }
  });
});

describe('edgeLook', () => {
  const base = { id: 'e', fromNode: 'a', toNode: 'b' };
  it('defaults to a plain curved arrow', () => {
    expect(edgeLook(base)).toMatchObject({ fromMarker: 'none', toMarker: 'arrow', lineStyle: 'solid', routing: 'bezier', diagram: false });
  });
  it('falls back to fromEnd/toEnd', () => {
    expect(edgeLook({ ...base, toEnd: 'none', fromEnd: 'arrow' })).toMatchObject({ fromMarker: 'arrow', toMarker: 'none' });
  });
  it('lets explicit markers win over ends and relation', () => {
    const l = edgeLook({ ...base, toEnd: 'none', relation: 'uml.inheritance', toMarker: 'diamond' });
    expect(l.toMarker).toBe('diamond');
    expect(l.lineStyle).toBe('solid');
    expect(l.routing).toBe('orthogonal');
  });
  it('resolves every relation preset', () => {
    for (const r of RELATIONS) {
      const l = edgeLook({ ...base, relation: r.id });
      expect(l.toMarker).toBe(r.toMarker);
      expect(l.diagram).toBe(true);
    }
  });
  it('maps line styles to dashes', () => {
    expect(dashFor('solid')).toEqual({});
    expect(dashFor('dashed').dash).toBe('6 4');
    expect(dashFor('dotted').cap).toBe('round');
  });
});
