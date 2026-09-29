import { getCart, clearCart } from '../checkout';
import { reserveStock } from '../inventory';
import { getDefaultCard } from '../identity';
import { chargeOrder } from '../payments';
import { buildQuote } from '../pricing';
import { bus } from '../shared/eventBus';
import { systemClock } from '../shared/clock';
import { ValidationError } from '../shared/errors';
import { createLogger } from '../shared/logger';
import { nextOrderId, orderRepo } from './orderRepo';
import type { Order, PlaceOrderInput } from './types';

const log = createLogger('orders');

export async function placeOrder(input: PlaceOrderInput): Promise<Order> {
  const cart = getCart(input.cartId);
  if (cart.items.length === 0) throw new ValidationError('cart is empty');

  const quote = buildQuote({ items: cart.items, region: cart.region, discountCode: cart.discountCode });
  const order = orderRepo.save({
    id: nextOrderId(),
    userId: input.userId,
    cartId: cart.id,
    lines: quote.lines,
    total: quote.total,
    currency: quote.currency,
    status: 'placed',
    createdAt: systemClock.now(),
  });

  for (const line of quote.lines) {
    await reserveStock(order.id, line.sku, line.quantity);
  }

  const charge = await chargeOrder({
    orderId: order.id,
    total: order.total,
    currency: order.currency,
    card: getDefaultCard(input.userId),
  });

  const paid = orderRepo.save({ ...order, status: 'paid', chargeId: charge.id });
  clearCart(cart.id);
  await bus.publish({ type: 'order.placed', orderId: paid.id, total: paid.total, at: systemClock.now() });
  log.info('order placed', { orderId: paid.id, total: paid.total });
  return paid;
}
