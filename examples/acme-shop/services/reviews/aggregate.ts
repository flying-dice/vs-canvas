import { reviewRepo } from './reviewRepo';
import type { RatingSummary } from './types';

export function summarize(productId: string): RatingSummary {
  const reviews = reviewRepo.forProduct(productId);
  const total = reviews.reduce((sum, r) => sum + r.rating, 0);
  return { productId, count: reviews.length, average: reviews.length ? Math.round((total / reviews.length) * 10) / 10 : 0 };
}
