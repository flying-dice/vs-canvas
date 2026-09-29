// Shared fixtures for stories: a tiny regex tokenizer (dark/light palettes) and the acme-shop snippets.
import type { ResolvedCode } from '../../../src/shared/protocol';
import type { Token } from './atoms/CodeText.svelte';
import type { EntrySnippet } from './organisms/ServiceCard.svelte';

const pal = {
  dark: { kw: '#569cd6', str: '#ce9178', cm: '#6a9955', fn: '#dcdcaa', num: '#b5cea8' },
  light: { kw: '#0000ff', str: '#a31515', cm: '#008000', fn: '#795e26', num: '#098658' },
};
const KW = /^(export|async|function|const|let|return|await|if|throw|try|catch|new|import|from|await)\b/;

export function tokenizeLine(line: string, mode: 'dark' | 'light' = 'dark'): Token[] {
  const p = pal[mode];
  const out: Token[] = [];
  let i = 0;
  const push = (content: string, color?: string) => content && out.push({ content, color });
  while (i < line.length) {
    const rest = line.slice(i);
    let m: RegExpExecArray | null;
    if ((m = /^\/\/.*/.exec(rest))) (push(m[0], p.cm), (i += m[0].length));
    else if ((m = /^(['"`])(?:\\.|(?!\1).)*\1/.exec(rest))) (push(m[0], p.str), (i += m[0].length));
    else if ((m = KW.exec(rest))) (push(m[0], p.kw), (i += m[0].length));
    else if ((m = /^\d+/.exec(rest))) (push(m[0], p.num), (i += m[0].length));
    else if ((m = /^[A-Za-z_$][\w$]*(?=\()/.exec(rest))) (push(m[0], p.fn), (i += m[0].length));
    else if ((m = /^[A-Za-z_$][\w$]*/.exec(rest))) (push(m[0]), (i += m[0].length));
    else (push(rest[0]), i++);
  }
  return out;
}

export const tokenizeAll = (lines: string[], mode: 'dark' | 'light' = 'dark'): Token[][] => lines.map((l) => tokenizeLine(l, mode));

const code = (file: string, firstLine: number, lines: string[]): ResolvedCode => ({
  absPath: `/demo/${file}`, language: 'typescript', firstLine, lines, totalLines: 120,
});

export const retryCode = code('src/payments/retry.ts', 44, [
  'export async function retryCharge(order: Order, attempt = 1) {',
  '  try {',
  '    return await chargeCard(order, { timeoutMs: 3000 });',
  '  } catch (err) {',
  '    if (isTimeout(err)) return retryCharge(order, attempt + 1);',
  '    throw err;',
  '  }',
  '}',
]);
export const chargeCode = code('src/payments/charge.ts', 28, [
  'export async function chargeCard(order: Order, opts: ChargeOpts) {',
  '  const body = { amount: order.total, cart: order.cartId };',
  '  // TODO: send an Idempotency-Key header',
  "  const res = await gateway.post('/charges', body, opts);",
  '  await ledger.write(toEntry(order, res));',
  '  return res.data;',
  '}',
]);
export const refundCode = code('src/payments/refund.ts', 10, [
  'export async function refund(chargeId: string) {',
  "  return gateway.post(`/charges/${chargeId}/refund`);",
  '}',
]);

export const snippets = (mode: 'dark' | 'light' = 'dark'): EntrySnippet[] =>
  [chargeCode, retryCode, refundCode].map((c) => ({ code: c, tokens: tokenizeAll(c.lines, mode) }));

export const stackTrace = [
  'Error: Charge created twice for order 812',
  '    at chargeCard (src/payments/charge.ts:31:11)',
  '    at retryCharge (src/payments/retry.ts:48:12)',
  '    at async processOrder (src/api/orders.ts:57:5)',
  '    at async Layer.handle (node_modules/express/lib/router/layer.js:95:5)',
  'Caused by: GatewayTimeout after 3000ms',
  '    at gateway.post (src/payments/gateway.ts:22:9)',
].join('\n');
