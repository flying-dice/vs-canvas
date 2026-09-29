import { NotFoundError } from '../shared/errors';
import { writeEntry } from '../ledger';
import { chargeRepo } from './chargeRepo';
import { defaultProvider } from './provider';

export async function refundCharge(chargeId: string): Promise<void> {
  const charge = chargeRepo.get(chargeId);
  if (!charge || !charge.providerRef) throw new NotFoundError('charge', chargeId);
  await defaultProvider.refund(charge.providerRef, charge.amount);
  await writeEntry({
    orderId: charge.orderId,
    chargeId: charge.id,
    amount: charge.amount,
    currency: charge.currency,
    kind: 'refund',
  });
}
