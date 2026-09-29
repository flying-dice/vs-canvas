import { getOrder, listOrders, placeOrder } from '../../orders';
import { ValidationError } from '../../shared/errors';
import { json } from '../../shared/http';
import type { ApiRequest } from '../../shared/http';
import { requireString } from '../../shared/validate';
import { authenticate } from '../middleware/auth';

export async function handlePlaceOrder(raw: ApiRequest<{ cartId?: string }>) {
  const req = authenticate(raw);
  const cartId = requireString(req.body?.cartId, 'cartId');
  if (!req.userId) throw new ValidationError('missing user');
  const order = await placeOrder({ cartId, userId: req.userId });
  return json({ id: order.id, total: order.total, status: order.status }, 201);
}

export async function handleGetOrder(raw: ApiRequest) {
  const req = authenticate(raw);
  return json(getOrder(req.params.id, req.userId ?? ''));
}

export async function handleListOrders(raw: ApiRequest) {
  const req = authenticate(raw);
  return json(listOrders(req.userId ?? ''));
}
