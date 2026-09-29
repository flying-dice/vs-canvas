import type { Currency } from '../shared/types';

export interface Product {
  id: string;
  sku: string;
  title: string;
  description: string;
  price: number;
  currency: Currency;
  category: string;
  tags: string[];
  active: boolean;
}
