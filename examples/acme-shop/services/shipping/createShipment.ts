import { bus } from '../shared/eventBus';
import { systemClock } from '../shared/clock';
import { prefixedId } from '../shared/ids';
import { MemoryRepo } from '../shared/memoryRepo';
import { cheapest } from './rates';
import type { Address, Shipment } from './types';

export const shipmentRepo = new MemoryRepo<Shipment>();

export async function createShipment(orderId: string, address: Address, weightKg: number): Promise<Shipment> {
  const rate = cheapest(weightKg);
  const shipment = shipmentRepo.save({
    id: prefixedId('shp'),
    orderId,
    carrier: rate.carrier,
    trackingCode: prefixedId('trk').toUpperCase(),
    address,
    createdAt: systemClock.now(),
  });
  await bus.publish({ type: 'shipment.created', orderId, trackingCode: shipment.trackingCode, at: shipment.createdAt });
  return shipment;
}
