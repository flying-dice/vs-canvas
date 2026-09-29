export type Currency = 'USD' | 'EUR' | 'GBP';

export interface Money {
  amount: number;
  currency: Currency;
}

export type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function fail<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

export function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100;
}
