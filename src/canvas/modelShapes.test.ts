import { describe, expect, it } from 'vitest';
import type { CanvasFile } from '../shared/canvasFile';
import { addEdge, addNode, expandRelation, parseCanvas, serializeCanvas } from './model';

const empty = (): CanvasFile => ({ nodes: [], edges: [] });

describe('shape nodes', () => {
  it('use the shape id prefix and the shape default size', () => {
    const f = empty();
    const n = addNode(f, { type: 'text', variant: 'shape', shape: 'flowchart.decision', text: 'ok?' });
    expect(n.id).toBe('shape-1');
    expect([n.width, n.height]).toEqual([176, 112]);
  });
  it('frames keep the group id prefix and the frame size', () => {
    const f = empty();
    const g = addNode(f, { type: 'group', shape: 'c4.boundary', label: 'Shop' });
    expect(g.id).toBe('group-1');
    expect([g.width, g.height]).toEqual([640, 400]);
  });
  it('explicit sizes win; parse fills missing sizes from the shape', () => {
    const f = empty();
    expect(addNode(f, { type: 'text', variant: 'shape', shape: 'uml.class', text: 'A', width: 300, height: 90 }).width).toBe(300);
    const p = parseCanvas('{"nodes":[{"id":"s","type":"text","variant":"shape","shape":"erd.entity","text":"t"}],"edges":[]}');
    expect([p.nodes[0].width, p.nodes[0].height]).toEqual([240, 176]);
  });
  it('unknown shapes are kept with the generic size', () => {
    const f = empty();
    const n = addNode(f, { type: 'text', variant: 'shape', shape: 'nope.thing', text: 'x' });
    expect([n.width, n.height]).toEqual([176, 72]);
    expect(parseCanvas(serializeCanvas(f)).nodes[0]).toMatchObject({ shape: 'nope.thing' });
  });
  it('serialize keeps a stable key order for shape, fields and frames', () => {
    const f = empty();
    addNode(f, { type: 'group', label: 'L', sublabel: 'S', shape: 'c4.boundary', color: '6' });
    addNode(f, {
      type: 'text', variant: 'shape', text: 'API', fields: { technology: 'Go' }, shape: 'c4.container', color: '4',
    });
    const o = JSON.parse(serializeCanvas(f));
    expect(Object.keys(o.nodes[0])).toEqual(['id', 'type', 'x', 'y', 'width', 'height', 'color', 'label', 'sublabel', 'shape']);
    expect(Object.keys(o.nodes[1])).toEqual(['id', 'type', 'x', 'y', 'width', 'height', 'color', 'text', 'variant', 'shape', 'fields']);
    const c = empty();
    addNode(c, { type: 'text', variant: 'shape', shape: 'uml.class', text: 'A', fields: { methods: ['+ m()'], attributes: ['- a'] } });
    expect(Object.keys(JSON.parse(serializeCanvas(c)).nodes[0].fields)).toEqual(['attributes', 'methods']);
  });
});

describe('edge relations and markers', () => {
  const two = () => {
    const f = empty();
    const a = addNode(f, { type: 'text', text: 'a' });
    const b = addNode(f, { type: 'text', text: 'b' });
    return { f, a, b };
  };

  it('expands a relation preset into markers, line style and routing', () => {
    const { f, a, b } = two();
    const e = addEdge(f, { fromNode: a.id, toNode: b.id, relation: 'uml.realization' });
    expect(e).toMatchObject({ toMarker: 'triangle', lineStyle: 'dashed', routing: 'orthogonal', toEnd: 'arrow' });
    expect(e.fromMarker).toBeUndefined();
  });
  it('explicit fields win over the preset', () => {
    const { f, a, b } = two();
    const e = addEdge(f, { fromNode: a.id, toNode: b.id, relation: 'uml.realization', lineStyle: 'solid', toMarker: 'open-arrow', routing: 'straight' });
    expect(e).toMatchObject({ toMarker: 'open-arrow', lineStyle: 'solid', routing: 'straight' });
  });
  it('unknown relations are left alone', () => {
    expect(expandRelation({ fromNode: 'a', toNode: 'b', relation: 'x.y' })).toEqual({ fromNode: 'a', toNode: 'b', relation: 'x.y' });
  });
  it('writes JSON Canvas fromEnd/toEnd next to the markers', () => {
    const f = empty();
    const a = addNode(f, { type: 'text', text: 'a' });
    const b = addNode(f, { type: 'text', text: 'b' });
    addEdge(f, { fromNode: a.id, toNode: b.id, relation: 'erd.one-to-many' });
    addEdge(f, { fromNode: a.id, toNode: b.id, relation: 'uml.composition' });
    // a hand-written / webview-written edge with only markers is synced on serialize
    f.edges.push({ id: 'edge-9', fromNode: a.id, toNode: b.id, fromMarker: 'triangle', toMarker: 'none' });
    const out = JSON.parse(serializeCanvas(f));
    expect(out.edges[0]).toMatchObject({ fromEnd: 'none', toEnd: 'none', fromMarker: 'crow-one', toMarker: 'crow-many' });
    expect(out.edges[1]).toMatchObject({ fromEnd: 'none', toEnd: 'none', fromMarker: 'diamond-filled' });
    expect(out.edges[2]).toMatchObject({ fromEnd: 'arrow', toEnd: 'none' });
  });
  it('orders the new edge keys stably', () => {
    const { f, a, b } = two();
    addEdge(f, { fromNode: a.id, toNode: b.id, label: 'l', sublabel: 's', relation: 'c4.uses', fromSide: 'right', toSide: 'left' });
    expect(Object.keys(JSON.parse(serializeCanvas(f)).edges[0])).toEqual([
      'id', 'fromNode', 'fromSide', 'toNode', 'toSide', 'toEnd', 'label', 'sublabel', 'relation', 'toMarker', 'lineStyle', 'routing',
    ]);
  });
});
