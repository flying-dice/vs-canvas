import { NotFoundError } from '../shared/errors';
import { productRepo } from './productRepo';
import type { Product } from './types';

export function getProduct(id: string): Product {
  const product = productRepo.get(id);
  if (!product || !product.active) throw new NotFoundError('product', id);
  return product;
}

export function getProductBySku(sku: string): Product {
  const product = productRepo.findBySku(sku);
  if (!product) throw new NotFoundError('product', sku);
  return product;
}
