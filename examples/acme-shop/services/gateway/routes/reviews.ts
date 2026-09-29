import { submitReview, summarize } from '../../reviews';
import { json } from '../../shared/http';
import type { ApiRequest } from '../../shared/http';
import { authenticate } from '../middleware/auth';

export async function handleSubmitReview(raw: ApiRequest<{ rating: number; text: string }>) {
  const req = authenticate(raw);
  const review = await submitReview(req.params.id, req.userId ?? '', req.body.rating, req.body.text);
  return json(review, 201);
}

export async function handleRatingSummary(req: ApiRequest) {
  return json(summarize(req.params.id));
}
