import { MemoryRepo } from '../shared/memoryRepo';
import type { Charge } from './types';

export class ChargeRepo extends MemoryRepo<Charge> {
  findByKey(idempotencyKey: string): Charge | undefined {
    return this.all().find((c) => c.idempotencyKey === idempotencyKey);
  }

  forOrder(orderId: string): Charge[] {
    return this.find((c) => c.orderId === orderId);
  }
}

export const chargeRepo = new ChargeRepo();
