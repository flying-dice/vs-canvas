import { describe, expect, it } from 'vitest';
import { score, scoreFields } from './search';

describe('score', () => {
  it('ranks exact > prefix > word start > substring > subsequence', () => {
    const s = (t: string) => score('pay', t);
    expect(s('pay')).toBeGreaterThan(s('payments'));
    expect(s('payments')).toBeGreaterThan(s('checkout/payments'));
    expect(s('checkout/payments')).toBeGreaterThan(s('prepay'));
    expect(s('prepay')).toBeGreaterThan(s('p-a-y'));
    expect(s('nothing')).toBe(0);
  });
  it('empty query matches everything weakly', () => {
    expect(score('', 'x')).toBe(1);
  });
  it('weights fields', () => {
    expect(scoreFields('retry', [['retry.ts', 1], ['src/retry.ts', 0.5]])).toBeGreaterThan(0);
    expect(scoreFields('zzz', [['retry.ts', 1]])).toBe(0);
  });
});
