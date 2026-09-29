import { getProduct } from '../catalog';
import { bus } from '../shared/eventBus';
import { systemClock } from '../shared/clock';
import { ConflictError, ValidationError } from '../shared/errors';
import { prefixedId } from '../shared/ids';
import { reviewRepo } from './reviewRepo';
import type { Review } from './types';

export async function submitReview(productId: string, userId: string, rating: number, text: string): Promise<Review> {
  getProduct(productId);
  if (rating < 1 || rating > 5) throw new ValidationError('rating must be between 1 and 5');
  if (reviewRepo.forProduct(productId).some((r) => r.userId === userId)) {
    throw new ConflictError('you already reviewed this product');
  }
  const review = reviewRepo.save({ id: prefixedId('rev'), productId, userId, rating, text, createdAt: systemClock.now() });
  await bus.publish({ type: 'review.submitted', productId, rating, at: review.createdAt });
  return review;
}
