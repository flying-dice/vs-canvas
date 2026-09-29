export interface BackoffPolicy {
  baseMs: number;
  factor: number;
  maxMs: number;
  jitter: number;
}

export const defaultBackoff: BackoffPolicy = {
  baseMs: 250,
  factor: 2,
  maxMs: 5000,
  jitter: 0.2,
};

export function backoffDelay(attempt: number, policy: BackoffPolicy = defaultBackoff): number {
  const raw = Math.min(policy.maxMs, policy.baseMs * policy.factor ** (attempt - 1));
  const spread = raw * policy.jitter;
  return Math.round(raw - spread + Math.random() * spread * 2);
}
