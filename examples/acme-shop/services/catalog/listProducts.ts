import { productRepo } from './productRepo';
import type { Product } from './types';

export interface ListOptions {
  category?: string;
  limit?: number;
  offset?: number;
}

export function listProducts(options: ListOptions = {}): Product[] {
  const { category, limit = 20, offset = 0 } = options;
  const rows = category ? productRepo.findByCategory(category) : productRepo.find((p) => p.active);
  return rows.slice(offset, offset + limit);
}
