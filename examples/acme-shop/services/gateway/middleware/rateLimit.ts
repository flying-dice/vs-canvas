import { config } from '../../shared/config';
import { systemClock } from '../../shared/clock';
import { AppError } from '../../shared/errors';
import type { ApiRequest } from '../../shared/http';

const windows = new Map<string, { start: number; count: number }>();

export function rateLimit(req: ApiRequest): void {
  const key = req.headers['x-forwarded-for'] ?? 'local';
  const now = systemClock.now();
  const w = windows.get(key);
  if (!w || now - w.start > 60_000) {
    windows.set(key, { start: now, count: 1 });
    return;
  }
  w.count += 1;
  if (w.count > config.gateway.rateLimitPerMinute) throw new AppError('rate limit exceeded', 'rate_limited', 429);
}
