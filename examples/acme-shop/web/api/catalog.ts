import { request } from './client';

export interface ProductSummary {
  id: string;
  title: string;
  price: number;
}

export function fetchProducts(category?: string): Promise<ProductSummary[]> {
  const query = category ? `?category=${encodeURIComponent(category)}` : '';
  return request<ProductSummary[]>('GET', `/products${query}`);
}
