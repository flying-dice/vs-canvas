import { describe, expect, it } from 'vitest';
import type { CanvasFile, CanvasFileEdge, CanvasFileNode } from './canvasFile';
import { GEOMETRY, applyLintFix, estimateTextHeight, fixCanvas, lintCanvas, type LintRuleId } from './lint';
import { edgeGeometry } from './geometry';

const note = (id: string, x: number, y: number, w = 200, h = 100, extra: object = {}): CanvasFileNode =>
  ({ id, type: 'text', text: 'hi', x, y, width: w, height: h, ...extra }) as CanvasFileNode;
const group = (id: string, x: number, y: number, w: number, h: number, label = 'Group'): CanvasFileNode =>
  ({ id, type: 'group', label, x, y, width: w, height: h }) as CanvasFileNode;
const code = (id: string, x: number, y: number, extra: object = {}): CanvasFileNode =>
  ({ id, type: 'file', file: 'a.ts', display: 'code', lines: [10, 30], x, y, width: 420, height: 400, ...extra }) as CanvasFileNode;
const edge = (id: string, from: string, to: string, extra: object = {}): CanvasFileEdge =>
  ({ id, fromNode: from, toNode: to, ...extra }) as CanvasFileEdge;
const cf = (nodes: CanvasFileNode[], edges: CanvasFileEdge[] = []): CanvasFile => ({ nodes, edges });
const rules = (c: CanvasFile, o = {}) => lintCanvas(c, o).map((d) => d.rule);
const has = (c: CanvasFile, r: LintRuleId, o = {}) => rules(c, o).includes(r);
const get = (c: CanvasFile, r: LintRuleId, o = {}) => lintCanvas(c, o).find((d) => d.rule === r);
const byId = (c: CanvasFile, id: string) => c.nodes.find((n) => n.id === id)!;

describe('node-overlap / node-crowded', () => {
  it('flags overlapping nodes as an error and fixes the later node only', () => {
    const c = cf([note('a', 0, 0), note('b', 100, 50)]);
    const d = get(c, 'node-overlap')!;
    expect(d.severity).toBe('error');
    expect(d.nodeIds).toEqual(['a', 'b']);
    expect(d.fix!.moves!.map((m) => m.id)).toEqual(['b']);
    const fixed = applyLintFix(c, d.fix!);
    expect(has(fixed, 'node-overlap')).toBe(false);
    expect(byId(fixed, 'a')).toMatchObject({ x: 0, y: 0 });
  });
  it('separates along the axis of least penetration', () => {
    const c = cf([note('a', 0, 0), note('b', 190, 10)]); // 10px in x, 90 in y
    const m = get(c, 'node-overlap')!.fix!.moves![0];
    expect(m.x).toBe(224); // 200 + minGap 24
    expect(m.y).toBe(10);
  });
  it('flags near misses as crowded and passes well separated nodes', () => {
    expect(has(cf([note('a', 0, 0), note('b', 210, 0)]), 'node-crowded')).toBe(true);
    expect(get(cf([note('a', 0, 0), note('b', 210, 0)]), 'node-crowded')!.severity).toBe('warning');
    expect(rules(cf([note('a', 0, 0), note('b', 300, 0)]))).toEqual([]);
    expect(has(cf([note('a', 0, 0), note('b', 210, 0)]), 'node-crowded', { minGap: 5 })).toBe(false);
  });
  it('ignores groups', () => {
    expect(has(cf([group('g', 0, 0, 500, 400), note('a', 20, 60)]), 'node-overlap')).toBe(false);
  });
  it('respects rule severity overrides and off', () => {
    const c = cf([note('a', 0, 0), note('b', 10, 10)]);
    expect(get(c, 'node-overlap', { rules: { 'node-overlap': 'info' } })!.severity).toBe('info');
    expect(has(c, 'node-overlap', { rules: { 'node-overlap': 'off' } })).toBe(false);
  });
});

describe('groups', () => {
  const g = group('g', 0, 0, 600, 400);
  it('group-straddle: flags partial intersection, not contained or disjoint', () => {
    expect(has(cf([g, note('a', 500, 100)]), 'group-straddle')).toBe(true);
    expect(has(cf([g, note('a', 100, 100)]), 'group-straddle')).toBe(false);
    expect(has(cf([g, note('a', 700, 100)]), 'group-straddle')).toBe(false);
  });
  it('group-straddle fix: mostly inside moves inside, mostly outside moves outside', () => {
    const inside = cf([g, note('a', 500, 100)]); // 100 of 200 px... 50%: not > 50 -> use 450
    const mostlyIn = cf([g, note('a', 450, 100)]);
    const f1 = fixCanvas(mostlyIn).canvas;
    const a1 = byId(f1, 'a');
    expect(a1.x).toBeGreaterThanOrEqual(0);
    expect(a1.x + a1.width).toBeLessThanOrEqual(600);
    expect(has(f1, 'group-straddle')).toBe(false);
    void inside;
    const mostlyOut = cf([g, note('a', 560, 100)]);
    const f2 = fixCanvas(mostlyOut).canvas;
    const a2 = byId(f2, 'a');
    expect(a2.x).toBeGreaterThanOrEqual(600);
    expect(lintCanvas(f2).filter((d) => d.severity !== 'info' && d.rule !== 'empty-group')).toEqual([]);
  });
  it('group-label-covered: node under the label tab', () => {
    const c = cf([g, note('a', 10, 10)]);
    expect(has(c, 'group-label-covered')).toBe(true);
    expect(has(cf([g, note('a', 10, 60)]), 'group-label-covered')).toBe(false);
    expect(has(cf([group('h', 0, 0, 600, 400, ''), note('a', 10, 10)]), 'group-label-covered')).toBe(false);
    const fixed = fixCanvas(c).canvas;
    expect(byId(fixed, 'a').y).toBeGreaterThanOrEqual(GEOMETRY.groupLabelHeight);
    expect(has(fixed, 'group-label-covered')).toBe(false);
  });
  it('group-order: group after a member', () => {
    const c = cf([note('a', 50, 60), g]);
    const d = get(c, 'group-order')!;
    expect(d.severity).toBe('info');
    expect(d.fix!.reorder).toEqual(['g', 'a']);
    expect(rules(cf([g, note('a', 50, 60)]))).not.toContain('group-order');
    expect(fixCanvas(c).canvas.nodes.map((n) => n.id)).toEqual(['g', 'a']);
  });
  it('empty-group', () => {
    expect(has(cf([g]), 'empty-group')).toBe(true);
    expect(has(cf([g, note('a', 50, 60)]), 'empty-group')).toBe(false);
  });
});

describe('edges', () => {
  it('handle geometry matches the webview: side midpoints and code-line anchors', () => {
    const a = note('a', 0, 0, 200, 100);
    const b = code('b', 500, 0);
    const m = new Map([a, b].map((n) => [n.id, n]));
    const g = edgeGeometry(edge('e', 'a', 'b', { toLine: 12 }), m)!;
    expect(g.s).toEqual({ x: 200, y: 50 });
    expect(g.t).toEqual({ x: 500, y: 0 + GEOMETRY.codeHeaderHeight + GEOMETRY.codeBodyPaddingTop + (12 - 10 + 0.5) * GEOMETRY.codeLineHeight });
    const g2 = edgeGeometry(edge('e', 'a', 'b', { fromSide: 'bottom', toSide: 'top' }), m)!;
    expect(g2.s).toEqual({ x: 100, y: 100 });
    expect(g2.t).toEqual({ x: 710, y: 0 });
    expect(g.pts[0]).toEqual(g.s);
    expect(g.pts[g.pts.length - 1].x).toBeCloseTo(g.t.x);
  });
  it('edge-through-node', () => {
    const nodes = [note('a', 0, 0), note('mid', 400, 0), note('b', 800, 0)];
    const d = get(cf(nodes, [edge('e', 'a', 'b')]), 'edge-through-node')!;
    expect(d.nodeIds).toEqual(['mid']);
    expect(d.edgeIds).toEqual(['e']);
    const clear = [note('a', 0, 0), note('mid', 400, 400), note('b', 800, 0)];
    expect(has(cf(clear, [edge('e', 'a', 'b')]), 'edge-through-node')).toBe(false);
  });
  it('edge-through-node excludes endpoints and groups', () => {
    const c = cf([group('g', 0, 0, 1200, 300), note('a', 50, 60), note('b', 800, 60)], [edge('e', 'a', 'b')]);
    expect(has(c, 'edge-through-node')).toBe(false);
  });
  it('edge-label-overlap: label over a node, and label over label', () => {
    const over = cf([note('a', 0, 0), note('b', 230, 0), note('c', 0, 400)], [edge('e', 'a', 'b', { label: 'a very long label here' })]);
    expect(has(over, 'edge-label-overlap')).toBe(true);
    const far = cf([note('a', 0, 0), note('b', 600, 0)], [edge('e', 'a', 'b', { label: 'short' })]);
    expect(has(far, 'edge-label-overlap')).toBe(false);
    const two = cf(
      [note('a', 0, 0), note('b', 600, 0), note('c', 0, 300), note('d', 600, 300)],
      [edge('e1', 'a', 'd', { label: 'one' }), edge('e2', 'c', 'b', { label: 'two' })],
    );
    expect(get(two, 'edge-label-overlap')!.edgeIds.sort()).toEqual(['e1', 'e2']);
  });
  it('edge-crossing counts crossings above the threshold, once', () => {
    // K(3,3)-ish ladder where every edge crosses: sources on left column top->bottom, targets reversed.
    const N = 6;
    const nodes: CanvasFileNode[] = [];
    const edges: CanvasFileEdge[] = [];
    for (let i = 0; i < N; i++) {
      nodes.push(note(`s${i}`, 0, i * 150, 100, 60), note(`t${i}`, 800, i * 150, 100, 60));
      edges.push(edge(`e${i}`, `s${i}`, `t${N - 1 - i}`));
    }
    const ds = lintCanvas(cf(nodes, edges)).filter((d) => d.rule === 'edge-crossing');
    expect(ds).toHaveLength(1);
    expect(ds[0].severity).toBe('info');
    expect(ds[0].edgeIds.length).toBe(N);
    expect(has(cf(nodes, edges), 'edge-crossing', { maxCrossings: 100 })).toBe(false);
    const parallel = edges.map((e, i) => edge(e.id, `s${i}`, `t${i}`));
    expect(has(cf(nodes, parallel), 'edge-crossing')).toBe(false);
  });
  it('edge-backwards', () => {
    const back = cf([note('a', 500, 0), note('b', 0, 0)], [edge('e', 'a', 'b')]);
    expect(get(back, 'edge-backwards')!.severity).toBe('info');
    expect(has(cf([note('a', 0, 0), note('b', 500, 0)], [edge('e', 'a', 'b')]), 'edge-backwards')).toBe(false);
    expect(has(cf([note('a', 500, 0), note('b', 0, 0)], [edge('e', 'a', 'b', { fromSide: 'left', toSide: 'right' })]), 'edge-backwards')).toBe(false);
  });
});

describe('text-overflow', () => {
  const long = 'word '.repeat(200);
  it('flags text taller than the node and fix grows the height', () => {
    const c = cf([note('a', 0, 0, 200, 60, { text: long })]);
    const d = get(c, 'text-overflow')!;
    expect(d.fix!.moves![0].height).toBeGreaterThan(60);
    const fixed = applyLintFix(c, d.fix!);
    expect(has(fixed, 'text-overflow')).toBe(false);
  });
  it('passes short text, skips mermaid', () => {
    expect(has(cf([note('a', 0, 0, 360, 220)]), 'text-overflow')).toBe(false);
    expect(has(cf([note('a', 0, 0, 100, 30, { text: long, variant: 'mermaid' })]), 'text-overflow')).toBe(false);
  });
  it('estimates by variant', () => {
    expect(estimateTextHeight({ text: 'hi', variant: 'sticky', width: 220 })).toBe(44);
    const heading = estimateTextHeight({ text: '# Title', variant: 'plain', width: 400 })!;
    const plain = estimateTextHeight({ text: 'Title', variant: 'plain', width: 400 })!;
    expect(heading).toBeGreaterThan(plain);
    expect(estimateTextHeight({ text: 'x', variant: 'mermaid', width: 1 })).toBeUndefined();
  });
  it('sticky overflow', () => {
    expect(has(cf([note('a', 0, 0, 100, 60, { variant: 'sticky', text: 'x '.repeat(100) })]), 'text-overflow')).toBe(true);
  });
});

describe('far-outlier', () => {
  const near = [note('a', 0, 0), note('b', 300, 0)];
  it('flags a node beyond outlierDistance and moves it next to its connected node', () => {
    const c = cf([...near, note('far', 6000, 0)], [edge('e', 'far', 'b')]);
    const d = get(c, 'far-outlier')!;
    expect(d.nodeIds).toEqual(['far']);
    const fixed = applyLintFix(c, d.fix!);
    expect(byId(fixed, 'far').x).toBe(300 + 200 + 80);
    expect(has(fixed, 'far-outlier')).toBe(false);
  });
  it('passes when close, honours outlierDistance', () => {
    expect(has(cf([...near, note('c', 900, 0)]), 'far-outlier')).toBe(false);
    expect(has(cf([...near, note('c', 900, 0)]), 'far-outlier', { outlierDistance: 100 })).toBe(true);
  });
  it('a distant pair is not an outlier', () => {
    expect(has(cf([...near, note('p', 6000, 0), note('q', 6300, 0)]), 'far-outlier')).toBe(false);
  });
});

describe('structural rules', () => {
  it('duplicate-id', () => {
    expect(has(cf([note('a', 0, 0), note('a', 500, 0)]), 'duplicate-id')).toBe(true);
    expect(has(cf([note('a', 0, 0), note('b', 500, 0)], [edge('a', 'a', 'b')]), 'duplicate-id')).toBe(true);
    expect(has(cf([note('a', 0, 0), note('b', 500, 0)]), 'duplicate-id')).toBe(false);
  });
  it('dangling-edge has a removeEdges fix', () => {
    const d = get(cf([note('a', 0, 0)], [edge('e', 'a', 'nope')]), 'dangling-edge')!;
    expect(d.severity).toBe('error');
    expect(d.fix!.removeEdges).toEqual(['e']);
    expect(has(cf([note('a', 0, 0), note('b', 500, 0)], [edge('e', 'a', 'b')]), 'dangling-edge')).toBe(false);
  });
  it('self-loop and duplicate-edge', () => {
    expect(has(cf([note('a', 0, 0)], [edge('e', 'a', 'a')]), 'self-loop')).toBe(true);
    const two = cf([note('a', 0, 0), note('b', 500, 0)], [edge('e1', 'a', 'b'), edge('e2', 'a', 'b')]);
    expect(get(two, 'duplicate-edge')!.fix!.removeEdges).toEqual(['e2']);
    const distinct = cf([note('a', 0, 0), note('b', 500, 0)], [edge('e1', 'a', 'b'), edge('e2', 'a', 'b', { toSide: 'top' })]);
    expect(has(distinct, 'duplicate-edge')).toBe(false);
  });
  it('invalid-anchor: outside displayed range, non-code node, and whole-file range from fileInfo', () => {
    const nodes = [code('c', 0, 0), code('d', 600, 0, { lines: undefined }), note('n', 0, 500)];
    expect(has(cf(nodes, [edge('e', 'c', 'd', { fromLine: 31 })]), 'invalid-anchor')).toBe(true);
    expect(has(cf(nodes, [edge('e', 'c', 'd', { fromLine: 10, toLine: 30 })]), 'invalid-anchor')).toBe(false);
    expect(has(cf(nodes, [edge('e', 'c', 'n', { toLine: 3 })]), 'invalid-anchor')).toBe(true);
    const info = () => ({ exists: true, totalLines: 50 });
    expect(has(cf(nodes, [edge('e', 'c', 'd', { toLine: 60 })]), 'invalid-anchor', { fileInfo: info })).toBe(true);
    expect(has(cf(nodes, [edge('e', 'c', 'd', { toLine: 45 })]), 'invalid-anchor', { fileInfo: info })).toBe(false);
    expect(has(cf(nodes, [edge('e', 'c', 'd', { toLine: 4000 })]), 'invalid-anchor')).toBe(false); // unknown length
  });
  it('highlight-out-of-range', () => {
    const bad = code('c', 0, 0, { highlights: [{ id: 'hl-1', start: 5, end: 12 }] });
    const good = code('c', 0, 0, { highlights: [{ id: 'hl-1', start: 12, end: 15 }] });
    expect(has(cf([bad]), 'highlight-out-of-range')).toBe(true);
    expect(has(cf([good]), 'highlight-out-of-range')).toBe(false);
  });
  it('missing-file needs fileInfo', () => {
    const c = cf([code('c', 0, 0)]);
    expect(has(c, 'missing-file')).toBe(false);
    expect(has(c, 'missing-file', { fileInfo: () => ({ exists: false }) })).toBe(true);
    expect(has(c, 'missing-file', { fileInfo: () => ({ exists: true, totalLines: 100 }) })).toBe(false);
    expect(has(c, 'missing-file', { fileInfo: () => undefined })).toBe(false);
  });
});

describe('fixCanvas', () => {
  const messy = (): CanvasFile => {
    const nodes: CanvasFileNode[] = [group('g', 0, 0, 700, 500)];
    for (let i = 0; i < 8; i++) nodes.push(note(`n${i}`, 80 + i * 20, 80 + i * 15, 200, 100));
    nodes.push(note('straddler', 620, 200, 200, 100)); // crosses the group's right border
    nodes.push(note('outlier', 9000, 9000, 200, 100));
    return cf(nodes, [edge('e', 'n0', 'outlier')]);
  };
  const layoutRules = new Set<LintRuleId>(['node-overlap', 'node-crowded', 'group-straddle', 'group-label-covered', 'far-outlier', 'text-overflow', 'group-order']);

  it('converges on a messy canvas and never moves the first node', () => {
    const input = messy();
    const snapshot = JSON.stringify(input);
    const { canvas, applied, remaining } = fixCanvas(input);
    expect(JSON.stringify(input)).toBe(snapshot); // input not mutated
    expect(remaining.filter((d) => layoutRules.has(d.rule))).toEqual([]);
    expect(applied.length).toBeGreaterThan(0);
    expect(byId(canvas, 'n0')).toMatchObject({ x: 80, y: 80 });
    expect(byId(canvas, 'g')).toMatchObject({ x: 0, y: 0, width: 700, height: 500 });
    for (const n of canvas.nodes) for (const k of ['x', 'y', 'width', 'height'] as const) expect(Number.isInteger(n[k])).toBe(true);
  });
  it('is deterministic and idempotent', () => {
    const a = fixCanvas(messy());
    const b = fixCanvas(messy());
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    const again = fixCanvas(a.canvas);
    expect(again.applied).toEqual([]);
    expect(JSON.stringify(again.canvas)).toBe(JSON.stringify(a.canvas));
  });
  it('keeps members inside their group when there is room', () => {
    const c = cf([group('g', 0, 0, 900, 700), note('a', 60, 100), note('b', 80, 120)]);
    const f = fixCanvas(c).canvas;
    const b = byId(f, 'b');
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.y).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width).toBeLessThanOrEqual(900);
    expect(b.y + b.height).toBeLessThanOrEqual(700);
    expect(byId(f, 'a')).toMatchObject({ x: 60, y: 100 });
  });
  it('only removes edges when destructive', () => {
    const c = cf([note('a', 0, 0), note('b', 500, 0)], [edge('e1', 'a', 'b'), edge('e2', 'a', 'b'), edge('e3', 'a', 'zzz'), edge('e4', 'a', 'a')]);
    const safe = fixCanvas(c);
    expect(safe.canvas.edges).toHaveLength(4);
    expect(safe.remaining.map((d) => d.rule)).toEqual(expect.arrayContaining(['dangling-edge', 'duplicate-edge', 'self-loop']));
    const destructive = fixCanvas(c, { destructive: true });
    expect(destructive.canvas.edges.map((e) => e.id)).toEqual(['e1']);
  });
  it('does not fix rules turned off', () => {
    const c = cf([note('a', 0, 0), note('b', 10, 10)]);
    const f = fixCanvas(c, { rules: { 'node-overlap': 'off', 'node-crowded': 'off' } });
    expect(byId(f.canvas, 'b')).toMatchObject({ x: 10, y: 10 });
  });
  it('a pile of 30 nodes resolves', () => {
    const nodes = Array.from({ length: 30 }, (_, i) => note(`n${i}`, (i % 3) * 30, (i % 4) * 20));
    const { canvas, remaining } = fixCanvas(cf(nodes));
    expect(remaining.filter((d) => d.rule === 'node-overlap' || d.rule === 'node-crowded')).toEqual([]);
    expect(byId(canvas, 'n0')).toMatchObject({ x: 0, y: 0 });
  });
});

describe('semantic variants', () => {
  it('does not flag long log cards as text-overflow', async () => {
    const { lintCanvas } = await import('./lint');
    const d = lintCanvas({
      nodes: [{ id: 'log-1', type: 'text', variant: 'log', text: Array(80).fill('at x (a.ts:1)').join('\n'), x: 0, y: 0, width: 520, height: 420 }],
      edges: [],
    });
    expect(d.filter((x) => x.rule === 'text-overflow')).toEqual([]);
  });
});
