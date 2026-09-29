import type { Currency } from '../shared/types';

export interface NewLedgerEntry {
  orderId: string;
  chargeId: string;
  amount: number;
  currency: Currency;
  kind: 'charge' | 'refund';
}

export interface LedgerEntry extends NewLedgerEntry {
  id: string;
  debitAccount: string;
  creditAccount: string;
  postedAt: number;
}
