import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod';
import type { CanvasDocuments } from '../canvas/documents';
import type { CanvasEditorProvider } from '../canvas/editor';
import { applyMoves, fixOnly, layoutNodes } from '../canvas/layout';
import {
  GROUP_LABEL, GROUP_PAD, addEdge, addHighlights, addNode, checkLine, codeSize, defaultSize, displayedRange, fitGroup, groupMembers, isCanvasPath, isCodeNode,
  nodeDefaultSize, placeNode, removeEdges, rerouteEdges, removeHighlights, removeNodes, requireNode, syncSubpath, type NodeSpec,
} from '../canvas/model';
import { applyTrace } from '../canvas/trace';
import { registerPrompts } from './prompts';
import { bySeverity, compact, lintOptionsFor, lintSettings } from '../canvas/lintSupport';
import { loadFile, openDoc, workspaceRelPath } from '../code/files';
import { callHierarchy, definition, listSymbols, WARMUP_NOTE } from '../code/intel';
import { planTrace } from '../code/trace';
import {
  COLOR_PRESETS, SEMANTIC_COLORS, type Side, type CanvasFile, type CanvasFileNode, type CanvasMeta, type EntryPoint, type FlowStep,
} from '../shared/canvasFile';
import { estimateShapeHeight, estimateTextHeight, fixCanvas, lintCanvas, type LintDiagnostic } from '../shared/lint';
import type { CanvasFileEdge, EdgeMarker } from '../shared/canvasFile';
import {
  EDGE_MARKERS, LIBRARIES, RELATIONS, SHAPES, defaultFrameOf, defaultRelation, libraryById, relationById, shapeById, shapesIn,
  type LibraryId, type ShapeDef,
} from '../shared/shapes';

// Friendly names, 'blue' (alias of cyan) and the semantic vocabulary all map to the JSON Canvas presets.
const COLOR_MAP = { ...COLOR_PRESETS, blue: COLOR_PRESETS.cyan, ...SEMANTIC_COLORS } as const;
type ColorArg = keyof typeof COLOR_MAP;
const COLOR_NAMES = Object.keys(COLOR_MAP) as [ColorArg, ...ColorArg[]];
const PRESET_NAMES = Object.fromEntries(Object.entries(COLOR_PRESETS).map(([k, v]) => [v, k])) as Record<string, string>;
const color = z.enum(COLOR_NAMES).describe(
  'Friendly (red, orange, yellow, green, cyan/blue, purple) or semantic: failure=red, investigating=orange, attention=yellow, confirmed=green, flow=cyan, domain=purple.',
);
const toPreset = (c?: ColorArg) => (c ? COLOR_MAP[c] : undefined);
const fromPreset = (c?: string) => (c ? PRESET_NAMES[c] ?? c : undefined);

const line = (d: string) => z.number().int().min(1).describe(d);
const canvasArg = {
  canvas: z.string().optional().describe(
    'Workspace-relative path of a *.canvas.json file (see canvas_list). Defaults to the active canvas (the one most recently focused or used); a scratch canvas is created if none exists.',
  ),
};
const focusArg = { focus: z.boolean().optional().describe('Pan/zoom the canvas to the new/changed nodes (default true).') };
const placement = {
  x: z.number().optional().describe('Explicit canvas X. Overrides automatic placement (give both x and y).'),
  y: z.number().optional().describe('Explicit canvas Y.'),
  near: z.string().optional().describe('Node id to place the new node next to.'),
  side: z.enum(['right', 'below', 'left', 'above']).optional().describe("Side of `near` to place on (default 'right')."),
};
const attach = {
  attachTo: z.string().optional().describe('Node id to connect from: creates an edge attachTo(attachLine) -> the new node. Placement defaults to next to attachTo.'),
  attachLine: line('Line in attachTo (a code node) the edge anchors from; must be a displayed file line.').optional(),
  edgeLabel: z.string().optional().describe('Label for the edge created by attachTo.'),
};

const statusArg = z.enum(['open', 'investigating', 'confirmed', 'ruled-out']);
const findingKindArg = z.enum(['hypothesis', 'evidence', 'question', 'conclusion']);
const entryPointArg = z.object({
  file: z.string().describe('File path, absolute or workspace-relative.'),
  startLine: line('First line of the entry point.').optional(),
  endLine: line('Last line (inclusive).').optional(),
  label: z.string().describe('Short name, e.g. "POST /orders" or "ChargeService.charge".'),
});
/** Status -> default colour preset for finding cards (open and ruled-out stay uncoloured; the UI greys ruled-out). */
const STATUS_COLOR: Record<string, string | undefined> = { investigating: SEMANTIC_COLORS.investigating, confirmed: SEMANTIC_COLORS.confirmed };

type EntryPointArg = { file: string; startLine?: number; endLine?: number; label: string };
function toEntryPoints(eps: EntryPointArg[]): EntryPoint[] {
  return eps.map((e) => {
    if (e.endLine !== undefined && e.startLine !== undefined && e.endLine < e.startLine) {
      throw new Error(`Entry point "${e.label}": endLine ${e.endLine} is before startLine ${e.startLine}.`);
    }
    const start = e.startLine ?? (e.endLine !== undefined ? 1 : undefined);
    return {
      file: workspaceRelPath(e.file),
      ...(start !== undefined && { lines: [start, e.endLine ?? start] as [number, number] }),
      label: e.label,
    };
  });
}

type Placed = { x?: number; y?: number; near?: string; side?: 'right' | 'below' | 'left' | 'above' };
type Attach = { attachTo?: string; attachLine?: number; edgeLabel?: string };
type Totals = Map<string, number>;
type Outcome = Record<string, unknown> & { focusIds?: string[] };

const stripFence = (s: string) => s.trim().replace(/^```\s*mermaid\s*\n/i, '').replace(/\n?```\s*$/, '');
const trunc = (s: string, n = 160) => (s.length > n ? s.slice(0, n) + '…' : s);
const noteSize = (text: string, title?: string) => {
  const width = 360;
  const need = estimateTextHeight({ text, title, variant: 'note', width }) ?? 0;
  return { width, height: Math.min(900, Math.max(220, Math.ceil(need / 10) * 10 + 10)) };
};


// ---------- shapes ----------

const LIBRARY_IDS = LIBRARIES.map((l) => l.id) as [LibraryId, ...LibraryId[]];
const RELATION_IDS = RELATIONS.map((r) => r.id) as [string, ...string[]];
const markerArg = z.enum(EDGE_MARKERS as [EdgeMarker, ...EdgeMarker[]]);
const fieldsArg = z.record(z.string(), z.union([z.string(), z.array(z.string())])).describe(
  'Structured shape data, keys per shape (see canvas_list_shapes): text fields are strings (e.g. technology: "Node.js"), list fields are arrays of lines (e.g. attributes: ["- id: string"], columns: ["id uuid PK"]).',
);
const shapesOf = (lib?: string) => SHAPES.filter((s) => !lib || s.library === lib).map((s) => s.id).join(', ');

function requireShape(id: string, what: 'any' | 'frame' | 'solid' = 'any'): ShapeDef {
  const def = shapeById(id);
  if (!def) {
    const lib = id.split('.')[0];
    throw new Error(`Unknown shape "${id}". ${libraryById(lib) ? `Valid ${lib} shapes: ${shapesOf(lib)}.` : `Libraries: ${LIBRARY_IDS.join(', ')}; shape ids look like "c4.container". Use canvas_list_shapes.`}`);
  }
  if (what === 'frame' && !def.frame) throw new Error(`Shape "${id}" is not a frame. Frame shapes: ${SHAPES.filter((s) => s.frame).map((s) => s.id).join(', ')}.`);
  if (what === 'solid' && def.frame) throw new Error(`Shape "${id}" is a frame (it wraps other nodes): pass nodeIds to fit it around them, or use the diagram's \`frame\` option.`);
  return def;
}

const requireRelation = (id: string) => {
  const r = relationById(id);
  if (!r) throw new Error(`Unknown relation "${id}". Valid relations: ${RELATION_IDS.join(', ')}.`);
  return r;
};

/** Validate `fields` against the shape's field spec and normalise: lists become string[], text fields a single string. */
function normalizeFields(def: ShapeDef, fields: Record<string, string | string[]> | undefined): Record<string, string | string[]> | undefined {
  if (!fields) return undefined;
  const spec = new Map((def.fields ?? []).map((f) => [f.key, f]));
  const out: Record<string, string | string[]> = {};
  for (const [k, v] of Object.entries(fields)) {
    const f = spec.get(k);
    if (!f) {
      throw new Error(`Shape ${def.id} has no field "${k}". ${spec.size ? `Fields: ${[...spec.values()].map((x) => `${x.key} (${x.kind === 'lines' ? 'list of lines' : 'text'})`).join(', ')}.` : 'It has no fields; put the description in text.'}`);
    }
    if (f.kind === 'lines') out[k] = (Array.isArray(v) ? v : v.split('\n')).map((x) => x.trimEnd()).filter((x) => x !== '');
    else out[k] = Array.isArray(v) ? v.join(', ') : v;
  }
  return Object.keys(out).length ? out : undefined;
}

const shapeOfNode = (n: CanvasFileNode): string | undefined => (n.type === 'text' && n.variant === 'shape' ? n.shape : undefined);
const isShapeNode = (n: CanvasFileNode) => n.type === 'text' && n.variant === 'shape';

/** Sides to connect two nodes with: along the layout direction when the target lies clear beyond the source, else by the dominant axis. */
function sidesFor(a: CanvasFileNode, b: CanvasFileNode, dir?: 'LR' | 'TB'): { fromSide: Side; toSide: Side } {
  const right = { fromSide: 'right' as const, toSide: 'left' as const };
  const left = { fromSide: 'left' as const, toSide: 'right' as const };
  const down = { fromSide: 'bottom' as const, toSide: 'top' as const };
  const up = { fromSide: 'top' as const, toSide: 'bottom' as const };
  if (dir === 'LR' && b.x >= a.x + a.width) return right;
  if (dir === 'TB' && b.y >= a.y + a.height) return down;
  const dx = b.x + b.width / 2 - (a.x + a.width / 2);
  const dy = b.y + b.height / 2 - (a.y + a.height / 2);
  return Math.abs(dx) * 0.6 >= Math.abs(dy) ? (dx >= 0 ? right : left) : (dy >= 0 ? down : up);
}

type EdgeStyleArgs = {
  relation?: string; fromMarker?: EdgeMarker; toMarker?: EdgeMarker; lineStyle?: 'solid' | 'dashed' | 'dotted';
  routing?: 'bezier' | 'orthogonal' | 'straight'; sublabel?: string;
};
/**
 * Relation and style fields of a new edge: the given relation, else the library default when both ends are shapes of one
 * library; explicit markers/lineStyle/routing win over the preset (addEdge expands it). Also picks sides between two shapes.
 */
function styleEdge(
  a: CanvasFileNode, b: CanvasFileNode, o: EdgeStyleArgs, dir?: 'LR' | 'TB',
): Partial<Omit<CanvasFileEdge, 'id' | 'fromNode' | 'toNode'>> {
  if (o.relation) requireRelation(o.relation);
  const relation = o.relation ?? defaultRelation(shapeOfNode(a), shapeOfNode(b))?.id;
  return {
    ...(relation && { relation }),
    ...(o.fromMarker && { fromMarker: o.fromMarker }),
    ...(o.toMarker && { toMarker: o.toMarker }),
    ...(o.lineStyle && { lineStyle: o.lineStyle }),
    ...(o.routing && { routing: o.routing }),
    ...(o.sublabel && { sublabel: o.sublabel }),
    ...(isShapeNode(a) && isShapeNode(b) && sidesFor(a, b, dir)),
  };
}

/** Height a shape node needs for its text/fields (never below the requested one). */
const fitShapeHeight = (spec: { text: string; fields?: Record<string, string | string[]>; shape: string; width: number; height: number }) =>
  Math.max(spec.height, Math.ceil((estimateShapeHeight(spec) ?? 0) / 8) * 8);

/** One-line teaching for the tool descriptions. */
const DIAGRAM_TIPS =
  'Good diagrams: name every box (short noun phrases), label every edge with a verb phrase, keep one level of abstraction per diagram, and aim for 4-12 nodes. ' +
  'C4 (context/container views): c4.person -> c4.system / c4.container* with a `technology` field on containers (e.g. "Node.js, Express", "PostgreSQL"); relation c4.uses with a label describing the intent ("Reads orders") and a sublabel for the protocol ("SQL/TCP", "JSON/HTTPS"); external systems use c4.system-external; wrap in the c4.boundary frame titled with the system. ' +
  'Flowchart: exactly one flowchart.terminator "Start" and one or more "End", flowchart.decision phrased as a question with edges labelled "Yes"/"No", flowchart.process for steps, flowchart.io for data in/out. ' +
  'UML class: uml.class text = the class name, fields.attributes = ["- id: string", "+ total: number"], fields.methods = ["+ charge(amount): Receipt"], edges uml.inheritance (child -> parent), uml.composition (owner -> part), uml.dependency. ' +
  'ERD: erd.entity text = table name, fields.columns = ["id uuid PK", "user_id uuid FK", "email text"], edges erd.one-to-many from the parent (the "one" side) to the child. ' +
  'Architecture: arch.service / arch.database / arch.queue with technology fields, arch.calls, arch.publishes (async), arch.reads. For a sequence diagram use canvas_add_mermaid instead.';

const LINT_NOTE =
  ' Results may include a `lint` list about the layout you just made (overlapping nodes, nodes crossing group borders, clipped text, broken anchors): resolve those warnings, e.g. call canvas_lint with fix:true or move nodes with canvas_update_node.';
const MUTATING = new Set([
  'canvas_open_file', 'canvas_add_file_reference', 'canvas_add_note', 'canvas_add_sticky', 'canvas_add_text',
  'canvas_add_mermaid', 'canvas_add_link', 'canvas_add_group', 'canvas_update_node', 'canvas_highlight_lines', 'canvas_connect',
  'canvas_add_finding', 'canvas_add_log', 'canvas_add_service', 'canvas_add_portal', 'canvas_trace', 'canvas_layout',
  'canvas_add_shape', 'canvas_add_diagram',
]);
const MAX_LINT = 5;

const WORKFLOW =
  'Canvases are persistent *.canvas.json files in the workspace (JSON Canvas 1.0 plus extensions) that get committed to git; every tool saves its change immediately. ' +
  'Recommended workflow to explain control flow: (1) canvas_create (or canvas_open an existing one); (2) canvas_open_file for the entry point with a startLine/endLine range; ' +
  '(3) canvas_highlight_lines on the key lines, with short labels; (4) canvas_open_file the callees with near=<caller node> so they line up beside it; ' +
  '(5) canvas_connect line-anchored edges (sourceLine = call site, targetLine = callee definition) in call order, with labels like "1. validates input"; ' +
  '(6) canvas_add_note / canvas_add_sticky (with attachTo + attachLine) to explain; (7) canvas_add_group around related nodes; ' +
  '(8) canvas_add_mermaid for an overview diagram. Use code_symbols / code_call_hierarchy / code_definition to find accurate line ranges and call sites. ' +
  'To explore callers/callees quickly, use canvas_trace: it builds a whole call tree (nodes, anchored edges, layout) in one call.';

const COLOR_VOCAB =
  'Colour vocabulary (use it consistently): red/failure = failure path and root cause; orange/investigating = under investigation; yellow/attention = key line or thing to look at; ' +
  'green/confirmed = confirmed or healthy; cyan(blue)/flow = data in motion; purple/domain = domain boundary (groups around related services).';

const PLAYBOOKS =
  'PLAYBOOKS. (1) Map a repo: canvas_create kind "map" pinned:true; canvas_add_service per domain (entryPoints with real files/lines, tags), group related services with canvas_add_group color "domain" (purple), ' +
  'canvas_connect the services (label what flows between them), canvas_add_portal / service.canvas to drill down into deeper canvases (one canvas per domain), then canvas_pin. ' +
  '(2) Investigate a bug: canvas_create kind "investigation"; canvas_add_log with the stack trace (errorLines = the failing frame lines); canvas_open_file the failing frames and canvas_trace around them; ' +
  'canvas_add_finding for each hypothesis/evidence with status (open, investigating, confirmed, ruled-out) and update statuses as you learn; highlight the root-cause line in red ("failure") with a label. ' +
  '(3) Explain a data flow: canvas_create kind "flow"; canvas_open_file each hop (or canvas_trace), canvas_connect call sites with line-anchored edges, canvas_add_flow with a `data` payload per step ' +
  '(e.g. "Order{ id: 812, total: 49.00 }"), then canvas_play_flow. ' + COLOR_VOCAB;

export function registerTools(server: McpServer, docs: CanvasDocuments, editor: CanvasEditorProvider) {
  const ok = (result: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] });
  const fail = (e: unknown) => ({
    isError: true,
    content: [{ type: 'text' as const, text: e instanceof Error ? e.message : String(e) }],
  });
  const tool = <S extends z.ZodRawShape>(
    name: string,
    title: string,
    description: string,
    inputSchema: S,
    fn: (args: z.infer<z.ZodObject<S>>) => unknown | Promise<unknown>,
  ) => {
    server.registerTool(name, { title, description: MUTATING.has(name) ? description + LINT_NOTE : description, inputSchema }, (async (args: z.infer<z.ZodObject<S>>) => {
      try {
        return ok(await fn(args));
      } catch (e) {
        return fail(e);
      }
    }) as never);
  };

  /** Total line counts of files shown as code without an explicit range (needed to validate line numbers). */
  const lineTotals = async (file: CanvasFile): Promise<Totals> => {
    const totals: Totals = new Map();
    await Promise.all(
      file.nodes.map(async (n) => {
        if (n.type !== 'file' || totals.has(n.file)) return;
        try { totals.set(n.file, (await openDoc(n.file)).lineCount); } catch { /* unreadable: skip range checks */ }
      }),
    );
    return totals;
  };
  const totalOf = (t: Totals, n: CanvasFileNode) => (n.type === 'file' ? t.get(n.file) : undefined);

  /** Ids of nodes/edges that are new or different in `after`. */
  const changedIds = (before: CanvasFile, after: CanvasFile) => {
    const snap = (items: { id: string }[]) => new Map(items.map((i) => [i.id, JSON.stringify(i)]));
    const diff = (a: { id: string }[], b: { id: string }[]) => {
      const old = snap(a);
      return b.filter((i) => old.get(i.id) !== JSON.stringify(i)).map((i) => i.id);
    };
    return { nodes: new Set(diff(before.nodes, after.nodes)), edges: new Set(diff(before.edges, after.edges)) };
  };

  /** Lint findings that involve what a call created or changed, compact and capped. */
  const lintFor = async (before: CanvasFile, after: CanvasFile) => {
    const ch = changedIds(before, after);
    if (!ch.nodes.size && !ch.edges.size) return {};
    const found = lintCanvas(after, await lintOptionsFor(after))
      .filter((d: LintDiagnostic) => d.nodeIds.some((i) => ch.nodes.has(i)) || d.edgeIds.some((i) => ch.edges.has(i)))
      .sort(bySeverity);
    if (!found.length) return {};
    return {
      lint: found.slice(0, MAX_LINT).map(compact),
      ...(found.length > MAX_LINT && { lintMore: found.length - MAX_LINT }),
    };
  };

  /** Resolve the canvas, apply a saved mutation, reveal the editor and focus the result. */
  const mutate = async (
    a: { canvas?: string; focus?: boolean },
    fn: (f: CanvasFile, totals: Totals) => Outcome,
  ) => {
    const uri = await docs.target(a.canvas);
    const before = await docs.read(uri);
    const totals = await lineTotals(before);
    const { focusIds, ...out } = await docs.edit(uri, (f) => fn(f, totals), { save: true });
    await editor.reveal(uri);
    if (a.focus !== false && focusIds?.length) editor.focus(uri, focusIds);
    let lint = {};
    try {
      lint = await lintFor(before, await docs.read(uri));
    } catch { /* lint is advisory; never fail the edit */ }
    return { canvas: docs.relPath(uri), ...out, ...lint };
  };

  const addWithAttach = (
    f: CanvasFile, totals: Totals, spec: NodeSpec, a: Placed & Attach,
    edgeStyle?: (from: CanvasFileNode, to: CanvasFileNode) => Partial<Omit<CanvasFileEdge, 'id' | 'fromNode' | 'toNode'>>,
  ): Outcome => {
    let from: CanvasFileNode | undefined;
    if (a.attachTo) {
      from = requireNode(f, a.attachTo);
      if (a.attachLine !== undefined) checkLine(from, a.attachLine, totalOf(totals, from), 'attachLine');
    } else if (a.attachLine !== undefined || a.edgeLabel) {
      throw new Error('attachLine and edgeLabel require attachTo.');
    }
    const node = addNode(f, spec, { x: a.x, y: a.y, near: a.near ?? a.attachTo, side: a.side });
    const edge = from
      ? addEdge(f, { fromNode: from.id, fromLine: a.attachLine, toNode: node.id, label: a.edgeLabel, ...edgeStyle?.(from, node) })
      : undefined;
    return { nodeId: node.id, ...(edge && { edgeId: edge.id }), focusIds: [node.id] };
  };

  const rangeArgs = (startLine?: number, endLine?: number, total?: number): [number, number] | undefined => {
    if (startLine === undefined && endLine === undefined) return undefined;
    const s = startLine ?? 1;
    const e = endLine ?? total ?? s;
    if (e < s) throw new Error(`endLine ${e} is before startLine ${s}.`);
    if (total !== undefined && s > total) throw new Error(`startLine ${s} is beyond the end of the file (${total} lines).`);
    return [s, total !== undefined ? Math.min(e, total) : e];
  };

  // ---------- canvas management ----------

  tool(
    'canvas_list',
    'List canvases',
    'List the *.canvas.json canvases in the workspace with path, title, description, node/edge counts and which one is active (the default target of every canvas tool).',
    {},
    async () => {
      const active = await docs.activeUri();
      const canvases = await Promise.all(
        (await docs.list()).map(async (uri) => {
          const path = docs.relPath(uri);
          try {
            const f = await docs.read(uri);
            return {
              path, title: f.vsCanvas?.title, description: f.vsCanvas?.description, kind: f.vsCanvas?.kind, pinned: f.vsCanvas?.pinned,
              flows: f.vsCanvas?.flows?.map((x) => ({ id: x.id, title: x.title, steps: x.steps.length })),
              nodes: f.nodes.length, edges: f.edges.length, active: uri.toString() === active?.toString(),
            };
          } catch (e) {
            return { path, error: e instanceof Error ? e.message : String(e), active: false };
          }
        }),
      );
      return { canvases, directory: docs.directory };
    },
  );

  tool(
    'canvas_create',
    'Create canvas',
    'Create a new empty canvas file `<canvasDirectory>/<slug>.canvas.json` (default directory "canvases"), open it beside the editor and make it the active canvas. Errors if it already exists. ' +
      'kind ("map" | "investigation" | "flow" | "notes") sets the sidebar icon and intent; pinned:true lists it first in the Canvases sidebar and makes it open with Canvas: Open Pinned Map. ' +
      WORKFLOW + ' ' + PLAYBOOKS,
    {
      name: z.string().min(1).describe('Name; slugified into the file name, e.g. "Auth flow" -> canvases/auth-flow.canvas.json.'),
      title: z.string().optional().describe('Display title (defaults to name).'),
      description: z.string().optional().describe('One or two sentences on what this canvas explains.'),
      kind: z.enum(['map', 'investigation', 'flow', 'notes']).optional().describe('What the board is for: map (repo/domain overview), investigation (bug hunt), flow (data/control flow), notes.'),
      pinned: z.boolean().optional().describe('Pin it (sidebar "Pinned" section, Canvas: Open Pinned Map). Typically true for the repo map.'),
    },
    async (a) => {
      const uri = await docs.create(a.name, a.title, a.description, a.kind, a.pinned);
      docs.setActive(uri, true);
      await editor.reveal(uri);
      return { canvas: docs.relPath(uri), active: true, kind: a.kind, pinned: !!a.pinned };
    },
  );

  tool(
    'canvas_open',
    'Open canvas',
    'Open an existing canvas beside the editor and make it the active canvas for subsequent tool calls.',
    { canvas: z.string().describe('Workspace-relative path of a *.canvas.json file (see canvas_list).') },
    async (a) => {
      const uri = await docs.target(a.canvas);
      await editor.reveal(uri);
      return { canvas: docs.relPath(uri), active: true };
    },
  );

  // ---------- adding content ----------

  tool(
    'canvas_open_file',
    'Add code view',
    'Add a source file (or a line range of it) to the canvas as a live code view: the code is read from the workspace when drawn, never stored in the canvas file. ' +
      'Line numbers are 1-based and inclusive. Without startLine/endLine the whole file is shown, capped at 400 lines; pass a range for big files. Paths are absolute or workspace-relative (must be inside the workspace). ' +
      'Placement is automatic unless x/y or near/side is given (near=<node id> puts it beside that node). ' + WORKFLOW + ' ' + PLAYBOOKS,
    {
      ...canvasArg,
      path: z.string().describe('File path, absolute or workspace-relative.'),
      startLine: line('First line to show.').optional(),
      endLine: line('Last line to show (inclusive).').optional(),
      title: z.string().optional().describe('Optional header title (defaults to the file path).'),
      ...placement,
      ...focusArg,
    },
    async (a) => {
      const file = workspaceRelPath(a.path);
      const f = await loadFile(a.path, a.startLine, a.endLine);
      const ranged = a.startLine !== undefined || a.endLine !== undefined;
      const longest = f.lines.reduce((m, l) => Math.max(m, l.length), 0);
      const size = codeSize(f.lines.length, longest);
      return mutate(a, (cf) => {
        const node = addNode(cf, {
          type: 'file', file, display: 'code', ...(ranged && { lines: [f.firstLine, f.lastLine] as [number, number] }),
          title: a.title, width: size.w, height: size.h,
        }, { x: a.x, y: a.y, near: a.near, side: a.side });
        return {
          nodeId: node.id, file, firstLine: f.firstLine, lastLine: f.lastLine, totalLines: f.totalLines,
          truncated: f.truncated, focusIds: [node.id],
        };
      });
    },
  );

  tool(
    'canvas_add_file_reference',
    'Add file reference',
    'Add a compact chip that names a file (and optional line range) and opens it in the editor when clicked. Use it for files that are related but not worth showing as code. To show the code, use canvas_open_file.',
    {
      ...canvasArg,
      path: z.string().describe('File path, absolute or workspace-relative.'),
      startLine: line('First line of the referenced range.').optional(),
      endLine: line('Last line of the referenced range (inclusive).').optional(),
      title: z.string().optional().describe('Label (defaults to the path).'),
      ...placement,
      ...attach,
      ...focusArg,
    },
    async (a) => {
      const file = workspaceRelPath(a.path);
      const total = (await openDoc(a.path)).lineCount;
      const lines = rangeArgs(a.startLine, a.endLine, total);
      return mutate(a, (cf, totals) =>
        addWithAttach(cf, totals, { type: 'file', file, display: 'reference', ...(lines && { lines }), title: a.title }, a));
    },
  );

  tool(
    'canvas_add_note',
    'Add markdown note',
    'Add a markdown note card to explain something (intent, control flow, caveats). Markdown is rendered; ```mermaid fenced blocks inside the note render as inline diagrams. ' +
      'To annotate a specific line, set attachTo (a code node id) and attachLine (file line): an arrow is drawn from that line to the note and the note is placed beside the node by default.',
    {
      ...canvasArg,
      markdown: z.string().describe('Markdown body.'),
      title: z.string().optional(),
      color: color.optional().describe('Accent color.'),
      ...placement,
      ...attach,
      ...focusArg,
    },
    (a) =>
      mutate(a, (cf, totals) =>
        addWithAttach(cf, totals, {
          type: 'text', variant: 'note', text: a.markdown, title: a.title, color: toPreset(a.color), ...noteSize(a.markdown, a.title),
        }, a)),
  );

  tool(
    'canvas_add_sticky',
    'Add sticky note',
    'Add a small colored sticky note for a short remark ("TODO", "why this is slow", "entry point"). Keep the text to a sentence or two; use canvas_add_note for longer explanations.',
    {
      ...canvasArg,
      text: z.string().describe('Short text.'),
      color: color.optional().describe('Default yellow.'),
      ...placement,
      ...attach,
      ...focusArg,
    },
    (a) =>
      mutate(a, (cf, totals) =>
        addWithAttach(cf, totals, { type: 'text', variant: 'sticky', text: a.text, color: COLOR_MAP[a.color ?? 'yellow'] }, a)),
  );

  tool(
    'canvas_add_text',
    'Add free text',
    'Add plain text drawn directly on the canvas with no card, for titles and labels. Markdown works, e.g. "# Request lifecycle". Use x/y or near/side to position it (for example above a group or node).',
    {
      ...canvasArg,
      text: z.string().describe('Markdown text, e.g. "# Title".'),
      ...placement,
      ...focusArg,
    },
    (a) =>
      mutate(a, (cf) => {
        const node = addNode(cf, { type: 'text', variant: 'plain', text: a.text }, { x: a.x, y: a.y, near: a.near, side: a.side });
        return { nodeId: node.id, focusIds: [node.id] };
      }),
  );

  tool(
    'canvas_add_mermaid',
    'Add mermaid diagram',
    'Add a Mermaid diagram card rendered on the canvas. Pass the Mermaid source WITHOUT ``` fences. Supported diagram types: flowchart (graph TD/LR), sequenceDiagram, classDiagram, stateDiagram-v2, erDiagram. ' +
      'Good for an overview of a flow next to the detailed code views. Invalid syntax renders as an error card, so keep it simple.',
    {
      ...canvasArg,
      source: z.string().describe('Mermaid source without code fences, e.g. "flowchart LR\\n  A --> B".'),
      title: z.string().optional(),
      ...placement,
      ...attach,
      ...focusArg,
    },
    (a) =>
      mutate(a, (cf, totals) =>
        addWithAttach(cf, totals, { type: 'text', variant: 'mermaid', text: stripFence(a.source), title: a.title }, a)),
  );

  tool(
    'canvas_add_link',
    'Add link',
    'Add a link card for an external http(s) URL (docs, issue, PR, spec). Clicking it opens the browser.',
    {
      ...canvasArg,
      url: z.string().describe('http:// or https:// URL.'),
      title: z.string().optional().describe('Label (defaults to the URL).'),
      ...placement,
      ...attach,
      ...focusArg,
    },
    (a) => {
      if (!/^https?:\/\/\S+$/i.test(a.url)) throw new Error('url must be an http(s) URL.');
      return mutate(a, (cf, totals) => addWithAttach(cf, totals, { type: 'link', url: a.url, title: a.title }, a));
    },
  );

  tool(
    'canvas_add_group',
    'Add group',
    'Add a labeled group frame that visually contains related nodes. Pass nodeIds to fit the group around those nodes (with padding and room for the label), or give x/y/width/height for an empty frame. ' +
      'Add groups after their members exist. Groups are drawn behind their members.',
    {
      ...canvasArg,
      label: z.string().optional(),
      color: color.optional(),
      nodeIds: z.array(z.string()).optional().describe('Nodes to fit the group around.'),
      x: z.number().optional(), y: z.number().optional(),
      width: z.number().positive().optional(), height: z.number().positive().optional(),
      ...focusArg,
    },
    (a) =>
      mutate(a, (cf) => {
        const fit = a.nodeIds?.length ? fitGroup(cf, a.nodeIds) : undefined;
        const d = defaultSize('group');
        const node = addNode(cf, {
          type: 'group', label: a.label, color: toPreset(a.color),
          x: a.x ?? fit?.x, y: a.y ?? fit?.y, width: a.width ?? fit?.width ?? d.w, height: a.height ?? fit?.height ?? d.h,
        });
        return { nodeId: node.id, focusIds: [node.id] };
      }),
  );

  // ---------- shapes & diagrams ----------

  tool(
    'canvas_list_shapes',
    'List diagram shapes',
    'List the diagram shape libraries (flowchart, uml, c4, erd, arch, bpmn), their shapes (id, name, description, fields, frame) and the relationship presets (id, name, description) usable with canvas_add_shape, canvas_add_diagram and canvas_connect. ' +
      'Pass `library` to list just one. Shape ids look like "c4.container"; relation ids like "uml.inheritance".',
    { library: z.enum(LIBRARY_IDS).optional().describe('Only this library.') },
    (a) => ({
      libraries: LIBRARIES.filter((l) => !a.library || l.id === a.library).map(({ id, name, description }) => ({ id, name, description })),
      shapes: SHAPES.filter((x) => !a.library || x.library === a.library).map((x) => ({
        id: x.id, name: x.name, description: x.description,
        ...(x.fields && { fields: x.fields.map((f) => (f.kind === 'lines' ? `${f.key}[]` : f.key)) }),
        ...(x.frame && { frame: true }),
      })),
      relations: RELATIONS.filter((r) => !a.library || r.library === a.library || (a.library === 'flowchart' && r.id === 'flow.next'))
        .map(({ id, name, description }) => ({ id, name, description })),
      note: 'fields: "key" is a text field (string), "key[]" a list of lines (array of strings). Frame shapes wrap other nodes.',
    }),
  );

  tool(
    'canvas_add_shape',
    'Add diagram shape',
    'Add one diagram shape from a library (see canvas_list_shapes), e.g. "flowchart.decision", "uml.class", "c4.container", "erd.entity", "arch.database", "bpmn.task". `text` is the label (the name); for c4/arch "top" shapes extra lines after the first are the description. ' +
      '`fields` holds the shape\'s structured data (technology, attributes[], methods[], columns[]...). Frame shapes (c4.boundary, uml.package, arch.region, bpmn.pool) create a group frame: `text` = its label, `sublabel` = its type line ("Software System"), nodeIds = the nodes to fit it around (add frames after their members exist). ' +
      'Use attachTo to connect from an existing node: between two shapes of the same library the library\'s default relation is applied. To build a whole diagram at once, prefer canvas_add_diagram.',
    {
      ...canvasArg,
      shape: z.string().describe('Shape id, e.g. "c4.container". See canvas_list_shapes.'),
      text: z.string().optional().describe('Label / name of the shape.'),
      sublabel: z.string().optional().describe('Frame shapes only: secondary label line, e.g. "Container".'),
      fields: fieldsArg.optional(),
      color: color.optional(),
      width: z.number().positive().optional().describe("Default: the shape's size."),
      height: z.number().positive().optional(),
      nodeIds: z.array(z.string()).optional().describe('Frame shapes only: nodes to fit the frame around.'),
      ...placement,
      ...attach,
      ...focusArg,
    },
    (a) =>
      mutate(a, (cf, totals) => {
        const def = requireShape(a.shape);
        const fields = normalizeFields(def, a.fields);
        if (def.frame) {
          if (fields) throw new Error(`Frame shape ${def.id} has no fields.`);
          if (a.attachTo || a.attachLine !== undefined || a.edgeLabel) throw new Error('Frames cannot be connected with attachTo; connect the shapes inside them.');
          const fit = a.nodeIds?.length ? fitGroup(cf, a.nodeIds) : undefined;
          const node = addNode(cf, {
            type: 'group', shape: def.id, label: a.text, sublabel: a.sublabel, color: toPreset(a.color),
            x: a.x ?? fit?.x, y: a.y ?? fit?.y,
            width: a.width ?? fit?.width ?? def.size[0], height: a.height ?? fit?.height ?? def.size[1],
          }, fit ? undefined : { x: a.x, y: a.y, near: a.near, side: a.side });
          return { nodeId: node.id, shape: def.id, focusIds: [node.id] };
        }
        if (a.nodeIds?.length) throw new Error('nodeIds only applies to frame shapes.');
        if (a.sublabel) throw new Error('sublabel only applies to frame shapes.');
        const width = a.width ?? def.size[0];
        const text = a.text ?? '';
        const height = fitShapeHeight({ text, fields, shape: def.id, width, height: a.height ?? def.size[1] });
        return addWithAttach(cf, totals, {
          type: 'text', variant: 'shape', shape: def.id, text, ...(fields && { fields }), color: toPreset(a.color), width, height,
        }, a, (from, to) => styleEdge(from, to, {}));
      }),
  );

  const diagramNode = z.object({
    key: z.string().min(1).describe('Your short unique handle for this node, used by edges (e.g. "api", "db", "start").'),
    shape: z.string().describe('Shape id from the diagram library, e.g. "c4.container".'),
    text: z.string().describe('Label / name. c4/arch top-layout shapes: extra lines after the first are the description.'),
    fields: fieldsArg.optional(),
    color: color.optional(),
    width: z.number().positive().optional(),
    height: z.number().positive().optional(),
  });
  const diagramEdge = z.object({
    from: z.string().describe('Source node key.'),
    to: z.string().describe('Target node key.'),
    label: z.string().optional().describe('What flows or the intent, e.g. "Reads from [SQL]", "Yes".'),
    sublabel: z.string().optional().describe('Secondary line, e.g. the protocol/technology "JSON/HTTPS" (c4).'),
    relation: z.enum(RELATION_IDS).optional().describe("Relation preset; default: the library's (c4.uses, flow.next, uml.association, erd.one-to-many, arch.calls, bpmn.sequence)."),
    color: color.optional(),
  });

  tool(
    'canvas_add_diagram',
    'Add a whole diagram',
    'Build a complete diagram of one shape library in ONE call: creates the shape nodes (sized to fit their text), lays them out (layered by edge direction, or a grid), adds the edges with relation presets (markers, dashes, routing), optionally wraps everything in the library frame, and lint-fixes the result. ' +
      'Returns the key -> node id map and the edge ids. Libraries: flowchart, uml, c4, erd, arch, bpmn (see canvas_list_shapes for shape ids, fields and relations). ' +
      'Layout: layered reads left to right (LR); flowchart, bpmn and UML state diagrams default to top to bottom (TB); set `direction` to override. ' + DIAGRAM_TIPS +
      ' Position the diagram with near/side or x/y (top-left), otherwise it goes to the right of existing content.',
    {
      ...canvasArg,
      library: z.enum(LIBRARY_IDS).describe('Which library every node shape belongs to.'),
      title: z.string().optional().describe('Diagram title: the frame label when `frame` is set, otherwise a heading above the diagram.'),
      frame: z.union([z.boolean(), z.string()]).optional().describe('Wrap the diagram in a frame: true = the library frame (uml.package, c4.boundary, arch.region, bpmn.pool), or a frame shape id.'),
      frameSublabel: z.string().optional().describe('Type line of the frame, e.g. "Software System" or "Container" for a c4.boundary.'),
      nodes: z.array(diagramNode).min(1).max(80),
      edges: z.array(diagramEdge).max(200).optional(),
      layout: z.enum(['layered', 'grid']).optional().describe("Default 'layered'."),
      direction: z.enum(['LR', 'TB']).optional().describe('layered: LR (left to right) or TB (top to bottom). Default TB for flowchart, bpmn and UML state diagrams, else LR.'),
      ...placement,
      ...focusArg,
    },
    (a) =>
      mutate(a, (cf) => {
        const lib = libraryById(a.library)!;
        const ids = new Map<string, string>();
        const seen = new Set<string>();
        const defs = a.nodes.map((n) => {
          if (seen.has(n.key)) throw new Error(`Duplicate node key "${n.key}".`);
          seen.add(n.key);
          const def = requireShape(n.shape, 'solid');
          if (def.library !== lib.id) throw new Error(`Node "${n.key}": shape ${def.id} is not in the ${lib.id} library. Valid ${lib.id} shapes: ${shapesIn(lib.id).filter((x) => !x.frame).map((x) => x.id).join(', ')}.`);
          return { n, def, fields: normalizeFields(def, n.fields) };
        });
        const edges = a.edges ?? [];
        for (const e of edges) {
          for (const k of [e.from, e.to]) {
            if (!seen.has(k)) throw new Error(`Edge ${e.from} -> ${e.to} references unknown node key "${k}". Keys: ${[...seen].join(', ')}.`);
          }
          if (e.from === e.to) throw new Error(`Edge ${e.from} -> ${e.to} connects a node to itself.`);
          if (e.relation) requireRelation(e.relation);
        }
        let frameDef: ShapeDef | undefined;
        if (a.frame) {
          frameDef = a.frame === true ? defaultFrameOf(lib.id) : requireShape(a.frame, 'frame');
          if (!frameDef) throw new Error(`The ${lib.id} library has no frame shape; omit \`frame\` (frames: ${SHAPES.filter((x) => x.frame).map((x) => x.id).join(', ')}).`);
        }
        const stateLike = a.library === 'uml' && defs.some(({ def }) => /^uml\.(state|initial|final|choice|fork|activity)$/.test(def.id));
        const direction = a.direction ?? (a.library === 'flowchart' || a.library === 'bpmn' || stateLike ? 'TB' : 'LR');
        const algorithm = a.layout ?? 'layered';

        // 1. nodes, sized to fit their text, stacked at the origin until laid out
        for (const { n, def, fields } of defs) {
          const width = n.width ?? def.size[0];
          const height = fitShapeHeight({ text: n.text, fields, shape: def.id, width, height: n.height ?? def.size[1] });
          const node = addNode(cf, {
            type: 'text', variant: 'shape', shape: def.id, text: n.text, ...(fields && { fields }), color: toPreset(n.color), width, height, x: 0, y: 0,
          });
          ids.set(n.key, node.id);
        }
        const nodeIds = [...ids.values()];

        // 2. relative layout on a scratch canvas holding only the new nodes and edges
        const made = nodeIds.map((id) => requireNode(cf, id));
        const scratch: CanvasFile = {
          nodes: made.map((n) => ({ ...n })),
          edges: edges.map((e, i) => ({ id: `s${i}`, fromNode: ids.get(e.from)!, toNode: ids.get(e.to)! })),
        };
        const rel = layoutNodes(scratch, nodeIds, {
          algorithm, direction, origin: { x: 0, y: 0 }, layerGap: edges.some((e) => e.label || e.sublabel) ? 160 : 120, nodeGap: 48,
        });
        const minX = Math.min(...rel.map((m) => m.x));
        const minY = Math.min(...rel.map((m) => m.y));
        const maxX = Math.max(...rel.map((m) => m.x + requireNode(cf, m.id).width));
        const maxY = Math.max(...rel.map((m) => m.y + requireNode(cf, m.id).height));

        // 3. reserve room (frame padding / title) and find a spot
        const TITLE_H = 56;
        const padX = frameDef ? GROUP_PAD : 0;
        const padTop = frameDef ? GROUP_PAD + GROUP_LABEL : a.title ? TITLE_H : 0;
        const padBottom = frameDef ? GROUP_PAD : 0;
        const W = maxX - minX + 2 * padX;
        const H = maxY - minY + padTop + padBottom;
        const pos = placeNode(cf, { x: a.x, y: a.y, near: a.near, side: a.side }, W, H);
        for (const m of rel) {
          const n = requireNode(cf, m.id);
          n.x = Math.round(pos.x + padX + m.x - minX);
          n.y = Math.round(pos.y + padTop + m.y - minY);
        }

        // 4. edges, sides chosen from the final geometry
        const edgeIds = edges.map((e) => {
          const from = requireNode(cf, ids.get(e.from)!);
          const to = requireNode(cf, ids.get(e.to)!);
          return addEdge(cf, {
            fromNode: from.id, toNode: to.id, label: e.label, color: toPreset(e.color),
            ...styleEdge(from, to, { relation: e.relation, sublabel: e.sublabel }, algorithm === 'layered' ? direction : undefined),
          }).id;
        });

        rerouteEdges(cf, edgeIds);

        // 5. grow anything whose text still does not fit, then the frame / title around the result
        fixOnly(cf, nodeIds, lintSettings());
        const extra: string[] = [];
        let frameId: string | undefined;
        let titleId: string | undefined;
        if (frameDef) {
          const fit = fitGroup(cf, nodeIds);
          const g = addNode(cf, { type: 'group', shape: frameDef.id, label: a.title, sublabel: a.frameSublabel, ...fit });
          frameId = g.id;
          extra.push(g.id);
        } else if (a.title) {
          const t = addNode(cf, {
            type: 'text', variant: 'plain', text: `# ${a.title}`, x: pos.x, y: pos.y, width: Math.max(320, Math.min(W, 640)), height: 44,
          });
          titleId = t.id;
          extra.push(t.id);
        }
        fixOnly(cf, [...nodeIds, ...extra], lintSettings());
        return {
          nodes: Object.fromEntries(ids), edges: edgeIds, ...(frameId && { frame: frameId }), ...(titleId && { titleNode: titleId }),
          library: lib.id, direction: algorithm === 'layered' ? direction : undefined, focusIds: [...nodeIds, ...extra],
        };
      }),
  );

  // ---------- editing ----------

  tool(
    'canvas_update_node',
    'Update node',
    'Change properties of an existing node. Which fields apply depends on the node type: text nodes (note/sticky/plain/mermaid): text, title (note/mermaid only), color; ' +
      'finding cards: text, title, status, findingKind, color; log cards: text, title, errorLines; service cards: text (description), title (name), tags, entryPoints, color; ' +
      'file nodes: title, color, startLine/endLine (the displayed range; highlights must stay inside it); link nodes: title, color; group nodes: label, sublabel and shape (frame shapes), color; diagram shape nodes (variant shape): text (label), shape, fields, color. x/y/width/height apply to all. Fields that do not apply are rejected. ' +
      'Changing a finding status is how you show an investigation progressing (open -> investigating -> confirmed / ruled-out).',
    {
      ...canvasArg,
      nodeId: z.string(),
      text: z.string().optional().describe('New text / markdown / mermaid source.'),
      title: z.string().optional(),
      color: color.optional(),
      x: z.number().optional(), y: z.number().optional(),
      width: z.number().positive().optional(), height: z.number().positive().optional(),
      startLine: line('New first displayed line (file nodes).').optional(),
      endLine: line('New last displayed line (file nodes).').optional(),
      label: z.string().optional().describe('Group label.'),
      status: statusArg.optional().describe('finding cards: open | investigating | confirmed | ruled-out. Also updates the colour unless color is given (investigating=orange, confirmed=green, open/ruled-out=none).'),
      findingKind: findingKindArg.optional().describe('finding cards: hypothesis | evidence | question | conclusion.'),
      tags: z.array(z.string()).optional().describe('service cards: replaces the tags.'),
      entryPoints: z.array(entryPointArg).optional().describe('service cards: replaces the entry points.'),
      errorLines: z.array(z.number().int().min(1)).optional().describe('log cards: 1-based line numbers within the text drawn in red (replaces).'),
      shape: z.string().optional().describe('diagram shape nodes: change to another shape id (group frames: another frame shape).'),
      fields: fieldsArg.optional().describe('diagram shape nodes: replaces the structured fields (see canvas_list_shapes for the keys).'),
      sublabel: z.string().optional().describe('frame groups: the secondary label line.'),
      ...focusArg,
    },
    (a) =>
      mutate(a, (cf, totals) => {
        const n = requireNode(cf, a.nodeId);
        const bad = (...fields: (keyof typeof a)[]) => {
          const used = fields.filter((k) => a[k] !== undefined);
          if (used.length) throw new Error(`${used.join(', ')} not applicable to a ${describe(n)} node (${n.id}).`);
        };
        const describe = (x: CanvasFileNode) =>
          x.type === 'text' ? `text/${x.variant ?? 'note'}` : x.type === 'file' ? `file/${x.display ?? 'code'}` : x.type;
        const changed: string[] = [];
        const set = (k: string, v: unknown) => { (n as unknown as Record<string, unknown>)[k] = v; changed.push(k); };
        switch (n.type) {
          case 'text': {
            bad('startLine', 'endLine', 'label', 'sublabel');
            if (n.variant !== 'shape') bad('shape', 'fields');
            if (a.title !== undefined && (n.variant === 'sticky' || n.variant === 'plain' || n.variant === 'shape')) bad('title');
            if (n.variant !== 'finding') bad('status', 'findingKind');
            if (n.variant !== 'log') bad('errorLines');
            if (n.variant !== 'service') bad('tags', 'entryPoints');
            if (a.text !== undefined) set('text', n.variant === 'mermaid' ? stripFence(a.text) : a.text);
            if (n.variant === 'shape' && (a.shape !== undefined || a.fields !== undefined)) {
              const def = requireShape(a.shape ?? n.shape ?? '', 'solid');
              if (a.shape !== undefined) set('shape', def.id);
              if (a.fields !== undefined) {
                const f = normalizeFields(def, a.fields);
                if (f) set('fields', f);
                else { delete n.fields; changed.push('fields'); }
              } else if (a.shape !== undefined && n.fields) {
                const stale = Object.keys(n.fields).filter((k) => !def.fields?.some((x) => x.key === k));
                if (stale.length) throw new Error(`Fields ${stale.join(', ')} do not exist on ${def.id}; pass fields to replace them.`);
              }
            }
            if (a.title !== undefined) set('title', a.title);
            if (a.status !== undefined) {
              set('status', a.status);
              if (a.color === undefined) {
                const c = STATUS_COLOR[a.status];
                if (c) set('color', c);
                else if (n.color !== undefined) { delete n.color; changed.push('color'); }
              }
            }
            if (a.findingKind !== undefined) set('findingKind', a.findingKind);
            if (a.errorLines !== undefined) set('errorLines', a.errorLines);
            if (a.tags !== undefined) set('tags', a.tags);
            if (a.entryPoints !== undefined) set('entryPoints', toEntryPoints(a.entryPoints));
            break;
          }
          case 'file': {
            bad('text', 'label', 'status', 'findingKind', 'tags', 'entryPoints', 'errorLines', 'shape', 'fields', 'sublabel');
            if (a.title !== undefined) set('title', a.title);
            if (a.startLine !== undefined || a.endLine !== undefined) {
              const total = totalOf(totals, n);
              const cur = displayedRange(n, total);
              const s = a.startLine ?? cur?.[0] ?? 1;
              const e = a.endLine ?? cur?.[1] ?? total ?? s;
              if (e < s) throw new Error(`endLine ${e} is before startLine ${s}.`);
              if (total !== undefined && e > total) throw new Error(`endLine ${e} is beyond the end of the file (${total} lines).`);
              const stray = (n.highlights ?? []).filter((h) => h.start < s || h.end > e).map((h) => h.id);
              if (stray.length) throw new Error(`Highlights ${stray.join(', ')} fall outside ${s}-${e}; remove them with canvas_remove first.`);
              set('lines', [s, e]);
              syncSubpath(n);
            }
            break;
          }
          case 'link':
            bad('text', 'startLine', 'endLine', 'label', 'status', 'findingKind', 'tags', 'entryPoints', 'errorLines', 'shape', 'fields', 'sublabel');
            if (a.title !== undefined) set('title', a.title);
            break;
          case 'group':
            bad('text', 'title', 'startLine', 'endLine', 'status', 'findingKind', 'tags', 'entryPoints', 'errorLines', 'fields');
            if (a.label !== undefined) set('label', a.label);
            if (a.sublabel !== undefined) set('sublabel', a.sublabel);
            if (a.shape !== undefined) set('shape', requireShape(a.shape, 'frame').id);
            break;
        }
        if (a.color !== undefined) set('color', COLOR_MAP[a.color]);
        for (const k of ['x', 'y', 'width', 'height'] as const) if (a[k] !== undefined) set(k, a[k]);
        if (!changed.length) throw new Error('Nothing to update: pass at least one field.');
        return { nodeId: n.id, updated: changed, focusIds: [n.id] };
      }),
  );

  tool(
    'canvas_highlight_lines',
    'Highlight lines',
    'Highlight line ranges in a code view already on the canvas (nodes from canvas_open_file). Line numbers are 1-based, inclusive FILE line numbers and must fall within the displayed lines (the node range, or the whole file). ' +
      'Each range may have a color and a short label shown beside it. Highlights are added to existing ones unless replace=true. Returns the created highlight ids.',
    {
      ...canvasArg,
      nodeId: z.string().describe('Code node id, e.g. "code-1".'),
      ranges: z.array(z.object({
        start: line('First highlighted line.'),
        end: line('Last highlighted line (inclusive).'),
        color: color.optional().describe('Default yellow.'),
        label: z.string().optional().describe('Short annotation shown next to the range.'),
      })).min(1),
      replace: z.boolean().optional().describe('Replace existing highlights (default false).'),
      ...focusArg,
    },
    (a) =>
      mutate(a, (cf, totals) => {
        const n = requireNode(cf, a.nodeId);
        if (!isCodeNode(n)) throw new Error(`Node "${a.nodeId}" is not a code view (file node displayed as code).`);
        for (const r of a.ranges) {
          if (r.end < r.start) throw new Error(`Range ${r.start}-${r.end} has end before start.`);
          checkLine(n, r.start, totalOf(totals, n), 'Line');
          checkLine(n, r.end, totalOf(totals, n), 'Line');
        }
        const hs = addHighlights(
          cf, n,
          a.ranges.map((r) => ({ start: r.start, end: r.end, color: COLOR_MAP[r.color ?? 'yellow'], label: r.label })),
          a.replace ?? false,
        );
        return { nodeId: n.id, highlightIds: hs.map((h) => h.id), focusIds: [n.id] };
      }),
  );

  tool(
    'canvas_connect',
    'Connect nodes',
    'Draw an arrow between two nodes, typically to show control flow (caller -> callee). For code views, sourceLine/targetLine (file lines displayed in that node) anchor the arrow to exact lines, e.g. the call-site line -> the callee definition line. ' +
      'Create edges in call order and give them short labels such as "1. parse request". Without lines it connects node sides (fromSide/toSide optional).',
    {
      ...canvasArg,
      source: z.string().describe('Source node id.'),
      target: z.string().describe('Target node id.'),
      sourceLine: line('Anchor line in the source code node.').optional(),
      targetLine: line('Anchor line in the target code node.').optional(),
      fromSide: z.enum(['top', 'right', 'bottom', 'left']).optional(),
      toSide: z.enum(['top', 'right', 'bottom', 'left']).optional(),
      label: z.string().optional(),
      color: color.optional(),
      animated: z.boolean().optional(),
      bidirectional: z.boolean().optional().describe('Also draw an arrowhead at the source end.'),
      relation: z.enum(RELATION_IDS).optional().describe(
        'Relationship preset (markers, dashes, routing): flow.next, uml.association/inheritance/realization/dependency/aggregation/composition/transition, c4.uses, erd.one-to-one/one-to-many/zero-to-many/many-to-many, arch.calls/publishes/reads, bpmn.sequence/message. Defaults to the library\'s when both nodes are shapes of the same library.',
      ),
      fromMarker: markerArg.optional().describe('End marker at the source; overrides the relation.'),
      toMarker: markerArg.optional().describe('End marker at the target; overrides the relation.'),
      lineStyle: z.enum(['solid', 'dashed', 'dotted']).optional(),
      routing: z.enum(['bezier', 'orthogonal', 'straight']).optional().describe('Edge path: bezier (default), orthogonal (right angles) or straight.'),
      sublabel: z.string().optional().describe('Secondary label under the label, e.g. the protocol "JSON/HTTPS".'),
      ...focusArg,
    },
    (a) =>
      mutate(a, (cf, totals) => {
        const src = requireNode(cf, a.source);
        const dst = requireNode(cf, a.target);
        if (a.sourceLine !== undefined) checkLine(src, a.sourceLine, totalOf(totals, src), 'sourceLine');
        if (a.targetLine !== undefined) checkLine(dst, a.targetLine, totalOf(totals, dst), 'targetLine');
        const e = addEdge(cf, {
          fromNode: a.source, toNode: a.target, fromLine: a.sourceLine, toLine: a.targetLine,
          fromSide: a.fromSide, toSide: a.toSide, label: a.label, color: toPreset(a.color), animated: a.animated,
          fromEnd: a.bidirectional ? 'arrow' : undefined,
          ...styleEdge(src, dst, a),
          // explicit sides win over the automatic ones
          ...(a.fromSide && { fromSide: a.fromSide }), ...(a.toSide && { toSide: a.toSide }),
        });
        return { edgeId: e.id, ...(e.relation && { relation: e.relation }), focusIds: [a.source, a.target] };
      }),
  );

  tool(
    'canvas_remove',
    'Remove nodes or edges',
    'Remove nodes, edges and/or line highlights by id (e.g. "code-1", "edge-4", "hl-3"). Removing a node also removes its edges.',
    { ...canvasArg, ids: z.array(z.string()).min(1) },
    (a) =>
      mutate({ canvas: a.canvas, focus: false }, (cf) => {
        const nodes = removeNodes(cf, a.ids);
        const edges = [...nodes.edges, ...removeEdges(cf, a.ids)];
        const highlights = removeHighlights(cf, a.ids);
        const done = new Set([...nodes.nodes, ...edges, ...highlights]);
        return { removedNodes: nodes.nodes, removedEdges: edges, removedHighlights: highlights, unknown: a.ids.filter((i) => !done.has(i)) };
      }),
  );

  tool(
    'canvas_clear',
    'Clear canvas',
    'Remove every node and edge from the canvas file (its title and description are kept). This edits a committed file; VS Code undo restores it.',
    { ...canvasArg },
    (a) =>
      mutate({ canvas: a.canvas, focus: false }, (cf) => {
        const removed = { nodes: cf.nodes.length, edges: cf.edges.length };
        cf.nodes = [];
        cf.edges = [];
        return { cleared: true, removed };
      }),
  );

  tool(
    'canvas_lint',
    'Lint canvas',
    'Check a canvas for layout mistakes that make it hard to read: overlapping or crowded nodes, nodes straddling a group border, a node covering a group label, edges routed through nodes, clipped text, outlier nodes, groups listed after their members, and broken anchors/highlights/missing files. ' +
      'Returns compact diagnostics (rule, severity, message, ids, hasFix). With fix:true it applies the safe mechanical fixes (moves/resizes/reorders only; earlier nodes stay put) and returns what was applied and what remains. ' +
      'destructive:true additionally removes dangling, duplicate and self-loop edges. The same check runs from the command line: `npx canvas-lint --fix`.',
    {
      ...canvasArg,
      fix: z.boolean().optional().describe('Apply automatic fixes and save (default false).'),
      destructive: z.boolean().optional().describe('With fix: also delete dangling/duplicate/self-loop edges (default false).'),
      ...focusArg,
    },
    async (a) => {
      const uri = await docs.target(a.canvas);
      const cur = await docs.read(uri);
      const opts = await lintOptionsFor(cur);
      const summary = (ds: LintDiagnostic[]) => ({
        errors: ds.filter((d) => d.severity === 'error').length,
        warnings: ds.filter((d) => d.severity === 'warning').length,
        infos: ds.filter((d) => d.severity === 'info').length,
      });
      const LIMIT = 40;
      const list = (ds: LintDiagnostic[]) => {
        const sorted = [...ds].sort(bySeverity);
        return { diagnostics: sorted.slice(0, LIMIT).map(compact), ...(sorted.length > LIMIT && { more: sorted.length - LIMIT }) };
      };
      if (!a.fix) {
        const ds = lintCanvas(cur, opts);
        return { canvas: docs.relPath(uri), ...summary(ds), ...list(ds) };
      }
      const res = await docs.edit(uri, (f) => {
        const r = fixCanvas(f, { ...opts, destructive: a.destructive });
        f.nodes = r.canvas.nodes;
        f.edges = r.canvas.edges;
        return r;
      }, { save: true });
      await editor.reveal(uri);
      const moved = [...new Set(res.applied.flatMap((d) => d.fix?.moves?.map((m) => m.id) ?? []))];
      if (a.focus !== false && moved.length) editor.focus(uri, moved);
      return {
        canvas: docs.relPath(uri),
        applied: res.applied.map((d) => ({ rule: d.rule, fix: d.fix?.description, ids: [...d.nodeIds, ...d.edgeIds] })),
        ...summary(res.remaining),
        remaining: list(res.remaining).diagnostics,
      };
    },
  );

  tool(
    'canvas_get_state',
    'Get canvas state',
    'Compact summary of a canvas: nodes (id, type, geometry, file and displayed range, highlights, titles, truncated text) and edges. Does not include file contents. Use it to find node ids before connecting or updating.',
    { ...canvasArg },
    async (a) => {
      const uri = await docs.target(a.canvas);
      const f = await docs.read(uri);
      return {
        canvas: docs.relPath(uri),
        title: f.vsCanvas?.title,
        description: f.vsCanvas?.description,
        kind: f.vsCanvas?.kind,
        pinned: f.vsCanvas?.pinned,
        flows: f.vsCanvas?.flows?.map((x) => ({ id: x.id, title: x.title, steps: x.steps.length })),
        nodes: f.nodes.map((n) => {
          const base = { id: n.id, type: n.type, x: n.x, y: n.y, width: n.width, height: n.height, color: fromPreset(n.color) };
          switch (n.type) {
            case 'text':
              return {
                ...base, variant: n.variant ?? 'note', title: n.title, text: trunc(n.text), status: n.status, findingKind: n.findingKind,
                errorLines: n.errorLines, entryPoints: n.entryPoints, tags: n.tags, canvas: n.canvas, shape: n.shape, fields: n.fields,
              };
            case 'file':
              return {
                ...base, file: n.file, display: isCanvasPath(n.file) ? 'portal' : n.display ?? 'code', title: n.title, lines: n.lines,
                highlights: n.highlights?.map(({ id, start, end, color: c, label }) => ({ id, start, end, color: fromPreset(c), label })),
              };
            case 'link': return { ...base, url: n.url, title: n.title };
            case 'group': return { ...base, label: n.label, sublabel: n.sublabel, shape: n.shape, contains: groupMembers(f, n) };
          }
        }),
        edges: f.edges.map((e) => ({ ...e, color: fromPreset(e.color) })),
      };
    },
  );

  tool(
    'canvas_focus',
    'Focus canvas',
    'Reveal the canvas and pan/zoom it to fit the given nodes, or all nodes when nodeIds is omitted.',
    { ...canvasArg, nodeIds: z.array(z.string()).optional() },
    async (a) => {
      const uri = await docs.target(a.canvas);
      await editor.reveal(uri);
      editor.focus(uri, a.nodeIds, { zoom: true });
      return { canvas: docs.relPath(uri), focused: a.nodeIds ?? 'all' };
    },
  );

  // ---------- semantic cards ----------

  tool(
    'canvas_add_finding',
    'Add finding card',
    'Add an investigation card: a hypothesis, piece of evidence, open question or conclusion with a status. Status drives the look: open (neutral), investigating (orange), confirmed (green), ruled-out (greyed and struck through). ' +
      'Update the status later with canvas_update_node as you learn more. Attach it to the code it is about with attachTo/attachLine. ' + COLOR_VOCAB,
    {
      ...canvasArg,
      kind: findingKindArg.describe('hypothesis | evidence | question | conclusion.'),
      title: z.string().describe('Short claim, e.g. "Retry re-sends the charge".'),
      text: z.string().describe('Markdown: reasoning or evidence.'),
      status: statusArg.optional().describe("Default 'open'."),
      color: color.optional().describe('Overrides the status colour.'),
      ...placement,
      ...attach,
      ...focusArg,
    },
    (a) =>
      mutate(a, (cf, totals) => {
        const status = a.status ?? 'open';
        const width = 280;
        const need = estimateTextHeight({ text: a.text, title: a.title, variant: 'finding', width }) ?? 0;
        const height = Math.min(700, Math.max(150, Math.ceil(need / 10) * 10 + 10));
        return addWithAttach(cf, totals, {
          type: 'text', variant: 'finding', findingKind: a.kind, status, title: a.title, text: a.text,
          color: toPreset(a.color) ?? STATUS_COLOR[status], width, height,
        }, a);
      }),
  );

  tool(
    'canvas_add_log',
    'Add log / stack trace',
    'Add a monospace log or stack trace card. `file:line` frames in the text become clickable and open the code; errorLines (1-based line numbers within the text) are drawn in red. ' +
      'Typical first step of a bug investigation, followed by canvas_open_file / canvas_trace on the frames.',
    {
      ...canvasArg,
      text: z.string().describe('The log / stack trace, verbatim.'),
      title: z.string().optional().describe('e.g. "Checkout 500 stack trace".'),
      errorLines: z.array(z.number().int().min(1)).optional().describe('1-based line numbers within `text` to draw red (the failing frame / error message).'),
      ...placement,
      ...attach,
      ...focusArg,
    },
    (a) =>
      mutate(a, (cf, totals) => {
        const rows = a.text.split('\n');
        const longest = rows.reduce((m, l) => Math.max(m, l.length), 0);
        const bad = a.errorLines?.find((l) => l > rows.length);
        if (bad) throw new Error(`errorLines ${bad} is beyond the ${rows.length} lines of text.`);
        return addWithAttach(cf, totals, {
          type: 'text', variant: 'log', text: a.text, title: a.title, errorLines: a.errorLines,
          width: Math.min(900, Math.max(520, Math.ceil(longest * 7.2 + 40))),
        }, a);
      }),
  );

  tool(
    'canvas_add_service',
    'Add service card',
    'Add a service/domain card for a map: name, one-sentence description, entry points (real files and lines) and tags. The viewer zooms from the card to its entry points to the actual code. ' +
      'Set `canvas` to a deeper *.canvas.json to make the card a drill-down. Group related services with canvas_add_group color "domain" and connect them with canvas_connect.',
    {
      ...canvasArg,
      name: z.string().describe('Service / domain name.'),
      description: z.string().describe('What it does, one or two sentences (markdown).'),
      entryPoints: z.array(entryPointArg).optional().describe('Where to start reading: file, optional lines, label.'),
      tags: z.array(z.string()).optional().describe('Short tags such as "http", "queue", "postgres".'),
      canvas: z.string().optional().describe('Workspace-relative *.canvas.json this card drills down into (must exist).'),
      color: color.optional().describe('Default none.'),
      ...placement,
      ...attach,
      ...focusArg,
    },
    async (a) => {
      const entryPoints = a.entryPoints?.length ? toEntryPoints(a.entryPoints) : undefined;
      if (entryPoints) {
        await Promise.all(entryPoints.map(async (e) => {
          const total = (await openDoc(e.file)).lineCount;
          if (e.lines && e.lines[0] > total) throw new Error(`Entry point "${e.label}": line ${e.lines[0]} is beyond the end of ${e.file} (${total} lines).`);
        }));
      }
      let canvasPath: string | undefined;
      if (a.canvas) {
        const u = docs.resolvePath(a.canvas);
        if (!(await docs.exists(u))) throw new Error(`Drill-down canvas not found: ${a.canvas}. Create it first with canvas_create.`);
        canvasPath = docs.relPath(u);
      }
      const need = estimateTextHeight({ text: a.description, title: a.name, variant: 'service', width: 320 }) ?? 0;
      const height = Math.min(500, Math.max(200, Math.ceil(need / 10) * 10 + 10));
      return mutate(a, (cf, totals) =>
        addWithAttach(cf, totals, {
          type: 'text', variant: 'service', title: a.name, text: a.description, color: toPreset(a.color),
          entryPoints, tags: a.tags?.length ? a.tags : undefined, canvas: canvasPath, width: 320, height,
        }, a));
    },
  );

  tool(
    'canvas_add_portal',
    'Add canvas portal',
    'Add a live thumbnail of another canvas that opens it on click (drill-down from a map to a detailed canvas). The target must already exist.',
    {
      ...canvasArg,
      target: z.string().describe('Workspace-relative path of the *.canvas.json to link to.'),
      ...placement,
      ...attach,
      ...focusArg,
    },
    async (a) => {
      const u = docs.resolvePath(a.target);
      if (!(await docs.exists(u))) throw new Error(`Canvas not found: ${a.target}. Use canvas_list or canvas_create.`);
      const file = docs.relPath(u);
      return mutate(a, (cf, totals) => addWithAttach(cf, totals, { type: 'file', file }, a));
    },
  );

  // ---------- flows ----------

  tool(
    'canvas_add_flow',
    'Add flow',
    'Define a playable flow over the canvas: a packet travels the steps in order, target lines light up, the camera follows and a data chip shows the payload at each hop. ' +
      'Each step is EITHER an existing edge (`edge`), OR `from`+`to` node ids (reuses an existing edge between them, else creates one), OR a single `node` (the packet appears there). ' +
      'startLine/endLine light up lines in the step\'s target code node. `data` is the payload at that point, e.g. "Order{ id: 812, total: 49.00 }". parallel:true starts a step together with the previous one (a fork). ' +
      'Returns flowId; then call canvas_play_flow. Use for "what happens to X after Y" questions.',
    {
      ...canvasArg,
      title: z.string(),
      description: z.string().optional(),
      steps: z.array(z.object({
        edge: z.string().optional().describe('Existing edge id.'),
        from: z.string().optional().describe('Source node id (with `to`).'),
        to: z.string().optional().describe('Target node id (with `from`).'),
        node: z.string().optional().describe('Node id for a step without an edge.'),
        startLine: line('First line to light up in the target code node.').optional(),
        endLine: line('Last line (inclusive).').optional(),
        caption: z.string().optional().describe('Short caption shown during the step.'),
        data: z.string().optional().describe('Payload shape/value at this point.'),
        parallel: z.boolean().optional(),
        durationMs: z.number().int().min(100).max(30000).optional().describe('Default 1200.'),
      })).min(1),
      ...focusArg,
    },
    (a) =>
      mutate(a, (cf, totals) => {
        const created: string[] = [];
        const steps: FlowStep[] = a.steps.map((st, i) => {
          const where = `Step ${i + 1}`;
          const modes = [st.edge !== undefined, st.from !== undefined || st.to !== undefined, st.node !== undefined].filter(Boolean).length;
          if (modes !== 1) throw new Error(`${where}: give exactly one of edge, from+to, or node.`);
          let targetId: string;
          const out: FlowStep = { id: `step-${i + 1}` };
          if (st.edge !== undefined) {
            const e = cf.edges.find((x) => x.id === st.edge);
            if (!e) throw new Error(`${where}: edge "${st.edge}" not found.`);
            out.edge = e.id;
            targetId = e.toNode;
          } else if (st.from !== undefined || st.to !== undefined) {
            if (!st.from || !st.to) throw new Error(`${where}: from and to must both be given.`);
            requireNode(cf, st.from);
            requireNode(cf, st.to);
            let e = cf.edges.find((x) => x.fromNode === st.from && x.toNode === st.to);
            if (!e) {
              e = addEdge(cf, { fromNode: st.from, toNode: st.to });
              created.push(e.id);
            }
            out.edge = e.id;
            targetId = st.to;
          } else {
            targetId = requireNode(cf, st.node!).id;
            out.node = targetId;
          }
          if (st.startLine !== undefined || st.endLine !== undefined) {
            const n = requireNode(cf, targetId);
            const s0 = st.startLine ?? st.endLine!;
            const e0 = st.endLine ?? s0;
            if (e0 < s0) throw new Error(`${where}: endLine ${e0} is before startLine ${s0}.`);
            checkLine(n, s0, totalOf(totals, n), `${where} startLine`);
            checkLine(n, e0, totalOf(totals, n), `${where} endLine`);
            out.lines = [s0, e0];
          }
          if (st.caption) out.caption = st.caption;
          if (st.data) out.data = st.data;
          if (st.parallel) out.parallel = true;
          if (st.durationMs) out.durationMs = st.durationMs;
          return out;
        });
        const meta: CanvasMeta = { version: 1, ...cf.vsCanvas };
        const max = (meta.flows ?? []).reduce((m, f) => Math.max(m, Number(/^flow-(\d+)$/.exec(f.id)?.[1] ?? 0)), 0);
        const flowId = `flow-${max + 1}`;
        meta.flows = [...(meta.flows ?? []), { id: flowId, title: a.title, ...(a.description && { description: a.description }), steps }];
        cf.vsCanvas = meta;
        const ids = new Set<string>();
        for (const st of steps) {
          if (st.node) ids.add(st.node);
          const e = st.edge ? cf.edges.find((x) => x.id === st.edge) : undefined;
          if (e) { ids.add(e.fromNode); ids.add(e.toNode); }
        }
        return { flowId, steps: steps.length, ...(created.length && { createdEdges: created }), focusIds: [...ids] };
      }),
  );

  tool(
    'canvas_play_flow',
    'Play flow',
    'Reveal the canvas and play a flow defined with canvas_add_flow (packet animation, line highlights, data chips, camera follow).',
    {
      ...canvasArg,
      flowId: z.string().describe('Flow id returned by canvas_add_flow (also listed by canvas_list).'),
      fromStep: z.number().int().min(0).optional().describe('0-based step to start at (default 0).'),
    },
    async (a) => {
      const uri = await docs.target(a.canvas);
      const f = await docs.read(uri);
      const flow = f.vsCanvas?.flows?.find((x) => x.id === a.flowId);
      if (!flow) throw new Error(`Flow "${a.flowId}" not found. Available: ${(f.vsCanvas?.flows ?? []).map((x) => x.id).join(', ') || 'none'}.`);
      if (a.fromStep !== undefined && a.fromStep >= flow.steps.length) throw new Error(`fromStep ${a.fromStep} is beyond the ${flow.steps.length} steps.`);
      await editor.reveal(uri);
      editor.playFlow(uri, flow.id, a.fromStep);
      return { canvas: docs.relPath(uri), playing: flow.id, title: flow.title, steps: flow.steps.length };
    },
  );

  // ---------- trace / layout / pin ----------

  tool(
    'canvas_trace',
    'Trace call tree onto canvas',
    'THE fastest way to explain how code connects: builds a whole call tree on the canvas in ONE call using the language server. ' +
      'The root symbol becomes a code node (its range, max 30 lines); callers (direction incoming) are laid out to its LEFT and callees (outgoing) to its RIGHT, up to `depth` levels (1-3, default 2) and `maxPerLevel` (default 5) per symbol. ' +
      'Each item is a code node showing the symbol\'s range (capped at 30 lines, windowed to include the call site) and every call is a line-anchored edge from the exact call-site line to the callee definition, labelled with the callee name. ' +
      'Code already on the canvas is reused and connected instead of duplicated; new nodes are laid out and lint-fixed automatically. Identify the root by `symbol` (dotted name from code_symbols) or by `line`. ' +
      'Returns every node id with its symbol, file and role so you can then highlight lines, add findings or notes, or build a flow. Empty results usually mean the language server is warming up; retry.',
    {
      ...canvasArg,
      path: z.string().describe('File containing the root symbol, absolute or workspace-relative.'),
      symbol: z.string().optional().describe('Root symbol, e.g. "PaymentService.charge" or "charge".'),
      line: line('A line inside the root symbol (used when symbol is not given).').optional(),
      direction: z.enum(['incoming', 'outgoing', 'both']).describe('incoming = who calls it (left), outgoing = what it calls (right), both = the whole neighbourhood.'),
      depth: z.number().int().min(1).max(3).optional().describe('Levels to expand (default 2).'),
      maxPerLevel: z.number().int().min(1).max(15).optional().describe('Max callers/callees per symbol (default 5).'),
      ...focusArg,
    },
    async (a) => {
      if (a.symbol === undefined && a.line === undefined) throw new Error('Provide either symbol or line.');
      workspaceRelPath(a.path);
      const plan = await planTrace(a.path, { symbol: a.symbol, line: a.line }, {
        direction: a.direction, depth: a.depth ?? 2, maxPerLevel: a.maxPerLevel ?? 5, maxTotal: 30,
      });
      const lint = lintSettings();
      let result: ReturnType<typeof applyTrace> | undefined;
      const out = await mutate(a, (cf) => {
        result = applyTrace(cf, plan, { lint });
        return { focusIds: [result.rootId, ...result.newNodes] };
      });
      const r = result!;
      const callers = new Set(plan.links.filter((l) => l.to === plan.root.key).map((l) => l.from));
      const all = [plan.root, ...plan.items];
      return {
        ...out,
        rootNodeId: r.rootId,
        nodes: all.map((i) => ({
          nodeId: r.nodes[i.key], symbol: i.name, file: i.file, lines: i.lines,
          role: i === plan.root ? 'root' : callers.has(i.key) ? 'caller' : 'related',
          reused: r.reused.includes(r.nodes[i.key]),
        })),
        edges: r.newEdges.length,
        ...(plan.items.length === 0 && { note: `No callers/callees found. ${WARMUP_NOTE}` }),
      };
    },
  );

  tool(
    'canvas_layout',
    'Auto-layout nodes',
    'Re-arrange nodes automatically. layered (default): left-to-right by edge direction with 120px between layers, ordered to reduce crossings - use it for call graphs and flows. grid: even rows and columns. column: one vertical stack. ' +
      'Applies to nodeIds, or to every non-group node when omitted. Nodes outside the set never move and are never overlapped. Groups are not moved; re-fit them afterwards if needed.',
    {
      ...canvasArg,
      nodeIds: z.array(z.string()).optional().describe('Nodes to arrange (default: all non-group nodes).'),
      algorithm: z.enum(['layered', 'grid', 'column']).optional().describe("Default 'layered'."),
      direction: z.enum(['LR', 'TB']).optional().describe("layered only: 'LR' left to right (default) or 'TB' top to bottom (flowcharts)."),
      ...focusArg,
    },
    (a) =>
      mutate(a, (cf) => {
        const ids = a.nodeIds?.length ? a.nodeIds : cf.nodes.filter((n) => n.type !== 'group').map((n) => n.id);
        a.nodeIds?.forEach((i) => requireNode(cf, i));
        const moves = layoutNodes(cf, ids, { algorithm: a.algorithm ?? 'layered', direction: a.direction });
        applyMoves(cf, moves);
        fixOnly(cf, moves.map((m) => m.id), lintSettings());
        return { arranged: moves.length, algorithm: a.algorithm ?? 'layered', focusIds: a.nodeIds?.length ? ids : undefined };
      }),
  );

  tool(
    'canvas_pin',
    'Pin canvas',
    'Pin or unpin a canvas. Pinned canvases are listed first in the Canvases sidebar and the first pinned map opens with Canvas: Open Pinned Map (ctrl/cmd+alt+m). Pin the repo map.',
    { ...canvasArg, pinned: z.boolean() },
    async (a) => {
      const uri = await docs.target(a.canvas);
      await docs.edit(uri, (f) => {
        const meta: CanvasMeta = { version: 1, ...f.vsCanvas };
        if (a.pinned) meta.pinned = true;
        else delete meta.pinned;
        f.vsCanvas = meta;
      }, { save: true });
      return { canvas: docs.relPath(uri), pinned: a.pinned };
    },
  );

  // ---------- code intelligence (unchanged) ----------

  tool(
    'code_symbols',
    'List symbols in file',
    'List symbols (classes, functions, methods, ...) in a file using the editor language server. Names are dotted ("Class.method") with 1-based start/end lines. ' +
      'Use this to find where to start/end a line range for canvas_open_file. Empty results may mean the language server is still warming up; retry.',
    { path: z.string().describe('File path, absolute or workspace-relative.') },
    (a) => listSymbols(a.path),
  );

  tool(
    'code_call_hierarchy',
    'Call hierarchy',
    'Find callers (incoming) or callees (outgoing) of a function/method using the language server. Identify the target by symbol (dotted name from code_symbols) or by line+column (1-based). ' +
      'Each result has path, the 1-based line range of the item, and callSiteLines (the lines where the call happens) - ideal for canvas_connect anchors. ' +
      'Empty results may mean the language server is warming up; retry.',
    {
      path: z.string(),
      symbol: z.string().optional().describe('Symbol name, e.g. "Class.method" or "method".'),
      line: line('Line of the symbol (if no symbol given).').optional(),
      column: z.number().int().min(1).optional().describe('Column (1-based, default 1).'),
      direction: z.enum(['incoming', 'outgoing']),
    },
    (a) => callHierarchy(a.path, { symbol: a.symbol, line: a.line, column: a.column }, a.direction),
  );

  tool(
    'code_definition',
    'Go to definition',
    'Find the definition location(s) of the symbol at a position (1-based line and column) using the language server. Returns workspace-relative path and line range. ' +
      'Empty results may mean the language server is warming up; retry.',
    { path: z.string(), line: line('1-based line.'), column: z.number().int().min(1).describe('1-based column.') },
    (a) => definition(a.path, a.line, a.column),
  );

  registerPrompts(server);
}
