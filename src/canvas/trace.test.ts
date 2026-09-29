import { describe, expect, it } from 'vitest';
import type { CanvasFile, FileNode } from '../shared/canvasFile';
import { intersects, rectOf } from '../shared/geometry';
import { applyTrace, chooseWindow, finalizeItem, type TraceItem, type TracePlan } from './trace';

const item = (key: string, start: number, end: number, sel = start, requires: number[] = []): TraceItem =>
  finalizeItem({ key, name: key, file: `${key}.ts`, selLine: sel, start, end, requires });

describe('chooseWindow', () => {
  it('caps to 30 lines from the start', () => expect(chooseWindow(10, 200, [10])).toEqual([10, 39]));
  it('shifts to include a far call site', () => {
    const [s, e] = chooseWindow(10, 200, [50, 60]);
    expect(e - s + 1).toBeLessThanOrEqual(30);
    expect(s).toBeLessThanOrEqual(50);
    expect(e).toBeGreaterThanOrEqual(60);
  });
  it('stays inside the symbol', () => expect(chooseWindow(5, 12, [7])).toEqual([5, 12]));
});

describe('applyTrace', () => {
  const plan = (): TracePlan => ({
    root: item('root', 10, 20),
    items: [item('caller', 1, 40, 1, [5]), item('callee', 100, 110)],
    links: [
      { from: 'caller', to: 'root', callSites: [5], label: 'root' },
      { from: 'root', to: 'callee', callSites: [12], label: 'callee' },
    ],
  });

  it('creates nodes, anchored edges, and a non-overlapping layout with callers left of the root', () => {
    const f: CanvasFile = { nodes: [], edges: [] };
    const r = applyTrace(f, plan());
    expect(r.newNodes).toHaveLength(3);
    const g = (k: string) => f.nodes.find((n) => n.id === r.nodes[k])!;
    expect(g('caller').x).toBeLessThan(g('root').x);
    expect(g('callee').x).toBeGreaterThan(g('root').x);
    expect(f.edges).toHaveLength(2);
    expect(f.edges[0]).toMatchObject({ fromLine: 5, toLine: 10, label: 'root' });
    expect(f.edges[1]).toMatchObject({ fromLine: 12, toLine: 100 });
    for (let i = 0; i < f.nodes.length; i++) for (let j = i + 1; j < f.nodes.length; j++) {
      expect(intersects(rectOf(f.nodes[i]), rectOf(f.nodes[j]))).toBe(false);
    }
  });

  it('reuses nodes already showing an item and does not duplicate edges', () => {
    const f: CanvasFile = { nodes: [], edges: [] };
    const first = applyTrace(f, plan());
    const before = { n: f.nodes.length, e: f.edges.length };
    const again = applyTrace(f, plan());
    expect(again.newNodes).toEqual([]);
    expect(again.rootId).toBe(first.rootId);
    expect({ n: f.nodes.length, e: f.edges.length }).toEqual(before);
  });

  it('uses the given root node and drops anchors outside a restricted range', () => {
    const f: CanvasFile = {
      nodes: [{ id: 'code-1', type: 'file', file: 'root.ts', lines: [10, 30], x: 0, y: 0, width: 420, height: 400 } as FileNode],
      edges: [],
    };
    const p = plan();
    p.links[1].callSites = [50]; // outside code-1's range
    const r = applyTrace(f, p, { rootNode: 'code-1' });
    expect(r.rootId).toBe('code-1');
    expect(f.edges.find((e) => e.label === 'callee')?.fromLine).toBeUndefined();
  });
});
