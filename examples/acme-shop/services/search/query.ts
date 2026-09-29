import { searchIndex } from './indexer';
import { tokenize } from './tokenizer';
import type { SearchHit } from './types';

export function search(q: string, limit = 10): SearchHit[] {
  const terms = tokenize(q);
  if (terms.length === 0) return [];
  return searchIndex
    .all()
    .map((doc) => ({ id: doc.id, score: terms.filter((t) => doc.tokens.includes(t)).length }))
    .filter((hit) => hit.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
