import type { ApiRequest, ApiResponse } from '../shared/http';
import { toErrorResponse } from './middleware/errors';
import { rateLimit } from './middleware/rateLimit';
import { matchRoute } from './router';

export async function handleRequest(req: ApiRequest): Promise<ApiResponse> {
  try {
    rateLimit(req);
    const match = matchRoute(req.method, req.path);
    if (!match) return { status: 404, body: { error: { code: 'not_found', message: `no route for ${req.path}` } } };
    return await match.handler({ ...req, params: match.params });
  } catch (error) {
    return toErrorResponse(error);
  }
}
