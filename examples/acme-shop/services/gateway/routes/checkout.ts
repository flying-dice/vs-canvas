import { startCheckout } from '../../checkout';
import { json } from '../../shared/http';
import type { ApiRequest } from '../../shared/http';
import { requireString } from '../../shared/validate';
import { authenticate } from '../middleware/auth';

export async function handleStartCheckout(raw: ApiRequest<{ cartId?: string }>) {
  const req = authenticate(raw);
  return json(startCheckout(requireString(req.body?.cartId, 'cartId')));
}
