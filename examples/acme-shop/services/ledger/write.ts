import { bus } from '../shared/eventBus';
import { systemClock } from '../shared/clock';
import { prefixedId } from '../shared/ids';
import { createLogger } from '../shared/logger';
import { ledgerRepo } from './ledgerRepo';
import type { LedgerEntry, NewLedgerEntry } from './types';

const log = createLogger('ledger');

export async function writeEntry(input: NewLedgerEntry): Promise<LedgerEntry> {
  const entry = ledgerRepo.save({
    ...input,
    id: prefixedId('led'),
    debitAccount: input.kind === 'charge' ? 'cash:paystream' : 'revenue:sales',
    creditAccount: input.kind === 'charge' ? 'revenue:sales' : 'cash:paystream',
    postedAt: systemClock.now(),
  });
  log.info('ledger entry written', { entryId: entry.id, orderId: entry.orderId, amount: entry.amount });
  await bus.publish({ type: 'ledger.entry_written', entryId: entry.id, orderId: entry.orderId, at: entry.postedAt });
  return entry;
}
