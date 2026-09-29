import { orderBalance } from './balance';

export interface Discrepancy {
  orderId: string;
  expected: number;
  booked: number;
}

export function reconcile(expectedTotals: Record<string, number>): Discrepancy[] {
  const found: Discrepancy[] = [];
  for (const [orderId, expected] of Object.entries(expectedTotals)) {
    const booked = orderBalance(orderId);
    if (booked !== expected) found.push({ orderId, expected, booked });
  }
  return found;
}
