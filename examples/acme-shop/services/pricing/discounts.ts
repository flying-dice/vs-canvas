import { roundMoney } from '../shared/types';
import type { DiscountRule } from './types';

const rules: DiscountRule[] = [
  { code: 'WELCOME10', percentOff: 10, minSubtotal: 0 },
  { code: 'BULK20', percentOff: 20, minSubtotal: 200 },
];

export function findRule(code: string | undefined): DiscountRule | undefined {
  return rules.find((r) => r.code === code);
}

export function applyDiscount(subtotal: number, code?: string): number {
  const rule = findRule(code);
  if (!rule || subtotal < rule.minSubtotal) return 0;
  return roundMoney((subtotal * rule.percentOff) / 100);
}
