// Demo board for `?demo=showcase` (standalone dev / Storybook-free visual QA): one of every new node kind.
// Layout is on the 8px grid: a service map (left), an investigation (middle), an order flow (bottom row).
import type { CanvasFile, CanvasFileNode, PortalPreview, ResolvedCode, ToWebview } from '../../../src/shared/protocol';

const rc = (file: string, firstLine: number, lines: string[], totalLines = 120): ResolvedCode => ({
  absPath: `/demo/acme-shop/${file}`,
  language: file.endsWith('.tsx') ? 'tsx' : 'typescript',
  firstLine,
  lines,
  totalLines,
});

const src = {
  checkout: rc('src/checkout/CheckoutButton.tsx', 12, [
    'export function CheckoutButton({ cartId }: Props) {',
    '  const pay = async () => {',
    "    await api.post('/orders', { cartId });",
    '  };',
    '  return <button onClick={pay}>Pay now</button>;',
    '}',
  ]),
  orders: rc('src/api/orders.ts', 55, [
    "router.post('/orders', async (req, res) => {",
    '  const order = await createOrder(req.body.cartId);',
    '  const charge = await retryCharge(order);',
    '  res.status(201).json({ order, charge });',
    '});',
  ]),
  charge: rc('src/payments/charge.ts', 28, [
    'export async function chargeCard(order: Order, opts: ChargeOpts) {',
    '  const body = { amount: order.total, cart: order.cartId };',
    '  // TODO: send an Idempotency-Key header',
    "  const res = await gateway.post('/charges', body, opts);",
    '  await ledger.write(toEntry(order, res));',
    '  return res.data;',
    '}',
  ]),
  retry: rc('src/payments/retry.ts', 44, [
    'export async function retryCharge(order: Order, attempt = 1) {',
    '  try {',
    '    return await chargeCard(order, { timeoutMs: 3000 });',
    '  } catch (err) {',
    '    if (isTimeout(err)) return retryCharge(order, attempt + 1);',
    '    throw err;',
    '  }',
    '}',
  ]),
  ledger: rc('src/ledger/write.ts', 8, [
    'export async function write(entry: LedgerEntry) {',
    "  await db.insert('ledger', entry);",
    "  metrics.increment('ledger.write');",
    '}',
  ]),
  reserve: rc('src/inventory/reserve.ts', 20, [
    'export async function reserveStock(sku: string, qty: number) {',
    '  const row = await db.stock.lock(sku);',
    '  if (row.available < qty) throw new OutOfStock(sku);',
    '  return db.stock.hold(sku, qty);',
    '}',
  ]),
  sync: rc('src/inventory/sync.ts', 5, [
    'export async function nightlySync() {',
    '  const feed = await warehouse.pull();',
    '  await db.stock.replaceAll(feed);',
    '}',
  ]),
  refund: rc('src/payments/refund.ts', 10, [
    'export async function refund(chargeId: string) {',
    "  return gateway.post(`/charges/${chargeId}/refund`);",
    '}',
  ]),
  session: rc('src/identity/session.ts', 14, [
    'export async function verifySession(token: string) {',
    '  const claims = await jwt.verify(token, KEY);',
    '  return users.get(claims.sub);',
    '}',
  ]),
};

const trace = [
  'Error: Charge created twice for order 812',
  '    at chargeCard (src/payments/charge.ts:31:11)',
  '    at retryCharge (src/payments/retry.ts:48:12)',
  '    at async processOrder (src/api/orders.ts:57:5)',
  '    at async Layer.handle (node_modules/express/lib/router/layer.js:95:5)',
  'Caused by: GatewayTimeout after 3000ms',
  '    at gateway.post (src/payments/gateway.ts:22:9)',
].join('\n');

const nodes: CanvasFileNode[] = [
  { id: 'title', type: 'text', variant: 'plain', text: '# acme-shop', x: -24, y: -152, width: 480, height: 64 },
  // service map
  { id: 'gA', type: 'group', label: 'Commerce', color: '6', x: -24, y: -64, width: 816, height: 368 },
  { id: 'gB', type: 'group', label: 'Platform', color: '6', x: -24, y: 352, width: 816, height: 368 },
  {
    id: 'svc-checkout', type: 'text', variant: 'service', title: 'Checkout', x: 0, y: 0, width: 360, height: 280,
    text: 'Cart, pay button and order creation. Everything a shopper touches between "Buy" and "Thank you".',
    tags: ['react', 'express', 'orders'],
    entryPoints: [
      { file: 'src/checkout/CheckoutButton.tsx', lines: [12, 17], label: 'Pay button' },
      { file: 'src/api/orders.ts', lines: [55, 59], label: 'POST /orders' },
    ],
  },
  {
    id: 'svc-payments', type: 'text', variant: 'service', title: 'Payments', x: 408, y: 0, width: 360, height: 280,
    text: 'Charges cards through the gateway, retries on timeout and writes the ledger.',
    tags: ['gateway', 'retry', 'ledger', 'pci'], canvas: 'canvases/payments.canvas.json',
    entryPoints: [
      { file: 'src/payments/charge.ts', lines: [28, 34], label: 'chargeCard' },
      { file: 'src/payments/retry.ts', lines: [44, 51], label: 'retryCharge' },
      { file: 'src/payments/refund.ts', lines: [10, 12], label: 'refund' },
    ],
  },
  {
    id: 'svc-inventory', type: 'text', variant: 'service', title: 'Inventory', x: 0, y: 416, width: 360, height: 280,
    text: 'Stock levels and reservations. Synced from the warehouse feed every night.',
    tags: ['postgres', 'cron'],
    entryPoints: [
      { file: 'src/inventory/reserve.ts', lines: [20, 24], label: 'reserveStock' },
      { file: 'src/inventory/sync.ts', lines: [5, 8], label: 'nightlySync' },
    ],
  },
  {
    id: 'svc-identity', type: 'text', variant: 'service', title: 'Identity', x: 408, y: 416, width: 360, height: 280,
    text: 'Sessions, tokens and user lookup.',
    tags: ['jwt', 'oauth', 'sessions'],
    entryPoints: [{ file: 'src/identity/session.ts', lines: [14, 17], label: 'verifySession' }],
  },
  { id: 'portal', type: 'file', file: 'canvases/payments.canvas.json', title: 'Payments internals', x: 864, y: 32, width: 336, height: 256 },
  // investigation
  { id: 'gInv', type: 'group', label: 'Why does checkout charge twice?', x: 1416, y: -64, width: 992, height: 784 },
  {
    id: 'log', type: 'text', variant: 'log', title: 'Stack trace, order 812', text: trace, errorLines: [1, 3, 6],
    x: 1440, y: 0, width: 520, height: 232,
  },
  {
    id: 'inv-retry', type: 'file', file: 'src/payments/retry.ts', display: 'code', lines: [44, 51], x: 1440, y: 296, width: 520, height: 184,
    title: 'Retry on timeout',
    highlights: [{ id: 'h1', start: 48, end: 48, color: '1', label: 'retry without idempotency key' }],
  },
  {
    id: 'inv-charge', type: 'file', file: 'src/payments/charge.ts', display: 'code', lines: [28, 34], x: 1440, y: 528, width: 520, height: 168,
    title: 'The charge',
    highlights: [{ id: 'h2', start: 30, end: 30, color: '3', label: 'missing key' }],
  },
  {
    id: 'f1', type: 'text', variant: 'finding', findingKind: 'hypothesis', status: 'ruled-out', title: 'Client double-submits',
    text: 'The pay button is disabled after the first click. Network log shows one POST /orders.', x: 2048, y: 0, width: 336, height: 168,
  },
  {
    id: 'f2', type: 'text', variant: 'finding', findingKind: 'hypothesis', status: 'confirmed', title: 'Retry on timeout re-sends the charge',
    text: 'The gateway timed out at 3s but had already charged. `retryCharge` sends a second request with no idempotency key.', x: 2048, y: 208, width: 336, height: 200,
  },
  {
    id: 'f3', type: 'text', variant: 'finding', findingKind: 'question', status: 'investigating', title: 'Does the ledger dedupe entries?',
    text: 'Two `LedgerEntry` rows exist for order 812. Checking for a unique constraint.', x: 2048, y: 448, width: 336, height: 184,
  },
  // order flow
  { id: 'gFlow', type: 'group', label: 'Order flow', x: -24, y: 1064, width: 3128, height: 280 },
  { id: 'fl-checkout', type: 'file', file: 'src/checkout/CheckoutButton.tsx', display: 'code', lines: [12, 17], x: 0, y: 1136, width: 520, height: 152 },
  { id: 'fl-orders', type: 'file', file: 'src/api/orders.ts', display: 'code', lines: [55, 59], x: 640, y: 1136, width: 520, height: 136 },
  { id: 'fl-charge', type: 'file', file: 'src/payments/charge.ts', display: 'code', lines: [28, 34], x: 1280, y: 1136, width: 520, height: 168 },
  { id: 'fl-retry', type: 'file', file: 'src/payments/retry.ts', display: 'code', lines: [44, 51], x: 1920, y: 1136, width: 520, height: 184 },
  { id: 'fl-ledger', type: 'file', file: 'src/ledger/write.ts', display: 'code', lines: [8, 11], x: 2560, y: 1136, width: 520, height: 112 },
  // Data layer beneath the logic: the order document as each step changed it.
  { id: 'fd-1', type: 'file', file: 'data/order.1.json', diffFrom: 'data/order.0.json', display: 'diff', x: 640, y: 1408, width: 520, height: 264 },
  { id: 'fd-2', type: 'file', file: 'data/order.2.json', diffFrom: 'data/order.1.json', display: 'diff', x: 1280, y: 1408, width: 520, height: 264 },
];

const canvas: CanvasFile = {
  nodes,
  edges: [
    { id: 's1', fromNode: 'svc-checkout', fromSide: 'right', toNode: 'svc-payments', toSide: 'left', label: 'charges' },
    { id: 's2', fromNode: 'svc-payments', fromSide: 'right', toNode: 'portal', toSide: 'left', label: 'internals' },
    { id: 's3', fromNode: 'svc-checkout', fromSide: 'bottom', toNode: 'svc-inventory', toSide: 'top', label: 'reserves stock' },
    { id: 's4', fromNode: 'svc-payments', fromSide: 'bottom', toNode: 'svc-identity', toSide: 'top', label: 'verifies user' },
    { id: 'i1', fromNode: 'log', fromSide: 'bottom', toNode: 'inv-retry', toSide: 'top', color: '1', label: 'failing frame' },
    { id: 'i2', fromNode: 'inv-retry', fromSide: 'bottom', toNode: 'inv-charge', toSide: 'top', label: 'calls' },
    { id: 'i3', fromNode: 'log', fromSide: 'right', toNode: 'f1', toSide: 'left' },
    { id: 'i4', fromNode: 'inv-retry', fromSide: 'right', toNode: 'f2', toSide: 'left', color: '4', label: 'evidence' },
    { id: 'i5', fromNode: 'inv-charge', fromSide: 'right', toNode: 'f3', toSide: 'left', color: '2' },
    { id: 'fe1', fromNode: 'fl-checkout', fromLine: 14, toNode: 'fl-orders', toSide: 'left', color: '5' },
    { id: 'fe2', fromNode: 'fl-orders', fromLine: 57, toNode: 'fl-charge', toSide: 'left', color: '5' },
    { id: 'fe3', fromNode: 'fl-charge', fromLine: 31, toNode: 'fl-retry', toSide: 'left', color: '5' },
    { id: 'fe4', fromNode: 'fl-retry', fromLine: 48, toNode: 'fl-ledger', toLine: 8, color: '5' },
    { id: 'fe5', fromNode: 'fl-retry', fromLine: 46, toNode: 'fl-ledger', toLine: 9, color: '5' },
    { id: 'fd-e1', fromNode: 'fl-orders', fromSide: 'bottom', toNode: 'fd-1', toSide: 'top', label: 'creates' },
    { id: 'fd-e2', fromNode: 'fl-charge', fromSide: 'bottom', toNode: 'fd-2', toSide: 'top', label: 'charges' },
  ],
  vsCanvas: {
    version: 1,
    title: 'acme-shop',
    kind: 'map',
    pinned: true,
    flows: [
      {
        id: 'order',
        title: 'Order to ledger',
        description: 'What happens after the shopper clicks pay.',
        steps: [
          { id: 's1', edge: 'fe1', caption: 'Shopper clicks pay', data: '{ cartId }', lines: [14, 14] },
          { id: 's2', edge: 'fe2', caption: 'The API creates the order', data: 'Order{ id: 812, total: 49.00 }', lines: [57, 57] },
          { id: 's3', edge: 'fe3', caption: 'The card is charged', data: "Charge{ status: 'pending' }", lines: [31, 31] },
          { id: 's4', edge: 'fe4', caption: 'The gateway times out, the retry fires', data: "Charge{ attempt: 1 }", lines: [48, 48], durationMs: 1400 },
          { id: 's5', edge: 'fe5', parallel: true, data: "Charge{ attempt: 2 }", durationMs: 1400 },
          { id: 's6', node: 'fl-ledger', caption: 'The ledger is written twice', data: 'LedgerEntry{ … } × 2', lines: [8, 9], durationMs: 1600 },
        ],
      },
      {
        id: 'refund',
        title: 'Refund',
        steps: [
          { id: 'r1', edge: 'fe3', caption: 'A refund reuses the charge path', data: 'Refund{ chargeId }' },
          { id: 'r2', node: 'fl-retry', caption: 'It is retried the same way', data: 'Refund{ attempt: 2 }' },
        ],
      },
    ],
  },
};

const json = (file: string, lines: string[]): ResolvedCode => ({
  absPath: `/demo/acme-shop/${file}`, language: 'json', firstLine: 1, lines, totalLines: lines.length,
});
const order0 = ['{', '  "id": 812,', '  "status": "new",', '  "items": [', '    { "sku": "A-1", "qty": 2 },', '    { "sku": "B-7", "qty": 1 }', '  ],', '  "total": 4900', '}'];
const order1 = ['{', '  "id": 812,', '  "status": "pending",', '  "items": [', '    { "sku": "A-1", "qty": 2 },', '    { "sku": "B-7", "qty": 1 }', '  ],', '  "total": 4900,', '  "currency": "EUR"', '}'];
const order2 = ['{', '  "id": 812,', '  "status": "paid",', '  "items": [', '    { "sku": "A-1", "qty": 2 },', '    { "sku": "B-7", "qty": 1 }', '  ],', '  "total": 4900,', '  "currency": "EUR",', '  "charges": ["ch_91x", "ch_91y"]', '}'];

const diffBase: Record<string, ResolvedCode> = {
  'fd-1': json('data/order.0.json', order0),
  'fd-2': json('data/order.1.json', order1),
};

const code: Record<string, ResolvedCode> = {
  'fd-1': json('data/order.1.json', order1),
  'fd-2': json('data/order.2.json', order2),
  'inv-retry': src.retry,
  'inv-charge': src.charge,
  'fl-checkout': src.checkout,
  'fl-orders': src.orders,
  'fl-charge': src.charge,
  'fl-retry': src.retry,
  'fl-ledger': src.ledger,
};

const entryCode: Record<string, ResolvedCode> = {
  'svc-checkout#0': src.checkout,
  'svc-checkout#1': src.orders,
  'svc-payments#0': src.charge,
  'svc-payments#1': src.retry,
  'svc-payments#2': src.refund,
  'svc-inventory#0': src.reserve,
  'svc-inventory#1': src.sync,
  'svc-identity#0': src.session,
};

const r = (x: number, y: number, width: number, height: number, type = 'file', color?: string) => ({ x, y, width, height, type, color });
const portals: Record<string, PortalPreview> = {
  portal: {
    title: 'Payments internals',
    kind: 'map',
    nodeCount: 9,
    rects: [
      r(0, 0, 900, 520, 'group', '6'),
      r(40, 60, 240, 160, 'file'),
      r(340, 60, 240, 160, 'file', '1'),
      r(640, 60, 220, 160, 'file'),
      r(40, 300, 240, 160, 'text'),
      r(340, 300, 240, 160, 'file', '3'),
      r(640, 300, 220, 160, 'text', '4'),
      r(1000, 60, 240, 160, 'file'),
      r(1000, 300, 240, 160, 'text', '2'),
    ],
  },
};

export function showcaseDocument(): Extract<ToWebview, { type: 'document' }> {
  return {
    type: 'document',
    canvas,
    code,
    diffBase,
    entryCode,
    portals,
    canvasPath: 'canvases/acme-shop.canvas.json',
    breadcrumbs: [
      { path: 'canvases/acme-shop.canvas.json', title: 'acme-shop' },
      { path: 'canvases/checkout.canvas.json', title: 'Checkout' },
      { path: 'canvases/acme-shop.canvas.json', title: 'Double charge' },
    ],
  };
}
