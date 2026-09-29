# acme-shop

A small but realistic TypeScript e-commerce codebase used to record the VS Canvas product videos
(see `../../MEDIA.md`). Fourteen backend domains under `services/` (`checkout`, `payments`, `inventory`,
`identity`, `notifications`, `orders`, `catalog`, `pricing`, `shipping`, `ledger`, `search`, `reviews`,
`gateway`, `shared`) and a tiny React-style frontend in `web/`. Everything is in-memory and has
no external dependencies.

Type-check from the VS Canvas repo root:

    npx -p typescript@5.9 tsc -p examples/acme-shop --noEmit

## The planted bug

`services/payments/retry.ts:48` retries a charge after a provider timeout, but calls
`provider.charge({ amount, card })` without an idempotency key. If the provider is slow (it processed the
charge but answered after our 8s timeout), the retry creates a second charge. `payments/charge.ts` builds an
`idempotencyKey` but never passes it down. The customer report and logs are in `fixtures/stacktrace.txt`.

## The hero flow

| Hop | Location | Payload |
| --- | --- | --- |
| Pay button | `web/components/CheckoutButton.tsx:18` | `{ cartId }` |
| API client | `web/api/orders.ts:14` | `POST /orders` |
| Gateway | `services/gateway/routes/orders.ts:12` (routed at `router.ts:20`) | `Order{ id, total }` |
| Place order | `services/orders/placeOrder.ts:35` | |
| Charge | `services/payments/charge.ts:52` | `Charge{ status: 'pending' }` |
| Retry | `services/payments/retry.ts:48` | |
| Ledger | `services/ledger/write.ts:11` (called at `retry.ts:54`) | `LedgerEntry{ ... }` |

## Suggested prompts

- `Map this repo's domains and pin it.`
- Paste `fixtures/stacktrace.txt`, then: `Why does checkout charge twice? Build an investigation board.`
- `Show how an order flows from the pay button to the ledger.`
