import { getUser } from '../identity';
import { getOrder } from '../orders';
import { bus } from '../shared/eventBus';
import { sendNotification } from './send';
import { orderConfirmation, shipmentNotice } from './templates';
import { orderRepo } from '../orders/orderRepo';

export function registerNotificationSubscribers(): void {
  bus.subscribe('order.placed', ({ orderId, total }) => {
    const order = orderRepo.get(orderId);
    if (!order) return;
    getUser(order.userId);
    sendNotification(order.userId, 'email', orderConfirmation(orderId, total));
  });

  bus.subscribe('shipment.created', ({ orderId, trackingCode }) => {
    const order = orderRepo.get(orderId);
    if (order) sendNotification(order.userId, 'push', shipmentNotice(getOrder(orderId, order.userId).id, trackingCode));
  });
}
