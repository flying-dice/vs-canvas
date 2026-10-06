import { describe, expect, it } from 'vitest';
import type { CanvasFile, CanvasFileNode } from '../shared/canvasFile';
import { contains, intersects, rectOf } from '../shared/geometry';
import { LINT_DEFAULTS, lintCanvas } from '../shared/lint';
import { addNode, parseCanvas, placeNode, removeEdges, removeNodes, serializeCanvas } from './model';

const node = (id: string, x: number, y: number, w = 200, h = 100): CanvasFileNode =>
  ({ id, type: 'text', text: 'x', x, y, width: w, height: h }) as CanvasFileNode;
const group = (id: string, x: number, y: number, w: number, h: number): CanvasFileNode =>
  ({ id, type: 'group', label: 'G', x, y, width: w, height: h }) as CanvasFileNode;

describe('placeNode', () => {
  it('honours explicit x/y', () => {
    expect(placeNode({ nodes: [node('a', 0, 0)], edges: [] }, { x: 5, y: 7 }, 100, 100)).toEqual({ x: 5, y: 7 });
  });
  it('places beside near and keeps the min gap to other nodes', () => {
    const f: CanvasFile = { nodes: [node('a', 0, 0), node('b', 280, 0)], edges: [] };
    const p = placeNode(f, { near: 'a' }, 200, 100);
    const r = { x: p.x, y: p.y, w: 200, h: 100 };
    for (const n of f.nodes) {
      expect(intersects({ ...rectOf(n), x: n.x - LINT_DEFAULTS.minGap, y: n.y - LINT_DEFAULTS.minGap, w: n.width + 48, h: n.height + 48 }, r)).toBe(false);
    }
  });
  it('never straddles a group: outside when near is not a member', () => {
    const g = group('g', 300, 0, 500, 400);
    const f: CanvasFile = { nodes: [g, node('a', 0, 0)], edges: [] };
    const p = placeNode(f, { near: 'a' }, 200, 100); // 'right of a' = x 280 would cross the group border
    const r = { x: p.x, y: p.y, w: 200, h: 100 };
    expect(intersects(r, rectOf(g))).toBe(false);
  });
  it('stays inside the group when near is a member and there is room', () => {
    const g = group('g', 0, 0, 900, 600);
    const f: CanvasFile = { nodes: [g, node('a', 40, 80)], edges: [] };
    const p = placeNode(f, { near: 'a', side: 'right' }, 200, 100);
    expect(contains(rectOf(g), { x: p.x, y: p.y, w: 200, h: 100 })).toBe(true);
  });
  it('goes outside when the group is full', () => {
    const g = group('g', 0, 0, 300, 200);
    const f: CanvasFile = { nodes: [g, node('a', 40, 60, 220, 100)], edges: [] };
    const p = placeNode(f, { near: 'a', side: 'right' }, 200, 100);
    expect(intersects({ x: p.x, y: p.y, w: 200, h: 100 }, rectOf(g))).toBe(false);
  });
  it('a chain of addNode calls yields no layout warnings', () => {
    const f: CanvasFile = { nodes: [], edges: [] };
    addNode(f, { type: 'group', label: 'G', x: 0, y: 0, width: 700, height: 500 });
    let prev = addNode(f, { type: 'text', text: 'a', x: 60, y: 80, width: 200, height: 100 });
    for (let i = 0; i < 6; i++) prev = addNode(f, { type: 'text', text: 'n', width: 200, height: 100 }, { near: prev.id });
    const bad = lintCanvas(f).filter((d) => d.severity !== 'info' && d.rule !== 'empty-group');
    expect(bad).toEqual([]);
  });
});

describe('parse / serialize', () => {
  it('preserves $schema and puts it first', () => {
    const c = parseCanvas('{"$schema":"../schemas/canvas.schema.json","nodes":[],"edges":[]}');
    expect(c.$schema).toBe('../schemas/canvas.schema.json');
    expect(serializeCanvas(c).startsWith('{\n  "$schema"')).toBe(true);
  });
  it('does not add $schema', () => {
    expect(serializeCanvas({ nodes: [], edges: [] })).not.toContain('$schema');
  });
});

describe('semantic variants', () => {
  it('assigns id prefixes and default sizes', () => {
    const f: CanvasFile = { nodes: [], edges: [] };
    const fi = addNode(f, { type: 'text', variant: 'finding', text: 'x', title: 't', status: 'open' });
    const lg = addNode(f, { type: 'text', variant: 'log', text: Array(50).fill('l').join('\n') });
    const sv = addNode(f, { type: 'text', variant: 'service', text: 'd', title: 'Pay' });
    const po = addNode(f, { type: 'file', file: 'canvases/a.canvas.json' });
    expect([fi.id, lg.id, sv.id, po.id].map((i) => i.split('-')[0])).toEqual(['finding', 'log', 'service', 'portal']);
    expect([fi.width, fi.height]).toEqual([280, 150]);
    expect([lg.width, lg.height]).toEqual([520, 420]);
    expect([sv.width, sv.height]).toEqual([320, 200]);
    expect([po.width, po.height]).toEqual([360, 240]);
  });

  it('round-trips new fields in a stable key order', () => {
    const f: CanvasFile = {
      nodes: [{
        id: 'service-1', type: 'text', variant: 'service', x: 0, y: 0, width: 320, height: 200, text: 'd', title: 'Pay',
        canvas: 'c.canvas.json', tags: ['a'], entryPoints: [{ label: 'main', lines: [1, 5], file: 'a.ts' }],
      }],
      edges: [],
      vsCanvas: {
        version: 1, pinned: true, kind: 'map', title: 'T',
      },
    };
    const text = serializeCanvas(f);
    expect(parseCanvas(text)).toEqual(f);
    expect(text.indexOf('"title"')).toBeLessThan(text.indexOf('"canvas"'));
    expect(text.indexOf('"entryPoints"')).toBeLessThan(text.indexOf('"tags"'));
    expect(text).toMatch(/"kind": "map",\s+"pinned": true/);
    expect(text).toContain('"lines": [1, 5]');
  });
});

describe('legacy playable flows', () => {
  it('keeps a stray vsCanvas.flows through parse and serialize (only the lint fix removes it)', () => {
    const flows = [{ id: 'flow-1', title: 't', steps: [{ id: 's1', edge: 'e1' }] }];
    const text = JSON.stringify({ nodes: [], edges: [], vsCanvas: { version: 1, title: 'T', flows } });
    const f = parseCanvas(text);
    expect(f.vsCanvas).toEqual({ version: 1, title: 'T', flows });
    expect(JSON.parse(serializeCanvas(f)).vsCanvas.flows).toEqual(flows);
  });
});

describe('legacy metadata key', () => {
  it('reads canvasIde metadata written before the rebrand and saves it as vsCanvas', () => {
    const f = parseCanvas(JSON.stringify({ nodes: [], edges: [], canvasIde: { version: 1, title: 'Old' } }));
    expect(f.vsCanvas?.title).toBe('Old');
    const out = serializeCanvas(f);
    expect(out).toContain('"vsCanvas"');
    expect(out).not.toContain('canvasIde');
  });
});
