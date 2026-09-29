import { request } from './client';

export interface PlaceOrderRequest {
  cartId: string;
}

export interface PlacedOrder {
  id: string;
  total: number;
  status: 'placed' | 'paid';
}

export function placeOrder(payload: PlaceOrderRequest): Promise<PlacedOrder> {
  return request<PlacedOrder>('POST', '/orders', payload);
}

export function listOrders(): Promise<PlacedOrder[]> {
  return request<PlacedOrder[]>('GET', '/orders');
}
