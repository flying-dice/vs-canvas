import { NotFoundError, ValidationError } from '../shared/errors';
import { systemClock } from '../shared/clock';
import { cartRepo } from './cartRepo';
import type { Cart } from './types';

export function getCart(cartId: string): Cart {
  const cart = cartRepo.get(cartId);
  if (!cart) throw new NotFoundError('cart', cartId);
  return cart;
}

export function addItem(cartId: string, sku: string, quantity = 1): Cart {
  if (quantity < 1) throw new ValidationError('quantity must be at least 1');
  const cart = getCart(cartId);
  const existing = cart.items.find((i) => i.sku === sku);
  const items = existing
    ? cart.items.map((i) => (i.sku === sku ? { ...i, quantity: i.quantity + quantity } : i))
    : [...cart.items, { sku, quantity }];
  return cartRepo.save({ ...cart, items, updatedAt: systemClock.now() });
}

export function clearCart(cartId: string): void {
  const cart = getCart(cartId);
  cartRepo.save({ ...cart, items: [], updatedAt: systemClock.now() });
}
