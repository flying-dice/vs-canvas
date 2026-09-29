import { MemoryRepo } from '../shared/memoryRepo';
import type { LedgerEntry } from './types';

export class LedgerRepo extends MemoryRepo<LedgerEntry> {
  forOrder(orderId: string): LedgerEntry[] {
    return this.find((e) => e.orderId === orderId);
  }

  forCharge(chargeId: string): LedgerEntry[] {
    return this.find((e) => e.chargeId === chargeId);
  }
}

export const ledgerRepo = new LedgerRepo();
