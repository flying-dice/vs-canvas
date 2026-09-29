export function orderConfirmation(orderId: string, total: number): { subject: string; body: string } {
  return {
    subject: `Order #${orderId} confirmed`,
    body: `Thanks for shopping with Acme. We received your order #${orderId} totalling $${total.toFixed(2)}.`,
  };
}

export function shipmentNotice(orderId: string, trackingCode: string): { subject: string; body: string } {
  return {
    subject: `Order #${orderId} is on its way`,
    body: `Track your parcel with code ${trackingCode}.`,
  };
}
