import { describe, expect, it } from 'vitest';
import type { CanvasFile, CanvasFileNode } from './canvasFile';
import { DEFAULT_SEVERITY, LINT_RULES, estimateShapeHeight, fixCanvas, lintCanvas } from './lint';

const shape = (id: string, s: string, text: string, x = 0, y = 0, o: Partial<CanvasFileNode> = {}): CanvasFileNode => {
  const def = { 'flowchart.decision': [176, 112], 'uml.class': [224, 160], 'flowchart.terminator': [160, 56], 'c4.person': [224, 176], 'erd.entity': [240, 176] }[s] ?? [176, 72];
  return { id, type: 'text', variant: 'shape', shape: s, text, x, y, width: def[0], height: def[1], ...o } as CanvasFileNode;
};
const rules = (f: CanvasFile) => lintCanvas(f).map((d) => d.rule);

describe('unknown-shape', () => {
  it('is registered as an error rule', () => {
    expect(LINT_RULES).toContain('unknown-shape');
    expect(DEFAULT_SEVERITY['unknown-shape']).toBe('error');
  });
  it('flags unknown node shapes and non-frame group shapes, but not valid ones', () => {
    const f: CanvasFile = {
      nodes: [
        shape('a', 'nope.box', 'x'), shape('b', 'c4.person', 'ok', 400),
        { id: 'g1', type: 'group', label: 'G', shape: 'c4.container', x: 0, y: 300, width: 100, height: 100 },
        { id: 'g2', type: 'group', label: 'G', shape: 'c4.boundary', x: 0, y: 600, width: 100, height: 100 },
      ],
      edges: [],
    };
    const d = lintCanvas(f).filter((x) => x.rule === 'unknown-shape');
    expect(d.map((x) => x.nodeIds[0]).sort()).toEqual(['a', 'g1']);
    expect(d.every((x) => x.severity === 'error')).toBe(true);
  });
});

describe('shape text overflow', () => {
  const long = 'Validate the incoming order request against the current inventory and pricing rules';
  it('center: wraps inside ~70% of the width for decision/terminator', () => {
    expect(estimateShapeHeight(shape('a', 'flowchart.terminator', 'Start') as never)).toBe(36);
    const need = estimateShapeHeight(shape('a', 'flowchart.terminator', long) as never)!;
    expect(need).toBeGreaterThan(56);
    expect(estimateShapeHeight(shape('a', 'flowchart.decision', 'Is the order valid?') as never)!).toBeLessThan(112);
    expect(estimateShapeHeight(shape('a', 'flowchart.decision', long) as never)!).toBeGreaterThan(112);
  });
  it('compartments/table: 32px header + 20px per field line', () => {
    const n = shape('a', 'uml.class', 'Order', 0, 0, { fields: { attributes: ['- a', '- b'], methods: ['+ m()'] } });
    expect(estimateShapeHeight(n as never)).toBe(32 + 3 * 20);
    const e = shape('a', 'erd.entity', 'users', 0, 0, { fields: { columns: Array.from({ length: 10 }, (_, i) => `c${i} text`) } });
    expect(estimateShapeHeight(e as never)).toBe(232);
  });
  it('below: needs room for the figure plus the label', () => {
    const need = estimateShapeHeight(shape('a', 'c4.person', 'Customer') as never)!;
    expect(need).toBe(88 + 20 + 16);
    expect(estimateShapeHeight(shape('a', 'bpmn.start', 'Go') as never)).toBeUndefined(); // label sits outside a small figure
  });
  it('is reported as text-overflow and fixed by growing the height', () => {
    const cols = Array.from({ length: 10 }, (_, i) => `c${i} text`);
    const f: CanvasFile = { nodes: [shape('e', 'erd.entity', 'users', 0, 0, { fields: { columns: cols } })], edges: [] };
    const d = lintCanvas(f).find((x) => x.rule === 'text-overflow')!;
    expect(d).toBeDefined();
    const fixed = fixCanvas(f).canvas.nodes[0];
    expect(fixed.height).toBe(232);
    expect(rules({ nodes: [fixed], edges: [] })).not.toContain('text-overflow');
  });
  it('default-sized shapes with short text are clean', () => {
    const f: CanvasFile = { nodes: [shape('a', 'flowchart.decision', 'Valid?'), shape('b', 'uml.class', 'Order', 400, 0, { fields: { attributes: ['- id'], methods: ['+ pay()'] } })], edges: [] };
    expect(rules(f)).toEqual([]);
  });
});

describe('orthogonal edge geometry in lint', () => {
  const n = (id: string, x: number, y: number, w = 100, h = 60) => shape(id, 'flowchart.process', id, x, y, { width: w, height: h });
  it('reports an orthogonal edge through a node in its step', () => {
    const f: CanvasFile = {
      nodes: [n('a', 0, 0), n('b', 300, 200), n('w', 180, 90, 40, 20)],
      edges: [{ id: 'e', fromNode: 'a', toNode: 'b', routing: 'orthogonal' }],
    };
    expect(lintCanvas(f).some((d) => d.rule === 'edge-through-node' && d.nodeIds.includes('w'))).toBe(true);
    // the same edge as a straight line passes clear of that node
    const g = structuredClone(f);
    g.edges[0].routing = 'straight';
    expect(lintCanvas(g).some((d) => d.rule === 'edge-through-node')).toBe(false);
  });
  it('places the label at the step path center', () => {
    // label centre at (200, 130) sits over the wall node
    const f: CanvasFile = {
      nodes: [n('a', 0, 0), n('b', 300, 200), n('w', 180, 110, 40, 40)],
      edges: [{ id: 'e', fromNode: 'a', toNode: 'b', routing: 'orthogonal', label: 'go' }],
    };
    expect(lintCanvas(f).some((d) => d.rule === 'edge-label-overlap')).toBe(true);
  });
});
