import { config } from '../shared/config';

export function shippingFor(subtotal: number): number {
  if (subtotal >= config.shipping.freeThreshold) return 0;
  return subtotal === 0 ? 0 : 5.99;
}

export function maxQuantityPerLine(): number {
  return 20;
}
