import type { Currency } from '../shared/types';

export interface QuoteLine {
  sku: string;
  quantity: number;
  unitPrice: number;
}

export interface Quote {
  lines: QuoteLine[];
  subtotal: number;
  discount: number;
  tax: number;
  shipping: number;
  total: number;
  currency: Currency;
}

export interface DiscountRule {
  code: string;
  percentOff: number;
  minSubtotal: number;
}
