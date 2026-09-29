import { MemoryRepo } from '../shared/memoryRepo';
import type { Reservation, StockRecord } from './types';

export class StockRepo extends MemoryRepo<StockRecord> {
  findBySku(sku: string): StockRecord | undefined {
    return this.all().find((s) => s.sku === sku);
  }
}

export const stockRepo = new StockRepo();
export const reservationRepo = new MemoryRepo<Reservation>();

[
  { id: 's1', sku: 'MUG-BLK', onHand: 120, reserved: 0 },
  { id: 's2', sku: 'TEE-NVY-M', onHand: 60, reserved: 0 },
  { id: 's3', sku: 'BTL-STL', onHand: 300, reserved: 0 },
].forEach((s) => stockRepo.save(s));
