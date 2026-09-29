import { releaseOrder } from '../inventory';
import { refundCharge } from '../payments';
import { bus } from '../shared/eventBus';
import { systemClock } from '../shared/clock';
import { ConflictError } from '../shared/errors';
import { getOrder } from './getOrder';
import { orderRepo } from './orderRepo';
import type { Order } from './types';

export async function cancelOrder(orderId: string, userId: string): Promise<Order> {
  const order = getOrder(orderId, userId);
  if (order.status === 'shipped') throw new ConflictError('order already shipped');
  if (order.chargeId) await refundCharge(order.chargeId);
  releaseOrder(order.id);
  const cancelled = orderRepo.save({ ...order, status: 'cancelled' });
  await bus.publish({ type: 'order.cancelled', orderId: order.id, at: systemClock.now() });
  return cancelled;
}
