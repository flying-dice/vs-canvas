import { listProducts } from '../catalog';
import { MemoryRepo } from '../shared/memoryRepo';
import { tokenize } from './tokenizer';
import type { SearchDoc } from './types';

export const searchIndex = new MemoryRepo<SearchDoc>();

export function reindexCatalog(): number {
  searchIndex.clear();
  const products = listProducts({ limit: 1000 });
  for (const p of products) {
    searchIndex.save({ id: p.id, title: p.title, tokens: tokenize(`${p.title} ${p.description} ${p.tags.join(' ')}`) });
  }
  return products.length;
}
