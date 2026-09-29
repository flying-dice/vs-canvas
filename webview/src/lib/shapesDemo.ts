// Demo board for `?demo=shapes`: one diagram per shape library, drawn with the real relations, sublabels and routing.
//   C4 container diagram (bezier, dashed "uses" relations with [technology] sublabels) inside a c4.boundary
//   Flowchart: checkout retry logic (orthogonal)         UML class diagram (orthogonal)
//   ERD with crow's foot (orthogonal)                    Architecture sketch inside an arch.region (bezier)
import type { CanvasFile, CanvasFileEdge, CanvasFileNode, Side, ToWebview } from '../../../src/shared/protocol';
import { markerToEnd, relationById, shapeById } from '../../../src/shared/shapes';

type Opts = { w?: number; h?: number; fields?: Record<string, string | string[]>; color?: string };

const nodes: CanvasFileNode[] = [];
const edges: CanvasFileEdge[] = [];

/** A shape node at its default size (override with w / h). */
function shape(id: string, shapeId: string, x: number, y: number, text: string, o: Opts = {}) {
  const def = shapeById(shapeId)!;
  nodes.push({
    id, type: 'text', variant: 'shape', shape: shapeId, text, x, y,
    width: o.w ?? def.size[0], height: o.h ?? def.size[1],
    ...(o.fields ? { fields: o.fields } : {}),
    ...(o.color ? { color: o.color } : {}),
  });
}
function frame(id: string, shapeId: string, x: number, y: number, w: number, h: number, label: string, sublabel?: string) {
  nodes.push({ id, type: 'group', shape: shapeId, label, ...(sublabel ? { sublabel } : {}), x, y, width: w, height: h });
}
function title(id: string, x: number, y: number, text: string, w = 640) {
  nodes.push({ id, type: 'text', variant: 'plain', text, x, y, width: w, height: 48 });
}
/** An edge carrying its relation preset, the way the host writes it. */
function link(id: string, from: string, fromSide: Side, to: string, toSide: Side, relation: string, extra: Partial<CanvasFileEdge> = {}) {
  const r = relationById(relation)!;
  edges.push({
    id, fromNode: from, fromSide, toNode: to, toSide, relation,
    ...(r.fromMarker ? { fromMarker: r.fromMarker } : {}),
    toMarker: r.toMarker,
    fromEnd: markerToEnd(r.fromMarker) ?? 'none',
    toEnd: markerToEnd(r.toMarker) ?? 'none',
    ...(r.lineStyle ? { lineStyle: r.lineStyle } : {}),
    ...(r.routing ? { routing: r.routing } : {}),
    ...extra,
  });
}

// ---------------------------------------------------------------- C4 container diagram
title('t-c4', 0, -80, '# Container diagram: acme shop');
shape('c4-person', 'c4.person', 0, 80, 'Shopper\nBuys things from the shop', { h: 184 });
frame('c4-boundary', 'c4.boundary', 384, 0, 1280, 560, 'Acme shop', 'Software System');
shape('c4-web', 'c4.container-web', 448, 96, 'Web app\nLets shoppers browse and check out', { fields: { technology: 'React, TypeScript' } });
shape('c4-api', 'c4.container', 896, 96, 'Orders API\nCreates orders and charges cards', { fields: { technology: 'Node.js, Express' } });
shape('c4-db', 'c4.container-db', 592, 336, 'Orders database\nOrders, charges and ledger', { fields: { technology: 'PostgreSQL' } });
shape('c4-queue', 'c4.container-queue', 1216, 336, 'Charge queue\nRetries failed charges', { fields: { technology: 'RabbitMQ' } });
shape('c4-pay', 'c4.system-external', 1792, 96, 'Payment provider\nTakes card payments');
link('c4-e1', 'c4-person', 'right', 'c4-web', 'left', 'c4.uses', { label: 'Pays with', sublabel: 'HTTPS' });
link('c4-e2', 'c4-web', 'right', 'c4-api', 'left', 'c4.uses', { label: 'Makes API calls to', sublabel: 'JSON/HTTPS' });
link('c4-e3', 'c4-api', 'bottom', 'c4-db', 'top', 'c4.uses', { label: 'Reads from and writes to', sublabel: 'SQL/TCP' });
link('c4-e4', 'c4-api', 'bottom', 'c4-queue', 'top', 'c4.uses', { label: 'Publishes charges to', sublabel: 'AMQP' });
link('c4-e5', 'c4-api', 'right', 'c4-pay', 'left', 'c4.uses', { label: 'Charges cards with', sublabel: 'JSON/HTTPS' });

// ---------------------------------------------------------------- flowchart
title('t-fc', 0, 704, '# Checkout: retry on timeout');
shape('fc-start', 'flowchart.terminator', 0, 848, 'Shopper pays');
shape('fc-charge', 'flowchart.process', 240, 840, 'Charge the card');
shape('fc-timeout', 'flowchart.decision', 512, 820, 'Timed out?');
shape('fc-wait', 'flowchart.delay', 528, 1016, 'Wait 2 s, retry');
shape('fc-ledger', 'flowchart.subprocess', 816, 840, 'Write ledger entry');
shape('fc-end', 'flowchart.terminator', 1096, 848, 'Order confirmed');
link('fc-e1', 'fc-start', 'right', 'fc-charge', 'left', 'flow.next');
link('fc-e2', 'fc-charge', 'right', 'fc-timeout', 'left', 'flow.next');
link('fc-e3', 'fc-timeout', 'right', 'fc-ledger', 'left', 'flow.next', { label: 'no' });
link('fc-e4', 'fc-timeout', 'bottom', 'fc-wait', 'top', 'flow.next', { label: 'yes' });
link('fc-e5', 'fc-wait', 'left', 'fc-charge', 'bottom', 'flow.next');
link('fc-e6', 'fc-ledger', 'right', 'fc-end', 'left', 'flow.next');

// ---------------------------------------------------------------- UML class diagram
title('t-uml', 1600, 704, '# Payments domain model');
shape('u-order', 'uml.class', 1600, 808, 'Order', {
  h: 160,
  fields: {
    attributes: ['- id: string', '- total: Money', '- status: OrderStatus'],
    methods: ['+ addItem(item: Item)', '+ pay(): Charge'],
  },
});
shape('u-charge', 'uml.class', 2032, 808, 'Charge', {
  h: 160,
  fields: {
    attributes: ['- id: string', '- amount: Money', '- attempt: number'],
    methods: ['+ retry(): Charge'],
  },
});
shape('u-provider', 'uml.interface', 2016, 1080, 'PaymentProvider', { w: 256, fields: { methods: ['+ charge(amount: Money): Receipt', '+ refund(id: string)'] } });
shape('u-stripe', 'uml.class', 1600, 1080, 'StripeGateway', { w: 256, h: 128, fields: { attributes: ['- apiKey: string'], methods: ['+ charge(amount: Money): Receipt'] } });
link('u-e1', 'u-order', 'right', 'u-charge', 'left', 'uml.composition', { label: 'charges' });
link('u-e2', 'u-charge', 'bottom', 'u-provider', 'top', 'uml.association', { label: 'uses' });
link('u-e3', 'u-stripe', 'right', 'u-provider', 'left', 'uml.realization');

// ---------------------------------------------------------------- ERD
title('t-erd', 0, 1384, '# Ledger schema');
shape('erd-orders', 'erd.entity', 0, 1480, 'orders', {
  fields: { columns: ['id uuid PK', 'customer_id uuid FK', 'total numeric(12,2)', 'status text', 'created_at timestamptz'] },
});
shape('erd-charges', 'erd.entity', 400, 1480, 'charges', {
  fields: { columns: ['id uuid PK', 'order_id uuid FK', 'amount numeric(12,2)', 'status text', 'attempt int', 'idempotency_key text UNIQUE'] },
});
shape('erd-ledger', 'erd.entity', 800, 1480, 'ledger_entries', {
  fields: { columns: ['id uuid PK', 'charge_id uuid FK', 'entry_type text', 'amount numeric(12,2)', 'posted_at timestamptz'] },
});
link('erd-e1', 'erd-orders', 'right', 'erd-charges', 'left', 'erd.one-to-many', { label: 'has' });
link('erd-e2', 'erd-charges', 'right', 'erd-ledger', 'left', 'erd.zero-to-many', { label: 'posts' });

// ---------------------------------------------------------------- architecture sketch
title('t-arch', 1296, 1256, '# Request path in eu-west-1');
frame('a-region', 'arch.region', 1296, 1328, 1184, 528, 'eu-west-1', 'AWS region');
shape('a-user', 'arch.user', 1120, 1520, 'Shopper');
shape('a-lb', 'arch.load-balancer', 1344, 1504, 'Load balancer');
shape('a-api', 'arch.service', 1632, 1424, 'Orders API', { fields: { technology: 'Node.js' } });
shape('a-db', 'arch.database', 1968, 1392, 'Orders DB', { fields: { technology: 'PostgreSQL' } });
shape('a-queue', 'arch.queue', 1632, 1648, 'charge-jobs', { fields: { technology: 'SQS' } });
shape('a-worker', 'arch.function', 1968, 1640, 'Charge worker', { fields: { technology: 'Lambda' } });
shape('a-ext', 'arch.external', 2560, 1640, 'Payment provider', { fields: { technology: 'REST' } });
link('a-e1', 'a-user', 'right', 'a-lb', 'left', 'arch.calls', { label: 'HTTPS' });
link('a-e2', 'a-lb', 'right', 'a-api', 'left', 'arch.calls');
link('a-e3', 'a-api', 'right', 'a-db', 'left', 'arch.reads', { label: 'reads / writes' });
link('a-e4', 'a-api', 'bottom', 'a-queue', 'top', 'arch.publishes', { label: 'publishes' });
link('a-e5', 'a-queue', 'right', 'a-worker', 'left', 'arch.publishes', { label: 'triggers' });
link('a-e6', 'a-worker', 'right', 'a-ext', 'left', 'arch.calls', { label: 'charges' });

const canvas: CanvasFile = {
  nodes,
  edges,
  vsCanvas: { version: 1, title: 'Shapes', kind: 'map', description: 'One diagram per shape library.' },
};

export function shapesDocument(): Extract<ToWebview, { type: 'document' }> {
  return { type: 'document', canvas, code: {}, canvasPath: 'canvases/shapes.canvas.json' };
}
