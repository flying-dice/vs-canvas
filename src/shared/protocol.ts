// Message contract between the extension host and a canvas webview (one webview per open *.canvas.json).
// The canvas document itself uses the on-disk format in ./canvasFile. All line numbers are 1-based and inclusive.
import type { LintRuleId } from './lint';
import type { CanvasFile, CanvasFileEdge, CanvasFileNode, CanvasMeta } from './canvasFile';

export type * from './canvasFile';

/** Omit that distributes over unions, so each node kind keeps its own fields. */
export type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/** Source lines for a file node displayed as code, resolved by the extension (never persisted). */
export type ResolvedCode = {
  /** Absolute path, for openInEditor. */
  absPath: string;
  /** Shiki language id (webview falls back to 'text'). */
  language: string;
  firstLine: number;
  lines: string[];
  totalLines: number;
  /** True when the whole file was requested but capped. */
  truncated?: boolean;
  /** Set when the file could not be read (deleted/moved); the node renders an error state. */
  error?: string;
};

/**
 * Handle ids rendered by webview nodes:
 * - every node except groups, per side s in top/right/bottom/left: target `in-${s}` and source `out-${s}`
 *   (edges without a side use `in-left` / `out-right`)
 * - code file nodes, per anchored line n: target `in-L${n}` (left) and source `out-L${n}` (right)
 */
export const handleId = {
  in: (edge: Pick<CanvasFileEdge, 'toLine' | 'toSide'>) =>
    edge.toLine ? `in-L${edge.toLine}` : `in-${edge.toSide ?? 'left'}`,
  out: (edge: Pick<CanvasFileEdge, 'fromLine' | 'fromSide'>) =>
    edge.fromLine ? `out-L${edge.fromLine}` : `out-${edge.fromSide ?? 'right'}`,
};

/** Inverse of handleId, for edges drawn in the UI. */
export function parseHandle(h: string | null | undefined): { line?: number; side?: CanvasFileEdge['fromSide'] } {
  const m = h ? /^(?:in|out)-(?:L(\d+)|(top|right|bottom|left))$/.exec(h) : null;
  if (!m) return {};
  return m[1] ? { line: Number(m[1]) } : { side: m[2] as CanvasFileEdge['fromSide'] };
}

export type ToWebview =
  | {
      type: 'document';
      canvas: CanvasFile;
      /** Keyed by node id, for file nodes with display 'code', and the right-hand (after) file of 'diff' nodes. */
      code: Record<string, ResolvedCode>;
      /** Left-hand (before) file of display 'diff' nodes (`diffFrom`), keyed by node id. Whole file, same cap as code. */
      diffBase?: Record<string, ResolvedCode>;
      /** Workspace-relative path of this canvas file. */
      canvasPath: string;
      /**
       * Service entry-point snippets, keyed `${nodeId}#${index}` (index into entryPoints), for semantic zoom.
       * Resolved with a small window (at most 12 lines) around the entry point.
       */
      entryCode?: Record<string, ResolvedCode>;
      /** Portal previews, keyed by node id, for file nodes pointing at another *.canvas.json. */
      portals?: Record<string, PortalPreview>;
      /** Navigation trail when this canvas was opened from a portal/service drill-down (oldest first). */
      breadcrumbs?: { path: string; title: string }[];
    }
  | { type: 'info'; mcpUrl: string | null }
  /**
   * Bring nodes into view. Default (after edits): calm — no move if already visible. `zoom: true` (an explicit
   * "show me these", e.g. MCP canvas_focus with nodeIds): frame the targets at a readable zoom.
   */
  | { type: 'focus'; nodeIds?: string[]; zoom?: boolean }
  /** Result of a 'pickFile' request: the host has added the node (and edge); focus/select it. */
  | { type: 'select'; nodeIds: string[]; edit?: boolean };

/** Minimal render data for a canvas thumbnail. */
export type PortalPreview = {
  title: string;
  description?: string;
  kind?: CanvasMeta['kind'];
  nodeCount: number;
  /** Node rects in the target canvas's coordinates, for a mini-map style thumbnail. */
  rects: { x: number; y: number; width: number; height: number; color?: string; type: string }[];
  error?: string;
};

/** Where a newly created node should connect from (drag-out-and-drop on empty canvas). */
export type ConnectFrom = { nodeId: string; line?: number; side?: CanvasFileEdge['fromSide']; handleType: 'source' | 'target' };

export type FromWebview =
  | { type: 'ready' }
  /**
   * Position/size changes, batched. reason 'user' = drag/resize (normal dirty edit);
   * 'measure' = rendered size of an auto-sized node (code, file chip) differs from the document, so the
   * linter and placement see real sizes (the host saves these silently when the document was clean).
   */
  | {
      type: 'nodesChanged';
      reason: 'user' | 'measure';
      changes: { id: string; x: number; y: number; width?: number; height?: number }[];
    }
  /** Create a node from the UI (e.g. toolbar / double-click); the extension assigns the id. */
  | { type: 'addNode'; node: DistributiveOmit<CanvasFileNode, 'id'> }
  /** Partial update from inline editing (e.g. sticky text). */
  | { type: 'updateNode'; id: string; patch: Partial<CanvasFileNode> }
  | { type: 'removeNodes'; ids: string[] }
  | { type: 'removeEdges'; ids: string[] }
  | { type: 'connect'; edge: Omit<CanvasFileEdge, 'id'> }
  | { type: 'openFile'; path: string; line?: number }
  | { type: 'openUrl'; url: string }
  /** Partial edge update (label edit, colour, ends, animated) from the edge toolbar. */
  | { type: 'updateEdge'; id: string; patch: Partial<Omit<CanvasFileEdge, 'id'>> }
  /**
   * Add a node and connect it in one undoable edit (drag an arrow out, drop on empty canvas, pick from the
   * quick-add menu). The host assigns ids, then replies with 'select' (edit: true for text kinds).
   */
  | { type: 'addConnected'; node: DistributiveOmit<CanvasFileNode, 'id'>; from: ConnectFrom }
  /** Ask the host to show a workspace file picker and add the file as a code node at `at` (optionally connected). */
  | { type: 'pickFile'; at: { x: number; y: number }; from?: ConnectFrom }
  /** Open another canvas (portal / service drill-down / breadcrumb). */
  | { type: 'openCanvas'; path: string; focusNodeIds?: string[] }
  /** Node toolbar: add callers/callees of the symbol at `line` of a code node, laid out next to it. */
  | { type: 'trace'; nodeId: string; line: number; direction: 'incoming' | 'outgoing' }
  /** Node toolbar: grow/shrink the displayed range of a code node. */
  | { type: 'expandRange'; nodeId: string; before: number; after: number }
  /** Apply lint fixes (all layout issues, those for the given node ids, or only fixes of the given rules). */
  | { type: 'fixLayout'; nodeIds?: string[]; rules?: LintRuleId[] }
  /** Persist the pinned flag of this canvas. */
  | { type: 'setPinned'; pinned: boolean };
