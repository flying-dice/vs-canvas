import { roundMoney } from '../shared/types';

const rates: Record<string, number> = {
  CA: 0.0725,
  NY: 0.08,
  TX: 0.0625,
  WA: 0.065,
};

export function taxRate(region: string): number {
  return rates[region] ?? 0;
}

export function calculateTax(taxable: number, region: string): number {
  return roundMoney(taxable * taxRate(region));
}
