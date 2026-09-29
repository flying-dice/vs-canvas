// Shape libraries: the registry of diagram shapes (flowchart, UML, C4, ERD, architecture, BPMN) and relationship
// presets. Pure data, shared by the MCP tools (validation, descriptions), the linter (sizes) and the webview
// (palette, rendering: the webview draws each shape id; see webview/src/lib/shapes/).
import type { EdgeEnd, EdgeMarker } from './canvasFile';

export type LibraryId = 'flowchart' | 'uml' | 'c4' | 'erd' | 'arch' | 'bpmn';

export type FieldSpec = {
  key: string;
  label: string;
  /** 'text' = one line; 'lines' = a list, one entry per line (attributes, methods, columns). */
  kind: 'text' | 'lines';
  placeholder?: string;
};

export type ShapeDef = {
  /** "<library>.<name>", stored on the node as `shape`. */
  id: string;
  library: LibraryId;
  name: string;
  /** One line, shown in the palette and MCP tool listing. */
  description: string;
  keywords?: string[];
  /** Default [width, height] in canvas px (8px grid). */
  size: [number, number];
  /** Minimum size when resizing. */
  minSize?: [number, number];
  /** A frame drawn behind other nodes (group node with `shape`), e.g. a C4 boundary or UML package. */
  frame?: boolean;
  /**
   * Label layout: 'center' inside the outline; 'top' title at top + body; 'compartments' (UML class-like:
   * name / fields sections); 'below' label under an icon figure (actor, person icon, events); 'table' (ERD).
   */
  layout: 'center' | 'top' | 'compartments' | 'below' | 'table';
  fields?: FieldSpec[];
  /**
   * Visual tone: 'default' neutral card; 'accent' tinted with the library accent (C4 internal elements);
   * 'external' muted (C4 external systems); 'filled' solid (UML initial state, BPMN end event).
   */
  tone?: 'default' | 'accent' | 'external' | 'filled';
  /** Aspect ratio is kept when resizing (circles, actors). */
  keepAspect?: boolean;
};

export type LibraryDef = {
  id: LibraryId;
  name: string;
  description: string;
  /** Edge routing used by default when connecting shapes of this library. */
  routing: 'bezier' | 'orthogonal' | 'straight';
  /** Relation preset used when connecting two shapes of this library without one. */
  defaultRelation: string;
};

export const LIBRARIES: LibraryDef[] = [
  { id: 'flowchart', name: 'Flowchart', description: 'Process flows and decision logic', routing: 'orthogonal', defaultRelation: 'flow.next' },
  { id: 'uml', name: 'UML', description: 'Class, component, use case, state and activity diagrams', routing: 'orthogonal', defaultRelation: 'uml.association' },
  { id: 'c4', name: 'C4', description: 'Software architecture: context, container and component views', routing: 'bezier', defaultRelation: 'c4.uses' },
  { id: 'erd', name: 'Entity relationship', description: 'Tables, columns and cardinality', routing: 'orthogonal', defaultRelation: 'erd.one-to-many' },
  { id: 'arch', name: 'Architecture', description: 'Services, data stores, queues and infrastructure', routing: 'bezier', defaultRelation: 'arch.calls' },
  { id: 'bpmn', name: 'BPMN', description: 'Business processes: tasks, events, gateways, pools and lanes', routing: 'orthogonal', defaultRelation: 'bpmn.sequence' },
];

const t = (key: string, label: string, placeholder?: string): FieldSpec => ({ key, label, kind: 'text', placeholder });
const l = (key: string, label: string, placeholder?: string): FieldSpec => ({ key, label, kind: 'lines', placeholder });

const C4_FIELDS = [t('technology', 'Technology', 'e.g. TypeScript, Node.js')];

export const SHAPES: ShapeDef[] = [
  // ---- flowchart ----
  { id: 'flowchart.process', library: 'flowchart', name: 'Process', description: 'A step or action', keywords: ['step', 'action', 'rectangle'], size: [176, 72], layout: 'center' },
  { id: 'flowchart.decision', library: 'flowchart', name: 'Decision', description: 'A yes/no or multi-way branch', keywords: ['if', 'branch', 'diamond', 'condition'], size: [176, 112], layout: 'center' },
  { id: 'flowchart.terminator', library: 'flowchart', name: 'Start / end', description: 'Where the flow begins or ends', keywords: ['start', 'end', 'stop', 'pill', 'terminal'], size: [160, 56], layout: 'center' },
  { id: 'flowchart.io', library: 'flowchart', name: 'Input / output', description: 'Data read or written', keywords: ['data', 'parallelogram', 'read', 'write'], size: [176, 72], layout: 'center' },
  { id: 'flowchart.document', library: 'flowchart', name: 'Document', description: 'A document or report', keywords: ['file', 'report', 'paper'], size: [176, 80], layout: 'center' },
  { id: 'flowchart.multi-document', library: 'flowchart', name: 'Documents', description: 'Several documents', keywords: ['files'], size: [176, 88], layout: 'center' },
  { id: 'flowchart.database', library: 'flowchart', name: 'Database', description: 'Stored data', keywords: ['db', 'cylinder', 'storage'], size: [128, 96], layout: 'center' },
  { id: 'flowchart.subprocess', library: 'flowchart', name: 'Subprocess', description: 'A predefined process described elsewhere', keywords: ['predefined', 'function', 'call'], size: [176, 72], layout: 'center' },
  { id: 'flowchart.manual-input', library: 'flowchart', name: 'Manual input', description: 'Input typed by a person', keywords: ['keyboard', 'form'], size: [176, 72], layout: 'center' },
  { id: 'flowchart.preparation', library: 'flowchart', name: 'Preparation', description: 'Setup or initialisation', keywords: ['hexagon', 'init', 'loop'], size: [176, 72], layout: 'center' },
  { id: 'flowchart.delay', library: 'flowchart', name: 'Delay', description: 'A wait or timeout', keywords: ['wait', 'timeout', 'sleep'], size: [144, 72], layout: 'center' },
  { id: 'flowchart.display', library: 'flowchart', name: 'Display', description: 'Output shown to a user', keywords: ['screen', 'ui'], size: [176, 72], layout: 'center' },
  { id: 'flowchart.connector', library: 'flowchart', name: 'Connector', description: 'Joins flow lines (on-page reference)', keywords: ['circle', 'jump', 'reference'], size: [48, 48], layout: 'center', keepAspect: true },
  { id: 'flowchart.off-page', library: 'flowchart', name: 'Off-page link', description: 'Continues on another page or canvas', keywords: ['pentagon', 'continue'], size: [64, 64], layout: 'center' },

  // ---- UML ----
  { id: 'uml.class', library: 'uml', name: 'Class', description: 'Name, attributes and operations', keywords: ['type', 'object'], size: [224, 160], minSize: [144, 72], layout: 'compartments', fields: [t('stereotype', 'Stereotype', 'e.g. entity'), l('attributes', 'Attributes', '- id: string'), l('methods', 'Operations', '+ charge(amount): Charge')] },
  { id: 'uml.interface', library: 'uml', name: 'Interface', description: 'A contract of operations', keywords: ['protocol', 'contract'], size: [224, 128], minSize: [144, 64], layout: 'compartments', fields: [l('methods', 'Operations', '+ charge(amount): Charge')] },
  { id: 'uml.enum', library: 'uml', name: 'Enumeration', description: 'A fixed set of values', keywords: ['enum', 'values'], size: [192, 128], minSize: [128, 64], layout: 'compartments', fields: [l('values', 'Values', 'PENDING')] },
  { id: 'uml.object', library: 'uml', name: 'Object', description: 'An instance with slot values', keywords: ['instance'], size: [208, 112], layout: 'compartments', fields: [l('attributes', 'Slots', 'status = "pending"')] },
  { id: 'uml.actor', library: 'uml', name: 'Actor', description: 'A person or external system that interacts', keywords: ['user', 'person', 'stick'], size: [80, 128], layout: 'below', keepAspect: true },
  { id: 'uml.use-case', library: 'uml', name: 'Use case', description: 'Something an actor can do', keywords: ['ellipse', 'goal'], size: [192, 88], layout: 'center' },
  { id: 'uml.component', library: 'uml', name: 'Component', description: 'A replaceable part of the system', keywords: ['module', 'part'], size: [208, 96], layout: 'top', fields: [t('stereotype', 'Stereotype', 'e.g. service')] },
  { id: 'uml.node', library: 'uml', name: 'Deployment node', description: 'Hardware or runtime environment', keywords: ['server', 'box', 'device', 'deployment'], size: [224, 128], layout: 'top', fields: [t('stereotype', 'Stereotype', 'e.g. device')] },
  { id: 'uml.package', library: 'uml', name: 'Package', description: 'Groups related elements (frame)', keywords: ['namespace', 'folder', 'module'], size: [480, 320], layout: 'top', frame: true },
  { id: 'uml.note', library: 'uml', name: 'Note', description: 'A comment attached to an element', keywords: ['comment'], size: [192, 96], layout: 'top' },
  { id: 'uml.state', library: 'uml', name: 'State', description: 'A state with optional entry/exit actions', keywords: ['status'], size: [176, 80], layout: 'compartments', fields: [l('actions', 'Actions', 'entry / start timer')] },
  { id: 'uml.initial', library: 'uml', name: 'Initial state', description: 'Where a state machine or activity starts', keywords: ['start', 'begin'], size: [32, 32], layout: 'center', keepAspect: true, tone: 'filled' },
  { id: 'uml.final', library: 'uml', name: 'Final state', description: 'Where a state machine or activity ends', keywords: ['end', 'stop'], size: [36, 36], layout: 'center', keepAspect: true, tone: 'filled' },
  { id: 'uml.choice', library: 'uml', name: 'Choice', description: 'A guarded branch', keywords: ['decision', 'diamond', 'branch'], size: [40, 40], layout: 'below', keepAspect: true },
  { id: 'uml.fork', library: 'uml', name: 'Fork / join', description: 'Splits or joins concurrent flows', keywords: ['bar', 'parallel', 'join'], size: [160, 12], minSize: [48, 8], layout: 'center', tone: 'filled' },
  { id: 'uml.activity', library: 'uml', name: 'Action', description: 'A step in an activity', keywords: ['step', 'activity'], size: [176, 64], layout: 'center' },

  // ---- C4 ----
  { id: 'c4.person', library: 'c4', name: 'Person', description: 'A user of the system', keywords: ['user', 'actor', 'customer'], size: [224, 176], layout: 'below', tone: 'accent' },
  { id: 'c4.person-external', library: 'c4', name: 'External person', description: 'A person outside the organisation', keywords: ['user', 'external'], size: [224, 176], layout: 'below', tone: 'external' },
  { id: 'c4.system', library: 'c4', name: 'Software system', description: 'The highest level of abstraction: delivers value to users', keywords: ['system', 'application'], size: [256, 152], layout: 'top', tone: 'accent' },
  { id: 'c4.system-external', library: 'c4', name: 'External system', description: 'A system you depend on but do not own', keywords: ['third party', 'external', 'saas'], size: [256, 152], layout: 'top', tone: 'external' },
  { id: 'c4.container', library: 'c4', name: 'Container', description: 'A deployable/runnable unit: app, service, database', keywords: ['app', 'service', 'api', 'spa'], size: [256, 152], layout: 'top', tone: 'accent', fields: C4_FIELDS },
  { id: 'c4.container-db', library: 'c4', name: 'Database container', description: 'A data store container', keywords: ['database', 'db', 'store', 'cylinder'], size: [240, 160], layout: 'center', tone: 'accent', fields: C4_FIELDS },
  { id: 'c4.container-queue', library: 'c4', name: 'Queue container', description: 'A message queue or topic', keywords: ['queue', 'topic', 'kafka', 'broker'], size: [256, 112], layout: 'center', tone: 'accent', fields: C4_FIELDS },
  { id: 'c4.container-web', library: 'c4', name: 'Web app container', description: 'A single-page or browser app', keywords: ['browser', 'spa', 'frontend', 'web'], size: [256, 152], layout: 'top', tone: 'accent', fields: C4_FIELDS },
  { id: 'c4.component', library: 'c4', name: 'Component', description: 'A grouping of code inside a container', keywords: ['module', 'controller', 'class'], size: [240, 136], layout: 'top', tone: 'accent', fields: C4_FIELDS },
  { id: 'c4.boundary', library: 'c4', name: 'Boundary', description: 'Enterprise, system or container boundary (frame)', keywords: ['scope', 'frame', 'group'], size: [640, 400], layout: 'top', frame: true },

  // ---- ERD ----
  { id: 'erd.entity', library: 'erd', name: 'Entity', description: 'A table: name and columns (mark keys with PK / FK)', keywords: ['table', 'model', 'schema'], size: [240, 176], minSize: [160, 64], layout: 'table', fields: [l('columns', 'Columns', 'id uuid PK')] },
  { id: 'erd.view', library: 'erd', name: 'View', description: 'A derived table', keywords: ['query', 'materialized'], size: [240, 144], minSize: [160, 64], layout: 'table', fields: [l('columns', 'Columns', 'order_id uuid')] },

  // ---- architecture ----
  { id: 'arch.service', library: 'arch', name: 'Service', description: 'An application or microservice', keywords: ['api', 'server', 'backend', 'microservice'], size: [192, 96], layout: 'top', fields: [t('technology', 'Technology')] },
  { id: 'arch.database', library: 'arch', name: 'Database', description: 'A relational or document database', keywords: ['db', 'sql', 'postgres', 'mongo'], size: [160, 120], layout: 'center', fields: [t('technology', 'Technology')] },
  { id: 'arch.cache', library: 'arch', name: 'Cache', description: 'An in-memory cache', keywords: ['redis', 'memcached'], size: [160, 96], layout: 'top', fields: [t('technology', 'Technology')] },
  { id: 'arch.queue', library: 'arch', name: 'Queue', description: 'A message queue or event stream', keywords: ['kafka', 'sqs', 'rabbitmq', 'topic', 'stream'], size: [208, 80], layout: 'center', fields: [t('technology', 'Technology')] },
  { id: 'arch.gateway', library: 'arch', name: 'API gateway', description: 'Entry point that routes requests', keywords: ['proxy', 'ingress', 'router'], size: [192, 96], layout: 'top', fields: [t('technology', 'Technology')] },
  { id: 'arch.load-balancer', library: 'arch', name: 'Load balancer', description: 'Distributes traffic across instances', keywords: ['lb', 'nginx', 'alb'], size: [176, 96], layout: 'top' },
  { id: 'arch.cdn', library: 'arch', name: 'CDN', description: 'Edge cache for static content', keywords: ['edge', 'cloudfront', 'static'], size: [160, 96], layout: 'top' },
  { id: 'arch.client', library: 'arch', name: 'Web client', description: 'A browser or web front end', keywords: ['browser', 'frontend', 'spa'], size: [176, 112], layout: 'top' },
  { id: 'arch.mobile', library: 'arch', name: 'Mobile app', description: 'An iOS or Android client', keywords: ['ios', 'android', 'phone'], size: [128, 160], layout: 'below' },
  { id: 'arch.function', library: 'arch', name: 'Function', description: 'A serverless function or job', keywords: ['lambda', 'serverless', 'cron', 'worker'], size: [176, 96], layout: 'top', fields: [t('technology', 'Technology')] },
  { id: 'arch.storage', library: 'arch', name: 'Object storage', description: 'Buckets and blobs', keywords: ['s3', 'bucket', 'blob', 'files'], size: [160, 112], layout: 'center' },
  { id: 'arch.user', library: 'arch', name: 'User', description: 'A person using the system', keywords: ['person', 'customer', 'actor'], size: [96, 128], layout: 'below', keepAspect: true },
  { id: 'arch.external', library: 'arch', name: 'External service', description: 'A third-party API', keywords: ['saas', 'third party', 'provider', 'stripe'], size: [192, 96], layout: 'top', tone: 'external', fields: [t('technology', 'Technology')] },
  { id: 'arch.region', library: 'arch', name: 'Region / cluster', description: 'Cloud region, VPC or cluster (frame)', keywords: ['vpc', 'cluster', 'k8s', 'zone', 'network'], size: [640, 400], layout: 'top', frame: true },

  // ---- BPMN ----
  { id: 'bpmn.task', library: 'bpmn', name: 'Task', description: 'A unit of work', keywords: ['activity', 'step'], size: [176, 80], layout: 'center' },
  { id: 'bpmn.subprocess', library: 'bpmn', name: 'Subprocess', description: 'A collapsed group of tasks', keywords: ['collapsed'], size: [176, 88], layout: 'center' },
  { id: 'bpmn.start', library: 'bpmn', name: 'Start event', description: 'Where the process starts', keywords: ['begin', 'trigger'], size: [48, 48], layout: 'below', keepAspect: true },
  { id: 'bpmn.intermediate', library: 'bpmn', name: 'Intermediate event', description: 'Something that happens during the process', keywords: ['timer', 'message', 'wait'], size: [48, 48], layout: 'below', keepAspect: true },
  { id: 'bpmn.end', library: 'bpmn', name: 'End event', description: 'Where the process ends', keywords: ['finish', 'stop'], size: [48, 48], layout: 'below', keepAspect: true, tone: 'filled' },
  { id: 'bpmn.gateway-exclusive', library: 'bpmn', name: 'Exclusive gateway', description: 'Exactly one path is taken (XOR)', keywords: ['xor', 'decision', 'diamond'], size: [56, 56], layout: 'below', keepAspect: true },
  { id: 'bpmn.gateway-parallel', library: 'bpmn', name: 'Parallel gateway', description: 'All paths are taken (AND)', keywords: ['and', 'fork', 'join'], size: [56, 56], layout: 'below', keepAspect: true },
  { id: 'bpmn.data-object', library: 'bpmn', name: 'Data object', description: 'Information used or produced', keywords: ['document', 'data'], size: [56, 72], layout: 'below' },
  { id: 'bpmn.pool', library: 'bpmn', name: 'Pool / lane', description: 'A participant or role (frame)', keywords: ['lane', 'swimlane', 'participant', 'role'], size: [800, 240], layout: 'top', frame: true },
];

export type RelationDef = {
  id: string;
  library: LibraryId;
  name: string;
  description: string;
  fromMarker?: EdgeMarker;
  toMarker: EdgeMarker;
  lineStyle?: 'solid' | 'dashed' | 'dotted';
  routing?: 'bezier' | 'orthogonal' | 'straight';
};

export const RELATIONS: RelationDef[] = [
  { id: 'flow.next', library: 'flowchart', name: 'Next', description: 'Control passes to the next step', toMarker: 'arrow', routing: 'orthogonal' },
  { id: 'uml.association', library: 'uml', name: 'Association', description: 'A structural link', toMarker: 'open-arrow', routing: 'orthogonal' },
  { id: 'uml.inheritance', library: 'uml', name: 'Inheritance', description: 'Is a (generalisation)', toMarker: 'triangle', routing: 'orthogonal' },
  { id: 'uml.realization', library: 'uml', name: 'Realization', description: 'Implements an interface', toMarker: 'triangle', lineStyle: 'dashed', routing: 'orthogonal' },
  { id: 'uml.dependency', library: 'uml', name: 'Dependency', description: 'Uses or depends on', toMarker: 'open-arrow', lineStyle: 'dashed', routing: 'orthogonal' },
  { id: 'uml.aggregation', library: 'uml', name: 'Aggregation', description: 'Has (shared ownership)', fromMarker: 'diamond', toMarker: 'none', routing: 'orthogonal' },
  { id: 'uml.composition', library: 'uml', name: 'Composition', description: 'Owns (lifecycle bound)', fromMarker: 'diamond-filled', toMarker: 'none', routing: 'orthogonal' },
  { id: 'uml.transition', library: 'uml', name: 'Transition', description: 'State or activity transition', toMarker: 'open-arrow', routing: 'bezier' },
  { id: 'c4.uses', library: 'c4', name: 'Uses', description: 'Relationship with a label and technology', toMarker: 'arrow', lineStyle: 'dashed', routing: 'bezier' },
  { id: 'erd.one-to-one', library: 'erd', name: 'One to one', description: 'Exactly one on each side', fromMarker: 'crow-one', toMarker: 'crow-one', routing: 'orthogonal' },
  { id: 'erd.one-to-many', library: 'erd', name: 'One to many', description: 'One parent, many children', fromMarker: 'crow-one', toMarker: 'crow-many', routing: 'orthogonal' },
  { id: 'erd.zero-to-many', library: 'erd', name: 'Optional one to many', description: 'Zero or one parent, many children', fromMarker: 'crow-zero-one', toMarker: 'crow-zero-many', routing: 'orthogonal' },
  { id: 'erd.many-to-many', library: 'erd', name: 'Many to many', description: 'Many on each side', fromMarker: 'crow-many', toMarker: 'crow-many', routing: 'orthogonal' },
  { id: 'arch.calls', library: 'arch', name: 'Calls', description: 'Synchronous request', toMarker: 'arrow', routing: 'bezier' },
  { id: 'arch.publishes', library: 'arch', name: 'Publishes', description: 'Asynchronous message or event', toMarker: 'arrow', lineStyle: 'dashed', routing: 'bezier' },
  { id: 'arch.reads', library: 'arch', name: 'Reads / writes', description: 'Data access', toMarker: 'arrow', lineStyle: 'dotted', routing: 'bezier' },
  { id: 'bpmn.sequence', library: 'bpmn', name: 'Sequence flow', description: 'Order of activities', toMarker: 'arrow', routing: 'orthogonal' },
  { id: 'bpmn.message', library: 'bpmn', name: 'Message flow', description: 'Message between participants', fromMarker: 'circle', toMarker: 'open-arrow', lineStyle: 'dashed', routing: 'orthogonal' },
];

const shapeIndex = new Map(SHAPES.map((s) => [s.id, s]));
const relationIndex = new Map(RELATIONS.map((r) => [r.id, r]));

export const shapeById = (id: string | undefined): ShapeDef | undefined => (id ? shapeIndex.get(id) : undefined);
export const relationById = (id: string | undefined): RelationDef | undefined => (id ? relationIndex.get(id) : undefined);
export const libraryById = (id: string | undefined): LibraryDef | undefined => LIBRARIES.find((x) => x.id === id);
export const shapesIn = (library: LibraryId): ShapeDef[] => SHAPES.filter((s) => s.library === library);
export const libraryOf = (shapeId: string | undefined): LibraryId | undefined => shapeById(shapeId)?.library;

/** Closest JSON Canvas end for a rich marker (written alongside it so other JSON Canvas tools still draw an end). */
export function markerToEnd(m: EdgeMarker | undefined): EdgeEnd | undefined {
  if (!m) return undefined;
  return m === 'none' || m.startsWith('crow-') || m === 'circle' || m.startsWith('diamond') ? 'none' : 'arrow';
}

/**
 * Relation to use between two shapes when none is given: the library default when both ends are shapes of the
 * same library, otherwise undefined (plain canvas edge).
 */
export function defaultRelation(fromShape: string | undefined, toShape: string | undefined): RelationDef | undefined {
  const a = libraryOf(fromShape);
  if (!a || a !== libraryOf(toShape)) return undefined;
  return relationById(libraryById(a)?.defaultRelation);
}

/** Every EdgeMarker value (for validation and MCP/JSON schemas). */
export const EDGE_MARKERS: readonly EdgeMarker[] = [
  'none', 'arrow', 'open-arrow', 'triangle', 'diamond', 'diamond-filled', 'circle',
  'crow-one', 'crow-zero-one', 'crow-many', 'crow-one-many', 'crow-zero-many',
];

/** The frame shape `canvas_add_diagram` wraps a library in by default (none for flowchart and erd). */
export const defaultFrameOf = (library: LibraryId): ShapeDef | undefined => SHAPES.find((s) => s.library === library && s.frame);
