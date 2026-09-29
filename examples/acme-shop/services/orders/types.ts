import type { Currency } from '../shared/types';
import type { QuoteLine } from '../pricing';

export type OrderStatus = 'placed' | 'paid' | 'shipped' | 'cancelled';

export interface Order {
  id: string;
  userId: string;
  cartId: string;
  lines: QuoteLine[];
  total: number;
  currency: Currency;
  status: OrderStatus;
  chargeId?: string;
  createdAt: number;
}

export interface PlaceOrderInput {
  cartId: string;
  userId: string;
}
