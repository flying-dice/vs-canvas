import { ValidationError } from '../shared/errors';
import { createLogger } from '../shared/logger';
import { getCart } from './cart';
import { cartTotals } from './totals';

const log = createLogger('checkout');

export function startCheckout(cartId: string) {
  const cart = getCart(cartId);
  if (cart.items.length === 0) throw new ValidationError('cart is empty');
  const quote = cartTotals(cartId);
  log.info('checkout started', { cartId, total: quote.total });
  return { cartId, quote };
}
