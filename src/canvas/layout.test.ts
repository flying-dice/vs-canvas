import { describe, expect, it } from 'vitest';
import type { CanvasFile, CanvasFileNode } from '../shared/canvasFile';
import { intersects, rectOf } from '../shared/geometry';
import { applyMoves, assignLayers, layoutNodes } from './layout';

const n = (id: string, x = 0, y = 0, w = 200, h = 100): CanvasFileNode =>
  ({ id, type: 'text', text: 'x', x, y, width: w, height: h }) as CanvasFileNode;
const e = (id: string, a: string, b: string) => ({ id, fromNode: a, toNode: b });
const noOverlap = (f: CanvasFile) => {
  const ns = f.nodes.filter((x) => x.type !== 'group');
  for (let i = 0; i < ns.length; i++) for (let j = i + 1; j < ns.length; j++) expect(intersects(rectOf(ns[i]), rectOf(ns[j]))).toBe(false);
};

describe('assignLayers', () => {
  it('uses the longest path and survives cycles', () => {
    const l = assignLayers(['a', 'b', 'c', 'd'], [
      { from: 'a', to: 'b' }, { from: 'b', to: 'c' }, { from: 'a', to: 'c' }, { from: 'c', to: 'a' },
    ]);
    expect(l.get('a')).toBe(0);
    expect(l.get('b')).toBe(1);
    expect(l.get('c')).toBe(2);
    expect(l.get('d')).toBe(0);
  });
});

describe('layoutNodes', () => {
  const f = (): CanvasFile => ({
    nodes: [n('a'), n('b'), n('c'), n('d')],
    edges: [e('e1', 'a', 'b'), e('e2', 'a', 'c'), e('e3', 'b', 'd'), e('e4', 'c', 'd')],
  });

  it('lays out layered left to right with the gaps', () => {
    const file = f();
    applyMoves(file, layoutNodes(file, ['a', 'b', 'c', 'd']));
    const g = (id: string) => file.nodes.find((x) => x.id === id)!;
    expect(g('b').x).toBe(g('a').x + 200 + 120);
    expect(g('d').x).toBe(g('b').x + 200 + 120);
    expect(g('c').x).toBe(g('b').x);
    expect(Math.abs(g('c').y - g('b').y)).toBe(132);
    noOverlap(file);
  });

  it('never moves nodes outside the set and does not overlap them', () => {
    const file = f();
    file.nodes.push(n('fixed', 300, 0, 300, 400));
    const before = rectOf(file.nodes[4]);
    applyMoves(file, layoutNodes(file, ['a', 'b', 'c', 'd']));
    expect(rectOf(file.nodes[4])).toEqual(before);
    noOverlap(file);
  });

  it('keeps the anchor in place (incoming left, outgoing right)', () => {
    const file: CanvasFile = {
      nodes: [n('root', 1000, 500), n('caller', 0, 0), n('callee', 0, 0)],
      edges: [e('e1', 'caller', 'root'), e('e2', 'root', 'callee')],
    };
    applyMoves(file, layoutNodes(file, ['root', 'caller', 'callee'], { anchor: 'root' }));
    const g = (id: string) => file.nodes.find((x) => x.id === id)!;
    expect(g('root')).toMatchObject({ x: 1000, y: 500 });
    expect(g('caller').x).toBe(1000 - 320);
    expect(g('callee').x).toBe(1000 + 320);
    noOverlap(file);
  });

  it('supports grid and column', () => {
    const file: CanvasFile = { nodes: [n('a'), n('b'), n('c'), n('d'), n('e')], edges: [] };
    const ids = file.nodes.map((x) => x.id);
    const col = layoutNodes(file, ids, { algorithm: 'column' });
    expect(new Set(col.map((m) => m.x)).size).toBe(1);
    const grid = layoutNodes(file, ids, { algorithm: 'grid' });
    expect(new Set(grid.map((m) => m.x)).size).toBe(3);
    applyMoves(file, grid);
    noOverlap(file);
  });

  it('ignores groups and unknown ids', () => {
    const file: CanvasFile = { nodes: [{ id: 'g', type: 'group', x: 0, y: 0, width: 50, height: 50 }, n('a')], edges: [] };
    expect(layoutNodes(file, ['g', 'zzz'])).toEqual([]);
  });
});

describe('assignLayers source pulling', () => {
  it('places a source next to its successor rather than in layer 0', () => {
    // a -> b -> c, and evidence e -> c: e belongs in the layer just before c.
    const l = assignLayers(['a', 'b', 'c', 'e'], [
      { from: 'a', to: 'b' },
      { from: 'b', to: 'c' },
      { from: 'e', to: 'c' },
    ]);
    expect(l.get('a')).toBe(0);
    expect(l.get('c')).toBe(2);
    expect(l.get('e')).toBe(1);
  });
});

describe('layered direction', () => {
  it('TB stacks layers top to bottom and centers a layer on the widest one', () => {
    const file: CanvasFile = {
      nodes: [n('a', 0, 0, 200, 100), n('b', 0, 0, 100, 60), n('c', 0, 0, 100, 60), n('d', 0, 0, 200, 100)],
      edges: [e('e1', 'a', 'b'), e('e2', 'a', 'c'), e('e3', 'b', 'd'), e('e4', 'c', 'd')],
    };
    applyMoves(file, layoutNodes(file, ['a', 'b', 'c', 'd'], { direction: 'TB' }));
    const g = (id: string) => file.nodes.find((x) => x.id === id)!;
    expect(g('b').y).toBe(g('a').y + 100 + 120);
    expect(g('c').y).toBe(g('b').y);
    expect(g('d').y).toBe(g('b').y + 60 + 120);
    expect(g('b').x).toBeLessThan(g('c').x);
    expect(g('a').x + 100).toBe((g('b').x + g('c').x + 100) / 2); // a centred over b and c
    noOverlap(file);
  });
  it('LR stays the default', () => {
    const file: CanvasFile = { nodes: [n('a'), n('b')], edges: [e('e1', 'a', 'b')] };
    applyMoves(file, layoutNodes(file, ['a', 'b']));
    expect(file.nodes[1].x).toBeGreaterThan(file.nodes[0].x);
    expect(file.nodes[1].y).toBe(file.nodes[0].y);
  });
});
