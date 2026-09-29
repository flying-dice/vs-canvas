import { describe, expect, it } from 'vitest';
import { parseLogLine } from './logParse';

const frames = (l: string) => parseLogLine(l).filter((s) => s.frame).map((s) => s.frame);

describe('parseLogLine', () => {
  it('parses node frames with function and column', () => {
    const segs = parseLogLine('    at retryCharge (src/payments/retry.ts:48:12)');
    expect(segs.map((s) => s.text).join('')).toBe('    at retryCharge (src/payments/retry.ts:48:12)');
    expect(frames('    at retryCharge (src/payments/retry.ts:48:12)')).toEqual([{ path: 'src/payments/retry.ts', line: 48, col: 12 }]);
  });
  it('parses bare node frames', () => {
    expect(frames('    at async /app/src/api/orders.ts:57:5')).toEqual([{ path: '/app/src/api/orders.ts', line: 57, col: 5 }]);
  });
  it('parses python frames', () => {
    const segs = parseLogLine('  File "app/payments/retry.py", line 48, in retry');
    expect(frames('  File "app/payments/retry.py", line 48, in retry')).toEqual([{ path: 'app/payments/retry.py', line: 48, col: undefined }]);
    expect(segs.map((s) => s.text).join('')).toBe('  File "app/payments/retry.py", line 48, in retry');
  });
  it('parses go and java frames', () => {
    expect(frames('\t/srv/payments/charge.go:48 +0x1d')).toEqual([{ path: '/srv/payments/charge.go', line: 48, col: undefined }]);
    expect(frames('\tat com.acme.Charge.run(Charge.java:48)')).toEqual([{ path: 'Charge.java', line: 48, col: undefined }]);
  });
  it('ignores ports and timestamps', () => {
    expect(frames('listening on localhost:3000 at 12:30:45')).toEqual([]);
    expect(frames('GET http://example.com:8080/x')).toEqual([]);
  });
  it('finds several frames on one line', () => {
    expect(frames('a.ts:1 -> b.ts:2')).toHaveLength(2);
  });
});
