import { roundMoney } from '../shared/types';
import { carriers } from './carriers';
import type { RateQuote } from './types';

export function quoteRates(weightKg: number): RateQuote[] {
  return carriers
    .map((c) => ({ carrier: c.name, price: roundMoney(c.baseRate + c.perKg * weightKg), days: c.days }))
    .sort((a, b) => a.price - b.price);
}

export function cheapest(weightKg: number): RateQuote {
  return quoteRates(weightKg)[0];
}
