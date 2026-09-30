import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CanvasFile } from '../shared/canvasFile';
import { lintCanvas } from '../shared/lint';

vi.mock('vscode', () => ({}));
vi.mock('../canvas/lintSupport', () => ({
  lintSettings: () => ({ rules: {} }),
  lintOptionsFor: async () => ({}),
  bySeverity: () => 0,
  compact: (d: unknown) => d,
}));
vi.mock('../code/files', () => ({ loadFile: vi.fn(), openDoc: vi.fn(), workspaceRelPath: (p: string) => p }));
vi.mock('../code/intel', () => ({ callHierarchy: vi.fn(), definition: vi.fn(), listSymbols: vi.fn(), WARMUP_NOTE: '' }));
vi.mock('../code/trace', () => ({ planTrace: vi.fn() }));

import { registerTools } from './tools';

type Handler = (args: Record<string, unknown>) => Promise<{ isError?: boolean; content: { text: string }[] }>;

let state: CanvasFile;
const handlers = new Map<string, Handler>();
const server = { registerTool: (n: string, _c: unknown, h: Handler) => void handlers.set(n, h), registerPrompt: () => undefined };
const docs = {
  target: async () => 'x.canvas.json',
  read: async () => structuredClone(state),
  edit: async (_u: string, fn: (f: CanvasFile) => unknown) => fn(state),
  relPath: (u: string) => u,
};
const editor = { reveal: async () => undefined, focus: () => undefined };

async function call(name: string, args: Record<string, unknown>) {
  const r = await handlers.get(name)!(args);
  const text = r.content[0].text;
  return { error: r.isError ? text : undefined, out: r.isError ? {} : (JSON.parse(text) as Record<string, any>) };
}

beforeEach(() => {
  state = { nodes: [], edges: [] };
  handlers.clear();
  registerTools(server as never, docs as never, editor as never);
});

describe('canvas_list_shapes', () => {
  it('lists everything or one library', async () => {
    const all = (await call('canvas_list_shapes', {})).out;
    expect(all.libraries).toHaveLength(6);
    const c4 = (await call('canvas_list_shapes', { library: 'c4' })).out;
    expect(c4.shapes.every((s: { id: string }) => s.id.startsWith('c4.'))).toBe(true);
    expect(c4.shapes.find((s: { id: string }) => s.id === 'c4.boundary').frame).toBe(true);
    expect(c4.relations.map((r: { id: string }) => r.id)).toEqual(['c4.uses']);
  });
});

describe('canvas_add_shape', () => {
  it('adds a shape, validates fields and helps with unknown ids', async () => {
    const r = await call('canvas_add_shape', { shape: 'c4.container', text: 'API', fields: { technology: 'Go' } });
    expect(r.out.nodeId).toBe('shape-1');
    expect(state.nodes[0]).toMatchObject({ variant: 'shape', shape: 'c4.container', fields: { technology: 'Go' } });
    expect((await call('canvas_add_shape', { shape: 'c4.contianer' })).error).toContain('Valid c4 shapes');
    expect((await call('canvas_add_shape', { shape: 'c4.container', fields: { tech: 'x' } })).error).toContain('Fields: technology');
    expect((await call('canvas_add_shape', { shape: 'c4.boundary', attachTo: 'shape-1' })).error).toContain('Frames cannot');
  });
  it('frame shapes create a fitted group; attachTo applies the library default relation', async () => {
    await call('canvas_add_shape', { shape: 'c4.container', text: 'API' });
    const b = await call('canvas_add_shape', { shape: 'c4.container-db', text: 'DB', attachTo: 'shape-1', edgeLabel: 'Reads' });
    expect(state.edges[0]).toMatchObject({ relation: 'c4.uses', toMarker: 'arrow', lineStyle: 'dashed', label: 'Reads' });
    expect(b.out.edgeId).toBe('edge-3');
    const f = await call('canvas_add_shape', { shape: 'c4.boundary', text: 'Shop', sublabel: 'Software System', nodeIds: ['shape-1', 'shape-2'] });
    const g = state.nodes.find((n) => n.id === f.out.nodeId)!;
    expect(g).toMatchObject({ type: 'group', shape: 'c4.boundary', label: 'Shop', sublabel: 'Software System' });
    expect(state.nodes[0].id).toBe(g.id); // groups first
  });
});

describe('canvas_connect', () => {
  it('applies relation presets, explicit overrides and the default relation', async () => {
    await call('canvas_add_shape', { shape: 'uml.class', text: 'Dog' });
    await call('canvas_add_shape', { shape: 'uml.class', text: 'Animal', x: 400, y: 0 });
    await call('canvas_connect', { source: 'shape-1', target: 'shape-2', relation: 'uml.inheritance' });
    await call('canvas_connect', { source: 'shape-1', target: 'shape-2', toMarker: 'diamond', lineStyle: 'dotted', routing: 'straight', sublabel: 's' });
    expect(state.edges[0]).toMatchObject({ relation: 'uml.inheritance', toMarker: 'triangle', toEnd: 'arrow', routing: 'orthogonal', fromSide: 'right', toSide: 'left' });
    expect(state.edges[1]).toMatchObject({ relation: 'uml.association', toMarker: 'diamond', toEnd: 'none', lineStyle: 'dotted', routing: 'straight', sublabel: 's' });
  });
  it('leaves plain nodes on plain edges', async () => {
    await call('canvas_add_note', { markdown: 'a' });
    await call('canvas_add_note', { markdown: 'b' });
    await call('canvas_connect', { source: 'note-1', target: 'note-2' });
    expect(state.edges[0].relation).toBeUndefined();
  });
});

describe('canvas_add_diff', () => {
  it('adds a diff node with diffFrom, and lint rejects line anchors to it', async () => {
    const r = await call('canvas_add_diff', { left: 'fx/order.0.json', right: 'fx/order.1.json', title: 'placeOrder' });
    expect(r.out.nodeId).toBe('diff-1');
    expect(state.nodes[0]).toMatchObject({ type: 'file', display: 'diff', file: 'fx/order.1.json', diffFrom: 'fx/order.0.json', width: 560, height: 420 });
    await call('canvas_add_note', { markdown: 'n' });
    expect((await call('canvas_highlight_lines', { nodeId: 'diff-1', ranges: [{ start: 1, end: 2 }] })).error).toContain('not a code view');
  });
});

describe('canvas_add_diagram', () => {
  const c4 = {
    library: 'c4', title: 'Shop', frame: true, frameSublabel: 'Software System',
    nodes: [
      { key: 'user', shape: 'c4.person', text: 'Customer' },
      { key: 'web', shape: 'c4.container-web', text: 'Web app\nSingle page storefront', fields: { technology: 'React' } },
      { key: 'api', shape: 'c4.container', text: 'API', fields: { technology: 'Node.js' } },
      { key: 'db', shape: 'c4.container-db', text: 'Database', fields: { technology: 'PostgreSQL' } },
    ],
    edges: [
      { from: 'user', to: 'web', label: 'Browses' },
      { from: 'web', to: 'api', label: 'Calls', sublabel: 'JSON/HTTPS' },
      { from: 'api', to: 'db', label: 'Reads from [SQL]' },
    ],
  };

  it('builds a framed C4 view in one call with a clean layout', async () => {
    await call('canvas_add_note', { markdown: 'existing' });
    const r = await call('canvas_add_diagram', c4);
    expect(r.error).toBeUndefined();
    expect(Object.keys(r.out.nodes)).toEqual(['user', 'web', 'api', 'db']);
    expect(r.out.edges).toHaveLength(3);
    const frame = state.nodes.find((n) => n.id === r.out.frame)!;
    expect(frame).toMatchObject({ type: 'group', shape: 'c4.boundary', label: 'Shop', sublabel: 'Software System' });
    expect(state.edges.every((e) => e.relation === 'c4.uses' && e.toMarker === 'arrow')).toBe(true);
    const at = (k: string) => state.nodes.find((n) => n.id === r.out.nodes[k])!;
    expect(at('web').x).toBeGreaterThan(at('user').x + at('user').width);
    expect(at('user').x).toBeGreaterThan(frame.x);
    expect(lintCanvas(state).filter((d) => d.severity !== 'info')).toEqual([]);
  });
  it('flowcharts go top to bottom with yes/no labels', async () => {
    const r = await call('canvas_add_diagram', {
      library: 'flowchart', title: 'Checkout',
      nodes: [
        { key: 's', shape: 'flowchart.terminator', text: 'Start' },
        { key: 'v', shape: 'flowchart.decision', text: 'Is the cart valid?' },
        { key: 'p', shape: 'flowchart.process', text: 'Charge card' },
        { key: 'e', shape: 'flowchart.terminator', text: 'End' },
      ],
      edges: [{ from: 's', to: 'v' }, { from: 'v', to: 'p', label: 'Yes' }, { from: 'v', to: 'e', label: 'No' }, { from: 'p', to: 'e' }],
    });
    expect(r.out.direction).toBe('TB');
    const at = (k: string) => state.nodes.find((n) => n.id === r.out.nodes[k])!;
    expect(at('v').y).toBeGreaterThan(at('s').y);
    expect(state.edges[0]).toMatchObject({ relation: 'flow.next', fromSide: 'bottom', toSide: 'top', routing: 'orthogonal' });
    expect(state.nodes.some((n) => n.type === 'text' && n.variant === 'plain' && n.text === '# Checkout')).toBe(true);
    expect(lintCanvas(state).filter((d) => d.severity !== 'info')).toEqual([]);
  });
  it('erd/uml with fields grow to fit their lines', async () => {
    const r = await call('canvas_add_diagram', {
      library: 'erd', layout: 'grid',
      nodes: [
        { key: 'u', shape: 'erd.entity', text: 'users', fields: { columns: ['id uuid PK', 'email text', 'name text', 'created_at timestamptz', 'plan text', 'status text', 'locale text'] } },
        { key: 'o', shape: 'erd.entity', text: 'orders', fields: { columns: ['id uuid PK', 'user_id uuid FK'] } },
      ],
      edges: [{ from: 'u', to: 'o', label: 'places', relation: 'erd.one-to-many' }],
    });
    const u = state.nodes.find((n) => n.id === r.out.nodes.u)!;
    expect(u.height).toBeGreaterThanOrEqual(32 + 7 * 20);
    expect(state.edges[0]).toMatchObject({ fromMarker: 'crow-one', toMarker: 'crow-many', fromEnd: 'none', toEnd: 'none' });
    expect(lintCanvas(state).filter((d) => d.severity !== 'info')).toEqual([]);
  });
  it('gives helpful errors', async () => {
    const base = { library: 'c4', nodes: [{ key: 'a', shape: 'c4.container', text: 'A' }] };
    expect((await call('canvas_add_diagram', { ...base, nodes: [{ key: 'a', shape: 'uml.class', text: 'A' }] })).error).toContain('not in the c4 library');
    expect((await call('canvas_add_diagram', { ...base, nodes: [{ key: 'a', shape: 'c4.boundary', text: 'A' }] })).error).toContain('frame');
    expect((await call('canvas_add_diagram', { ...base, edges: [{ from: 'a', to: 'zz' }] })).error).toContain('Keys: a');
    expect((await call('canvas_add_diagram', { ...base, nodes: [base.nodes[0], base.nodes[0]] })).error).toContain('Duplicate');
    expect((await call('canvas_add_diagram', { library: 'flowchart', frame: true, nodes: [{ key: 'a', shape: 'flowchart.process', text: 'A' }] })).error).toContain('no frame');
    expect(state.nodes).toEqual([]); // nothing half-built
  });
});

describe('canvas_update_node with shapes', () => {
  it('updates shape, fields and frame sublabel; rejects bad ones', async () => {
    await call('canvas_add_shape', { shape: 'uml.class', text: 'A' });
    await call('canvas_update_node', { nodeId: 'shape-1', fields: { attributes: ['- a'] }, text: 'B' });
    expect(state.nodes[0]).toMatchObject({ text: 'B', fields: { attributes: ['- a'] } });
    expect((await call('canvas_update_node', { nodeId: 'shape-1', shape: 'uml.interface' })).error).toContain('do not exist');
    await call('canvas_update_node', { nodeId: 'shape-1', shape: 'uml.interface', fields: { methods: ['+ run()'] } });
    expect(state.nodes[0]).toMatchObject({ shape: 'uml.interface' });
    await call('canvas_add_shape', { shape: 'uml.package', text: 'p', x: 900, y: 0 });
    await call('canvas_update_node', { nodeId: 'group-2', sublabel: 'core', shape: 'arch.region' });
    expect(state.nodes.find((n) => n.type === 'group')).toMatchObject({ sublabel: 'core', shape: 'arch.region' });
    await call('canvas_add_note', { markdown: 'n' });
    expect((await call('canvas_update_node', { nodeId: 'note-3', shape: 'c4.person' })).error).toContain('not applicable');
  });
});
