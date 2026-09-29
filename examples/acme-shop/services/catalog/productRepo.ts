import { MemoryRepo } from '../shared/memoryRepo';
import type { Product } from './types';

export class ProductRepo extends MemoryRepo<Product> {
  findBySku(sku: string): Product | undefined {
    return this.all().find((p) => p.sku === sku);
  }

  findByCategory(category: string): Product[] {
    return this.find((p) => p.category === category && p.active);
  }
}

export const productRepo = new ProductRepo();

const seed: Product[] = [
  { id: 'p_100', sku: 'MUG-BLK', title: 'Enamel Camp Mug', description: 'Black enamel mug, 350ml', price: 14, currency: 'USD', category: 'kitchen', tags: ['mug', 'camping'], active: true },
  { id: 'p_101', sku: 'TEE-NVY-M', title: 'Acme Logo Tee', description: 'Navy organic cotton tee', price: 25, currency: 'USD', category: 'apparel', tags: ['shirt', 'cotton'], active: true },
  { id: 'p_102', sku: 'BTL-STL', title: 'Steel Water Bottle', description: 'Insulated 750ml bottle', price: 10, currency: 'USD', category: 'outdoor', tags: ['bottle', 'insulated'], active: true },
];
seed.forEach((p) => productRepo.save(p));
