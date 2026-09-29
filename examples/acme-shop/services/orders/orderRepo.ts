import { sequence } from '../shared/ids';
import { MemoryRepo } from '../shared/memoryRepo';
import type { Order } from './types';

export class OrderRepo extends MemoryRepo<Order> {
  forUser(userId: string): Order[] {
    return this.find((o) => o.userId === userId);
  }
}

export const orderRepo = new OrderRepo();
export const nextOrderId = sequence('order', 811);
