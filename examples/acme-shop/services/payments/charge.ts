import { bus } from '../shared/eventBus';
import { config } from '../shared/config';
import { systemClock } from '../shared/clock';
import { prefixedId } from '../shared/ids';
import { createLogger } from '../shared/logger';
import type { Currency } from '../shared/types';
import { chargeRepo } from './chargeRepo';
import { defaultProvider } from './provider';
import { chargeWithRetry } from './retry';
import type { CardToken, Charge, PaymentProvider, RetryPolicy } from './types';

const log = createLogger('payments.charge');

export interface ChargeOrderInput {
  orderId: string;
  total: number;
  currency?: Currency;
  card: CardToken;
}

const policy: RetryPolicy = {
  maxAttempts: config.payments.maxAttempts,
  timeoutMs: config.payments.timeoutMs,
  backoffMs: config.payments.backoffMs,
  providerName: config.payments.provider,
};

export async function chargeOrder(
  input: ChargeOrderInput,
  provider: PaymentProvider = defaultProvider,
): Promise<Charge> {
  const currency = input.currency ?? 'USD';
  const idempotencyKey = `order-${input.orderId}-${input.card.token}`;

  const existing = chargeRepo.findByKey(idempotencyKey);
  if (existing) {
    log.info('duplicate charge request ignored', { orderId: input.orderId, chargeId: existing.id });
    return existing;
  }

  const pending = chargeRepo.save({
    id: prefixedId('chg'),
    orderId: input.orderId,
    amount: input.total,
    currency,
    status: 'pending',
    idempotencyKey,
    createdAt: systemClock.now(),
  });

  try {
    const settled = await chargeWithRetry(
      provider,
      { orderId: pending.orderId, chargeId: pending.id, amount: pending.amount, currency, card: input.card },
      policy,
    );
    const charged = chargeRepo.save({ ...pending, status: 'succeeded', providerRef: settled.provider.id });
    await bus.publish({
      type: 'payment.charged',
      orderId: charged.orderId,
      chargeId: charged.id,
      amount: charged.amount,
      currency,
      at: systemClock.now(),
    });
    return charged;
  } catch (error) {
    chargeRepo.save({ ...pending, status: 'failed' });
    await bus.publish({ type: 'payment.failed', orderId: pending.orderId, reason: String(error), at: systemClock.now() });
    throw error;
  }
}
