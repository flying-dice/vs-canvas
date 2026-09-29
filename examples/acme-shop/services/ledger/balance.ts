import { roundMoney } from '../shared/types';
import { ledgerRepo } from './ledgerRepo';

export function orderBalance(orderId: string): number {
  const net = ledgerRepo
    .forOrder(orderId)
    .reduce((sum, e) => sum + (e.kind === 'charge' ? e.amount : -e.amount), 0);
  return roundMoney(net);
}
