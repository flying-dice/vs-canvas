import { getProductBySku } from '../catalog';
import { ValidationError } from '../shared/errors';
import { roundMoney } from '../shared/types';
import { applyDiscount } from './discounts';
import { maxQuantityPerLine, shippingFor } from './rules';
import { calculateTax } from './tax';
import type { Quote, QuoteLine } from './types';

export interface QuoteInput {
  items: { sku: string; quantity: number }[];
  region: string;
  discountCode?: string;
}

export function buildQuote(input: QuoteInput): Quote {
  const lines: QuoteLine[] = input.items.map((item) => {
    if (item.quantity > maxQuantityPerLine()) {
      throw new ValidationError(`quantity for ${item.sku} exceeds limit`);
    }
    const product = getProductBySku(item.sku);
    return { sku: item.sku, quantity: item.quantity, unitPrice: product.price };
  });

  const subtotal = roundMoney(lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0));
  const discount = applyDiscount(subtotal, input.discountCode);
  const tax = calculateTax(subtotal - discount, input.region);
  const shipping = shippingFor(subtotal - discount);
  const total = roundMoney(subtotal - discount + tax + shipping);

  return { lines, subtotal, discount, tax, shipping, total, currency: 'USD' };
}
