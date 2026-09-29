import { NotFoundError } from '../shared/errors';
import { orderRepo } from './orderRepo';
import type { Order } from './types';

export function getOrder(orderId: string, userId: string): Order {
  const order = orderRepo.get(orderId);
  if (!order || order.userId !== userId) throw new NotFoundError('order', orderId);
  return order;
}

export function listOrders(userId: string): Order[] {
  return orderRepo.forUser(userId).sort((a, b) => b.createdAt - a.createdAt);
}
