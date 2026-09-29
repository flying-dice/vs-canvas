// On-disk format for `*.canvas.json` files, committed to the repo.
//
// A superset of JSON Canvas 1.0 (https://jsoncanvas.org/spec/1.0/): every file is a valid JSON Canvas
// document, and our extra fields are optional and ignored by other JSON Canvas tools.
// Paths are workspace-relative with forward slashes. Line numbers are 1-based and inclusive.
// Code file contents are never stored; they are read from the workspace when rendered.

/** JSON Canvas preset colors "1"-"6" or a hex string like "#ff8800". */
export type CanvasColor = string;

/** Friendly names used by the MCP API; mapped to JSON Canvas presets on disk. */
export const COLOR_PRESETS = {
  red: '1',
  orange: '2',
  yellow: '3',
  green: '4',
  cyan: '5',
  purple: '6',
} as const;
export type ColorName = keyof typeof COLOR_PRESETS;

export type Side = 'top' | 'right' | 'bottom' | 'left';
export type EdgeEnd = 'none' | 'arrow';

type NodeBase = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: CanvasColor;
};

/**
 * Semantic colour vocabulary. Agents and the UI use these consistently so every board reads the same way.
 * red = failure path / root cause, orange = under investigation, yellow = attention / key line,
 * green = confirmed / healthy, cyan = data in motion / flow, purple = domain boundary.
 */
export const SEMANTIC_COLORS = {
  failure: '1',
  investigating: '2',
  attention: '3',
  confirmed: '4',
  flow: '5',
  domain: '6',
} as const;

export type FindingKind = 'hypothesis' | 'evidence' | 'question' | 'conclusion';
export type FindingStatus = 'open' | 'investigating' | 'confirmed' | 'ruled-out';

/** An entry point of a service/domain: a file (optionally a line range) with a short label. */
export type EntryPoint = { file: string; lines?: [start: number, end: number]; label: string };

/**
 * Markdown text. `variant` selects how it is drawn:
 * - 'note' (default): markdown card; ```mermaid fences render as diagrams.
 * - 'sticky': sticky note, colored background, short text.
 * - 'plain': free text drawn directly on the canvas (titles, labels), no card.
 * - 'mermaid': the text is Mermaid source (no fence) rendered as a diagram card.
 * - 'finding': investigation card (hypothesis/evidence/question/conclusion) with a status.
 * - 'log': monospace log / stack trace; `file:line` frames are clickable, `errorLines` (1-based within text) are red.
 * - 'service': a service/domain card for maps: `title`, markdown `text` description, `entryPoints`, `tags`,
 *   optional drill-down `canvas`. Reveals entry points and then code as the viewer zooms in (semantic zoom).
 * - 'shape': a diagram shape from a shape library (`shape`, e.g. "flowchart.decision", "uml.class", "c4.container";
 *   see ./shapes). `text` is the label (markdown allowed for description-style shapes); `fields` holds the
 *   shape's structured data (e.g. UML attributes/methods, C4 technology, ERD columns) as defined by the shape.
 */
export type TextNode = NodeBase & {
  type: 'text';
  text: string;
  variant?: 'note' | 'sticky' | 'plain' | 'mermaid' | 'finding' | 'log' | 'service' | 'shape';
  /** Heading shown on note/mermaid/finding/log/service cards. */
  title?: string;
  // finding
  findingKind?: FindingKind;
  status?: FindingStatus;
  // log
  errorLines?: number[];
  // service
  entryPoints?: EntryPoint[];
  tags?: string[];
  /** Workspace-relative path of a drill-down *.canvas.json. */
  canvas?: string;
  // shape
  /** Shape id "<library>.<shape>" from ./shapes (SHAPES). */
  shape?: string;
  /** Structured shape data; keys and kinds per the shape's `fields` spec. Lists are arrays of lines. */
  fields?: Record<string, string | string[]>;
};

export type LineHighlight = {
  id: string;
  start: number;
  end: number;
  color?: CanvasColor;
  label?: string;
};

/**
 * A workspace file.
 * - display 'code' (default for text files): shows source lines `lines` (or the whole file), with highlights.
 * - display 'reference': a compact chip showing the path (and line range) that opens the file on click.
 * A file node whose `file` ends in `.canvas.json` renders as a portal: a live thumbnail of that canvas that
 * opens it (drill-down from maps). `display` is ignored for portals.
 */
export type FileNode = NodeBase & {
  type: 'file';
  file: string;
  /** JSON Canvas subpath, e.g. "#L10-L20". Kept in sync with `lines` for interop. */
  subpath?: string;
  display?: 'code' | 'reference';
  lines?: [start: number, end: number];
  highlights?: LineHighlight[];
  title?: string;
};

export type LinkNode = NodeBase & {
  type: 'link';
  url: string;
  title?: string;
};

export type GroupNode = NodeBase & {
  type: 'group';
  label?: string;
  /**
   * Optional frame shape from ./shapes (a shape with `frame: true`), e.g. "c4.boundary" (dashed boundary with a
   * type line), "uml.package" (tabbed folder), "bpmn.pool", "arch.region". Default: the plain canvas group.
   */
  shape?: string;
  /** Secondary label line for frame shapes (e.g. C4 boundary type "Software System"). */
  sublabel?: string;
};

export type CanvasFileNode = TextNode | FileNode | LinkNode | GroupNode;

export type CanvasFileEdge = {
  id: string;
  fromNode: string;
  fromSide?: Side;
  fromEnd?: EdgeEnd;
  toNode: string;
  toSide?: Side;
  /** Defaults to 'arrow' per JSON Canvas. */
  toEnd?: EdgeEnd;
  color?: CanvasColor;
  label?: string;
  /** Extension: anchor to a source line of a file node displayed as code. */
  fromLine?: number;
  toLine?: number;
  animated?: boolean;
  /**
   * Extension: richer end markers than JSON Canvas's none/arrow (UML, ERD crow's foot...). When set they win over
   * fromEnd/toEnd, which writers keep as the closest JSON Canvas equivalent for interop.
   */
  fromMarker?: EdgeMarker;
  toMarker?: EdgeMarker;
  lineStyle?: 'solid' | 'dashed' | 'dotted';
  /** 'bezier' (default), 'orthogonal' (right angles, rounded corners; flowcharts, C4, ERD), 'straight'. */
  routing?: 'bezier' | 'orthogonal' | 'straight';
  /** Relationship preset from ./shapes (RELATIONS), e.g. "uml.inheritance"; informs markers/style and the legend. */
  relation?: string;
  /** Secondary label, e.g. C4 technology ("JSON/HTTPS") shown under the label. */
  sublabel?: string;
};

export type EdgeMarker =
  | 'none'
  | 'arrow' // filled arrowhead
  | 'open-arrow' // two-stroke open arrowhead (UML association/dependency)
  | 'triangle' // hollow triangle (UML inheritance/realization)
  | 'diamond' // hollow diamond (UML aggregation)
  | 'diamond-filled' // filled diamond (UML composition)
  | 'circle' // small hollow circle
  | 'crow-one' // ERD: exactly one ||
  | 'crow-zero-one' // ERD: zero or one o|
  | 'crow-many' // ERD: many (crow's foot)
  | 'crow-one-many' // ERD: one or many |<
  | 'crow-zero-many'; // ERD: zero or many o<

/**
 * One step of a flow. A packet travels `edge` (or appears at `node`), the target `lines` light up, the camera
 * follows and `data` is shown in a chip next to the packet (the payload at that point, e.g. "Order{ id: 812 }").
 * `parallel: true` starts the step together with the previous one (e.g. a fork where the packet splits).
 */
export type FlowStep = {
  id: string;
  edge?: string;
  node?: string;
  lines?: [start: number, end: number];
  caption?: string;
  data?: string;
  parallel?: boolean;
  /** Travel/dwell time in ms (default 1200). */
  durationMs?: number;
};

export type Flow = { id: string; title: string; description?: string; steps: FlowStep[] };

export type CanvasMeta = {
  version: 1;
  title?: string;
  description?: string;
  /** What the board is for; drives defaults such as layout and the sidebar icon. */
  kind?: 'map' | 'investigation' | 'flow' | 'notes';
  /** Pinned canvases are listed first in the sidebar and open with "Canvas: Open Pinned Map". */
  pinned?: boolean;
  flows?: Flow[];
};

export type CanvasFile = {
  /** Optional JSON Schema reference (editor validation/completion); preserved on save. */
  $schema?: string;
  nodes: CanvasFileNode[];
  edges: CanvasFileEdge[];
  /** Extension metadata; ignored by other JSON Canvas tools. */
  vsCanvas?: CanvasMeta;
};

export const CANVAS_GLOB = '**/*.canvas.json';
