import { handleProviderWebhook } from '../../payments';
import type { ProviderWebhook } from '../../payments/webhooks';
import { json } from '../../shared/http';
import type { ApiRequest } from '../../shared/http';

export async function handleWebhook(req: ApiRequest<ProviderWebhook>) {
  await handleProviderWebhook(req.body);
  return json({ received: true });
}
