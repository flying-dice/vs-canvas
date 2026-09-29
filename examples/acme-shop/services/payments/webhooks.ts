import { bus } from '../shared/eventBus';
import { createLogger } from '../shared/logger';
import { chargeRepo } from './chargeRepo';

const log = createLogger('payments.webhooks');

export interface ProviderWebhook {
  type: 'charge.succeeded' | 'charge.failed';
  providerRef: string;
}

export async function handleProviderWebhook(event: ProviderWebhook): Promise<void> {
  const charge = chargeRepo.all().find((c) => c.providerRef === event.providerRef);
  if (!charge) {
    log.warn('webhook for unknown charge', { providerRef: event.providerRef });
    return;
  }
  if (event.type === 'charge.failed') {
    chargeRepo.save({ ...charge, status: 'failed' });
    await bus.publish({ type: 'payment.failed', orderId: charge.orderId, reason: 'provider_reported', at: Date.now() });
  }
}
