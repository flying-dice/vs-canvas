import { MemoryRepo } from '../shared/memoryRepo';
import type { Review } from './types';

export class ReviewRepo extends MemoryRepo<Review> {
  forProduct(productId: string): Review[] {
    return this.find((r) => r.productId === productId);
  }
}

export const reviewRepo = new ReviewRepo();
