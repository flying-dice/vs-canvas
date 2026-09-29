import { reservationRepo, stockRepo } from './stockRepo';

export function releaseOrder(orderId: string): number {
  const held = reservationRepo.find((r) => r.orderId === orderId);
  for (const reservation of held) {
    const stock = stockRepo.findBySku(reservation.sku);
    if (stock) {
      stockRepo.save({ ...stock, reserved: Math.max(0, stock.reserved - reservation.quantity) });
    }
    reservationRepo.delete(reservation.id);
  }
  return held.length;
}
