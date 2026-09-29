import type { CanvasFile, FromWebview, ResolvedCode, ToWebview } from '../../../src/shared/protocol';
import { showcaseDocument } from './showcase';
import { shapesDocument } from './shapesDemo';
import { createMockHost, type MockHost } from './mockHost';

type VsApi = { postMessage(msg: unknown): void; getState(): unknown; setState(s: unknown): void };
declare function acquireVsCodeApi(): VsApi;

let api: VsApi | null = null;
try {
  api = typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : null;
} catch {
  api = null;
}

export const inVSCode = api !== null;

/** Per-webview persisted UI state (VS Code webview state API; sessionStorage when running standalone). */
export function getState<T extends Record<string, unknown>>(): Partial<T> {
  try {
    if (api) return (api.getState() as Partial<T> | undefined) ?? {};
    return JSON.parse(sessionStorage.getItem('vs-canvas-state') ?? '{}');
  } catch {
    return {};
  }
}

export function setState(patch: Record<string, unknown>): void {
  try {
    const next = { ...getState(), ...patch };
    if (api) api.setState(next);
    else sessionStorage.setItem('vs-canvas-state', JSON.stringify(next));
  } catch {
    /* state is a convenience */
  }
}

const demoLines = [
  'export function handle(req: Request) {',
  '  const user = authenticate(req);',
  '  if (!user) {',
  '    return unauthorized();',
  '  }',
  '  return respond(user);',
  '}',
];

const demoCanvas: CanvasFile = {
  nodes: [
    { id: 'grp', type: 'group', label: 'Request path', x: -40, y: -70, width: 1120, height: 380, color: '5' },
    {
      id: 'code', type: 'file', file: 'src/server.ts', display: 'code', lines: [10, 16], x: 0, y: 0, width: 520, height: 170,
      title: 'Entry point',
      highlights: [
        { id: 'h1', start: 11, end: 11, color: '3', label: 'auth' },
        { id: 'h2', start: 13, end: 13, color: '1', label: 'reject' },
      ],
    },
    {
      id: 'note', type: 'text', variant: 'note', title: 'Auth flow', color: '6', x: 700, y: -20, width: 360, height: 260,
      text: '## Notes\n\n- Calls `authenticate`\n- Returns 401 otherwise\n\n```mermaid\nsequenceDiagram\n  Client->>Server: request\n  Server-->>Client: 401 / 200\n```',
    },
    { id: 'sticky', type: 'text', variant: 'sticky', text: 'TODO: rate limit this endpoint', color: '2', x: 0, y: 380, width: 220, height: 180 },
    { id: 'title', type: 'text', variant: 'plain', text: '# Server walkthrough', x: 0, y: -170, width: 500, height: 70 },
    { id: 'ref', type: 'file', file: 'src/auth/index.ts', display: 'reference', lines: [1, 40], title: 'authenticate()', color: '4', x: 300, y: 420, width: 260, height: 60 },
    { id: 'link', type: 'link', url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/401', title: 'HTTP 401', color: '1', x: 640, y: 400, width: 340, height: 90 },
    {
      id: 'mmd', type: 'text', variant: 'mermaid', title: 'Pipeline', x: 1200, y: -40, width: 480, height: 340,
      text: 'flowchart LR\n  A[Request] --> B{Auth?}\n  B -- yes --> C[Handler]\n  B -- no --> D[401]',
    },
    { id: 'bad', type: 'file', file: 'src/removed.ts', display: 'code', x: 1200, y: 380, width: 420, height: 90 },
  ],
  edges: [
    { id: 'e1', fromNode: 'code', fromLine: 11, toNode: 'note', toSide: 'left', label: 'explains', color: '6', animated: true },
    { id: 'e2', fromNode: 'code', fromLine: 15, toNode: 'ref', toSide: 'top', color: '4' },
    { id: 'e3', fromNode: 'sticky', fromSide: 'right', toNode: 'ref', toSide: 'left', toEnd: 'none' },
    { id: 'e4', fromNode: 'note', fromSide: 'bottom', toNode: 'link', toSide: 'top', fromEnd: 'arrow', color: '1' },
    { id: 'e5', fromNode: 'note', fromSide: 'right', toNode: 'mmd', toSide: 'left' },
  ],
};

const demoCode: Record<string, ResolvedCode> = {
  code: { absPath: '/demo/src/server.ts', language: 'typescript', firstLine: 10, lines: demoLines, totalLines: 120 },
  bad: {
    absPath: '/demo/src/removed.ts', language: 'typescript', firstLine: 1, lines: [], totalLines: 0,
    error: 'File not found: src/removed.ts',
  },
};

/** Standalone demos (`vite dev`): edits are applied to the demo document by a tiny in-browser host. */
let mock: MockHost | null = null;

export function post(msg: FromWebview): void {
  if (api) api.postMessage(msg);
  else if (mock) mock.handle(msg);
  else console.debug('[vs-canvas] post', msg);
}

export function onMessage(handler: (m: ToWebview) => void): () => void {
  const listener = (e: MessageEvent) => {
    if (e.data && typeof e.data === 'object' && typeof e.data.type === 'string') handler(e.data as ToWebview);
  };
  window.addEventListener('message', listener);
  if (!api && new URLSearchParams(location.search).get('demo') === 'agent') {
    // Scripted "agent session": one edit per step, each followed by a focus, like the MCP host does.
    const stop = runAgentDemo(handler);
    return () => {
      stop();
      window.removeEventListener('message', listener);
    };
  }
  const demo = new URLSearchParams(location.search).get('demo');
  if (!api && (demo === 'showcase' || demo === 'shapes')) {
    // showcase: every node kind on one board; shapes: one diagram per shape library. For visual QA.
    const t = setTimeout(() => {
      const doc = demo === 'shapes' ? shapesDocument() : showcaseDocument();
      mock = createMockHost(doc, handler);
      handler({ type: 'info', mcpUrl: 'http://127.0.0.1:0/mcp' });
      handler(doc);
    }, 50);
    return () => {
      clearTimeout(t);
      mock?.dispose();
      mock = null;
      window.removeEventListener('message', listener);
    };
  }
  if (!api) {
    // Standalone (vite dev): feed a demo document once the app has subscribed.
    setTimeout(() => {
      const doc = { type: 'document' as const, canvas: demoCanvas, code: demoCode, canvasPath: 'demo/architecture.canvas.json' };
      mock = createMockHost(doc, handler);
      handler({ type: 'info', mcpUrl: 'http://127.0.0.1:0/mcp' });
      handler(doc);
    }, 50);
  }
  return () => window.removeEventListener('message', listener);
}

// ---- Scripted agent session (`?demo=agent`) ----

const agentLinesA = demoLines;
const agentLinesB = [
  'export function authenticate(req: Request) {',
  "  const token = req.headers.get('authorization');",
  '  if (!token) return null;',
  '  return verify(token);',
  '}',
];

function runAgentDemo(handler: (m: ToWebview) => void): () => void {
  const codeA: ResolvedCode = { absPath: '/demo/src/server.ts', language: 'typescript', firstLine: 10, lines: agentLinesA, totalLines: 120 };
  const codeB: ResolvedCode = { absPath: '/demo/src/auth.ts', language: 'typescript', firstLine: 1, lines: agentLinesB, totalLines: 40 };
  const code = { a: codeA, b: codeB };
  const nodeA = (highlights: LineHighlightLite[] = []): CanvasFile['nodes'][number] => ({
    id: 'a', type: 'file', file: 'src/server.ts', display: 'code', lines: [10, 16], x: 0, y: 0, width: 520, height: 170,
    title: 'Entry point', highlights,
  });
  const nodeB: CanvasFile['nodes'][number] = {
    id: 'b', type: 'file', file: 'src/auth.ts', display: 'code', lines: [1, 5], x: 760, y: 40, width: 480, height: 130, title: 'authenticate()',
  };
  const note: CanvasFile['nodes'][number] = {
    id: 'n', type: 'text', variant: 'note', title: 'Flow', color: '6', x: 0, y: 300, width: 360, height: 200,
    text: '## Flow\n\n- `handle` authenticates\n- 401 on failure',
  };
  const stickyAt = (x: number, y: number): CanvasFile['nodes'][number] => ({
    id: 's', type: 'text', variant: 'sticky', text: 'TODO: rate limit', color: '2', x, y, width: 220, height: 180,
  });
  const h1: LineHighlightLite = { id: 'h1', start: 11, end: 11, color: '3', label: 'auth' };
  const h2: LineHighlightLite = { id: 'h2', start: 13, end: 13, color: '1', label: 'reject' };
  const edge: CanvasFile['edges'][number] = { id: 'e1', fromNode: 'a', fromLine: 11, toNode: 'b', toSide: 'left', label: 'calls', color: '4' };
  const edge2: CanvasFile['edges'][number] = { id: 'e2', fromNode: 'n', fromSide: 'top', toNode: 'a', toSide: 'bottom', animated: true };

  const steps: { canvas: CanvasFile; focus?: string[] }[] = [
    { canvas: { nodes: [], edges: [] } },
    { canvas: { nodes: [nodeA()], edges: [] }, focus: ['a'] },
    { canvas: { nodes: [nodeA([h1])], edges: [] }, focus: ['a'] },
    { canvas: { nodes: [nodeA([h1, h2]), nodeB], edges: [] }, focus: ['b'] },
    { canvas: { nodes: [nodeA([h1, h2]), nodeB], edges: [edge] }, focus: ['a', 'b'] },
    { canvas: { nodes: [nodeA([h1, h2]), nodeB, note], edges: [edge] }, focus: ['n'] },
    { canvas: { nodes: [nodeA([h1, h2]), nodeB, note, stickyAt(780, 60)], edges: [edge, edge2] }, focus: ['s'] },
    { canvas: { nodes: [nodeA([h1, h2]), nodeB, note, stickyAt(780, 260)], edges: [edge, edge2] }, focus: ['s'] },
    { canvas: { nodes: [nodeA([h1, h2]), nodeB, note], edges: [edge] }, focus: ['a', 'b', 'n'] },
  ];

  let i = 0;
  const timers: ReturnType<typeof setTimeout>[] = [];
  const tick = () => {
    const s = steps[i++];
    if (!s) return;
    handler({ type: 'document', canvas: s.canvas, code, canvasPath: 'demo/agent-session.canvas.json' });
    if (s.focus) handler({ type: 'focus', nodeIds: s.focus });
    timers.push(setTimeout(tick, 700));
  };
  timers.push(
    setTimeout(() => {
      handler({ type: 'info', mcpUrl: 'http://127.0.0.1:0/mcp' });
      tick();
    }, 400),
  );
  return () => timers.forEach(clearTimeout);
}

type LineHighlightLite = { id: string; start: number; end: number; color?: string; label?: string };
