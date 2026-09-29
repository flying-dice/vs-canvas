import { describe, expect, it } from 'vitest';
import { SHAPES } from '../../../../src/shared/shapes';
import { RENDERERS, geometryFor, missingRenderers, shift, minSizeOfShape } from './renderers';

const sizes = (id: string, size: [number, number]): [number, number][] => {
  const s = SHAPES.find((q) => q.id === id)!;
  const min = minSizeOfShape(id);
  return [size, min, [size[0] * 1.5, size[1] * 1.5], [size[0] * 2, size[1] * 0.75].map((v) => Math.max(v, 8)) as [number, number]];
};

describe('shape renderers', () => {
  it('covers every shape id', () => {
    expect(missingRenderers()).toEqual([]);
    for (const id of Object.keys(RENDERERS)) expect(SHAPES.some((s) => s.id === id), `unknown renderer ${id}`).toBe(true);
  });

  for (const s of SHAPES) {
    it(`${s.id}: valid path data and a text box inside the bounds`, () => {
      for (const [w, h] of sizes(s.id, s.size)) {
        const g = geometryFor(s.id, w, h, { label: 'Payments' });
        for (const p of [g.outline, ...g.decorations.map((x) => x.d)]) {
          expect(p, `${s.id} ${w}x${h}`).toMatch(/^M/);
          expect(p).not.toMatch(/NaN|Infinity|undefined/);
        }
        const tb = g.textBox;
        expect(tb.w).toBeGreaterThanOrEqual(0);
        expect(tb.h).toBeGreaterThanOrEqual(0);
        if (g.labelOutside) {
          // directly under the shape, centred on it
          expect(tb.y).toBeGreaterThanOrEqual(h);
          expect(tb.x + tb.w / 2).toBeCloseTo(w / 2, 0);
        } else {
          expect(tb.x, `${s.id} ${w}x${h} x`).toBeGreaterThanOrEqual(0);
          expect(tb.y, `${s.id} ${w}x${h} y`).toBeGreaterThanOrEqual(0);
          expect(tb.x + tb.w, `${s.id} ${w}x${h} right`).toBeLessThanOrEqual(w + 0.01);
          expect(tb.y + tb.h, `${s.id} ${w}x${h} bottom`).toBeLessThanOrEqual(h + 0.01);
        }
      }
    });
    it(`${s.id}: below layouts define a figure`, () => {
      if (s.layout !== 'below') return;
      const g = geometryFor(s.id, s.size[0], s.size[1]);
      expect(g.figure).toBeDefined();
      expect(g.figure!.x + g.figure!.w).toBeLessThanOrEqual(s.size[0] + 0.01);
      expect(g.figure!.y + g.figure!.h).toBeLessThanOrEqual(s.size[1] + 0.01);
    });
    it(`${s.id}: default text box leaves room for a label`, () => {
      const g = geometryFor(s.id, s.size[0], s.size[1]);
      const hidden = s.tone === 'filled' || s.id === 'uml.final' || s.id === 'uml.fork';
      if (!hidden && s.layout !== 'compartments' && s.layout !== 'table' && !s.frame) {
        expect(g.textBox.w, s.id).toBeGreaterThanOrEqual(24);
        expect(g.textBox.h, s.id).toBeGreaterThanOrEqual(g.labelOutside ? 24 : 16);
      }
    });
  }

  it('keeps circles round for keepAspect shapes', () => {
    const g = geometryFor('flowchart.connector', 48, 48);
    expect(g.outline).toContain('A');
  });
  it('falls back to a card for unknown ids', () => {
    expect(geometryFor('nope.nothing', 100, 60).outline).toMatch(/^M/);
  });
  it('translates absolute paths', () => {
    expect(shift('M0 0H4V4A2 2 0 0 1 0 4Z', 10, 20)).toBe('M 10 20 H 14 V 24 A 2 2 0 0 1 10 24 Z');
  });
  it('has a minimum size for every shape', () => {
    for (const s of SHAPES) expect(minSizeOfShape(s.id).every((v) => v > 0)).toBe(true);
  });
});
