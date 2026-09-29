import { sleep } from '../shared/clock';
import { config } from '../shared/config';
import { prefixedId } from '../shared/ids';
import type { PaymentProvider, ProviderCharge, ProviderChargeRequest } from './types';

export interface SimulatedProviderOptions {
  latencyMs: number;
  declineAbove?: number;
}

export function createSimulatedProvider(options: SimulatedProviderOptions): PaymentProvider {
  const byKey = new Map<string, ProviderCharge>();

  return {
    async charge(request: ProviderChargeRequest): Promise<ProviderCharge> {
      if (request.idempotencyKey) {
        const replay = byKey.get(request.idempotencyKey);
        if (replay) return replay;
      }
      await sleep(options.latencyMs);
      const declined = options.declineAbove !== undefined && request.amount > options.declineAbove;
      const result: ProviderCharge = declined
        ? { id: prefixedId('ch'), status: 'declined', amount: request.amount, declineReason: 'card_declined' }
        : { id: prefixedId('ch'), status: 'succeeded', amount: request.amount };
      if (request.idempotencyKey) byKey.set(request.idempotencyKey, result);
      return result;
    },

    async refund(providerRef: string): Promise<{ id: string }> {
      await sleep(options.latencyMs);
      return { id: `re_${providerRef}` };
    },
  };
}

export const defaultProvider = createSimulatedProvider({
  latencyMs: config.payments.timeoutMs / 40,
});
