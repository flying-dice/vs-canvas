import { bus } from '../shared/eventBus';
import { orderRepo } from './orderRepo';

export function registerOrderSubscribers(): void {
  bus.subscribe('shipment.created', ({ orderId }) => {
    const order = orderRepo.get(orderId);
    if (order) orderRepo.save({ ...order, status: 'shipped' });
  });
}
