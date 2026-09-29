import { buildQuote } from '../pricing';
import type { Quote } from '../pricing';
import { getCart } from './cart';

export function cartTotals(cartId: string): Quote {
  const cart = getCart(cartId);
  return buildQuote({
    items: cart.items,
    region: cart.region,
    discountCode: cart.discountCode,
  });
}
