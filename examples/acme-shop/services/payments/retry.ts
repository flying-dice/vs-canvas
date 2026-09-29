import { backoffDelay } from '../shared/backoff';
import { sleep } from '../shared/clock';
import { PaymentDeclinedError, ProviderTimeoutError } from '../shared/errors';
import { createLogger } from '../shared/logger';
import { withTimeout } from '../shared/timeout';
import type { Currency } from '../shared/types';
import { writeEntry } from '../ledger';
import type { LedgerEntry } from '../ledger';
import type { CardToken, PaymentProvider, ProviderCharge, RetryPolicy } from './types';

const log = createLogger('payments.retry');

export interface ChargeAttempt {
  orderId: string;
  chargeId: string;
  amount: number;
  currency: Currency;
  card: CardToken;
}

export interface SettledCharge {
  provider: ProviderCharge;
  entry: LedgerEntry;
  attempts: number;
}

function isTimeout(error: unknown): error is ProviderTimeoutError {
  return error instanceof ProviderTimeoutError;
}

function delayFor(policy: RetryPolicy, attempts: number): number {
  return backoffDelay(attempts, { baseMs: policy.backoffMs, factor: 2, maxMs: 5000, jitter: 0.2 });
}

export async function chargeWithRetry(
  provider: PaymentProvider,
  attempt: ChargeAttempt,
  policy: RetryPolicy,
): Promise<SettledCharge> {
  const { orderId, chargeId, amount, currency, card } = attempt;
  const { maxAttempts } = policy;
  log.info('charging provider', { orderId, chargeId, amount });

  for (let attempts = 1; attempts <= maxAttempts; attempts++) {
    const startedAt = Date.now();
    log.debug('provider attempt', { orderId, attempts });
    try {
      const result = await withTimeout(provider.charge({ amount, card }), policy.timeoutMs, policy.providerName);

      if (result.status === 'declined') {
        throw new PaymentDeclinedError(result.declineReason ?? 'unknown');
      }

      const entry = await writeEntry({ orderId, chargeId, amount, currency, kind: 'charge' });
      return { provider: result, entry, attempts };
    } catch (error) {
      const retryable = isTimeout(error) && attempts < maxAttempts;
      if (!retryable) throw error;
      log.warn('provider timeout, retrying charge', { orderId, attempts, elapsedMs: Date.now() - startedAt });
      await sleep(delayFor(policy, attempts));
    }
  }

  throw new ProviderTimeoutError('paystream', policy.timeoutMs);
}
