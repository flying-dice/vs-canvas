import type { Currency } from './types';

interface Base {
  at: number;
}

export type DomainEvent =
  | (Base & { type: 'order.placed'; orderId: string; total: number })
  | (Base & { type: 'order.cancelled'; orderId: string })
  | (Base & { type: 'payment.charged'; orderId: string; chargeId: string; amount: number; currency: Currency })
  | (Base & { type: 'payment.failed'; orderId: string; reason: string })
  | (Base & { type: 'stock.reserved'; orderId: string; sku: string; quantity: number })
  | (Base & { type: 'ledger.entry_written'; entryId: string; orderId: string })
  | (Base & { type: 'shipment.created'; orderId: string; trackingCode: string })
  | (Base & { type: 'review.submitted'; productId: string; rating: number })
  | (Base & { type: 'user.registered'; userId: string });

export type EventType = DomainEvent['type'];
export type EventOf<T extends EventType> = Extract<DomainEvent, { type: T }>;
