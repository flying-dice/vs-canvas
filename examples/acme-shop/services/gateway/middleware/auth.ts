import { resolveSession } from '../../identity';
import type { ApiRequest } from '../../shared/http';

export function authenticate<B>(req: ApiRequest<B>): ApiRequest<B> {
  const header = req.headers['authorization'] ?? '';
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;
  const session = resolveSession(token);
  return { ...req, userId: session.userId };
}
