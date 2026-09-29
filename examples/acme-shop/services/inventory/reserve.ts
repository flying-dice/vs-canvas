import { bus } from '../shared/eventBus';
import { ConflictError, NotFoundError } from '../shared/errors';
import { systemClock } from '../shared/clock';
import { config } from '../shared/config';
import { prefixedId } from '../shared/ids';
import { reservationRepo, stockRepo } from './stockRepo';
import type { Reservation } from './types';

export async function reserveStock(orderId: string, sku: string, quantity: number): Promise<Reservation> {
  const stock = stockRepo.findBySku(sku);
  if (!stock) throw new NotFoundError('stock', sku);
  if (stock.onHand - stock.reserved < quantity) {
    throw new ConflictError(`insufficient stock for ${sku}`);
  }
  stockRepo.save({ ...stock, reserved: stock.reserved + quantity });
  const reservation = reservationRepo.save({
    id: prefixedId('rsv'),
    orderId,
    sku,
    quantity,
    expiresAt: systemClock.now() + config.inventory.reservationTtlMs,
  });
  await bus.publish({ type: 'stock.reserved', orderId, sku, quantity, at: systemClock.now() });
  return reservation;
}
