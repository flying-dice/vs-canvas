import { MemoryRepo } from '../shared/memoryRepo';
import type { Cart } from './types';

export class CartRepo extends MemoryRepo<Cart> {
  findByUser(userId: string): Cart | undefined {
    return this.all().find((c) => c.userId === userId);
  }
}

export const cartRepo = new CartRepo();

cartRepo.save({
  id: 'cart_812',
  userId: 'u_204',
  items: [
    { sku: 'TEE-NVY-M', quantity: 1 },
    { sku: 'MUG-BLK', quantity: 1 },
    { sku: 'BTL-STL', quantity: 1 },
  ],
  region: 'WA',
  updatedAt: 1_700_000_000_000,
});
