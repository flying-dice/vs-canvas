import { AppError } from '../../shared/errors';
import { createLogger } from '../../shared/logger';
import type { ApiResponse } from '../../shared/http';

const log = createLogger('gateway');

export function toErrorResponse(error: unknown): ApiResponse<{ error: { code: string; message: string } }> {
  if (error instanceof AppError) {
    return { status: error.status, body: { error: { code: error.code, message: error.message } } };
  }
  log.error('unhandled error', { error: String(error) });
  return { status: 500, body: { error: { code: 'internal', message: 'something went wrong' } } };
}
