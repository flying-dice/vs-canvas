import { describe, expect, it } from 'vitest';
import { diffLines, diffStats, foldRows, type DiffRow } from './diff';

const L = (s: string) => (s ? s.split(',') : []);
const kinds = (rows: DiffRow[]) => rows.map((r) => (r.kind === 'same' ? '=' : r.kind === 'add' ? '+' : '-')).join('');
/** Rebuild both sides from rows: must equal the inputs. */
const sides = (rows: DiffRow[]) => ({
  left: rows.filter((r) => r.kind !== 'add').map((r) => r.text),
  right: rows.filter((r) => r.kind !== 'del').map((r) => r.text),
});

describe('diffLines', () => {
  it('identical files are all same', () => {
    const rows = diffLines(L('a,b,c'), L('a,b,c'));
    expect(kinds(rows)).toBe('===');
    expect(diffStats(rows)).toEqual({ added: 0, removed: 0 });
  });
  it('pure add', () => {
    const rows = diffLines(L('a,c'), L('a,b,c'));
    expect(kinds(rows)).toBe('=+=');
    expect(rows[1]).toEqual({ kind: 'add', right: 2, text: 'b' });
  });
  it('pure delete', () => {
    const rows = diffLines(L('a,b,c'), L('a,c'));
    expect(kinds(rows)).toBe('=-=');
    expect(rows[1]).toEqual({ kind: 'del', left: 2, text: 'b' });
  });
  it('modification in the middle', () => {
    const rows = diffLines(L('a,b,c,d,e'), L('a,b,X,d,e'));
    expect(kinds(rows)).toBe('==-+==');
    expect(diffStats(rows)).toEqual({ added: 1, removed: 1 });
  });
  it('empty sides', () => {
    expect(kinds(diffLines([], L('a,b')))).toBe('++');
    expect(kinds(diffLines(L('a,b'), []))).toBe('--');
    expect(diffLines([], [])).toEqual([]);
  });
  it('numbers lines per side', () => {
    const rows = diffLines(L('a,b,c'), L('a,X,Y,c'));
    expect(rows.map((r) => [r.left, r.right])).toEqual([[1, 1], [2, undefined], [undefined, 2], [undefined, 3], [3, 4]]);
  });
  it('reconstructs both sides for scattered edits', () => {
    const left = L('a,b,c,d,e,f,g,h');
    const right = L('b,c,X,e,f,g,Y,Z,h,i');
    const rows = diffLines(left, right);
    expect(sides(rows)).toEqual({ left, right });
    // minimal: 3 deletions (a,d + g) ... lcs is b,c,e,f,g? no: g replaced. Just check optimal edit count.
    const { added, removed } = diffStats(rows);
    expect(added + removed).toBe(left.length + right.length - 2 * 6);
  });
  it('handles 2000 lines with scattered edits quickly', () => {
    const left = Array.from({ length: 2000 }, (_, i) => `line ${i}`);
    const right = left.slice();
    for (let i = 50; i < 2000; i += 97) right[i] = `changed ${i}`;
    right.splice(1000, 0, 'inserted');
    const t = Date.now();
    const rows = diffLines(left, right);
    expect(Date.now() - t).toBeLessThan(1000);
    expect(sides(rows)).toEqual({ left, right });
  });
  it('completely different large files fall back gracefully', () => {
    const left = Array.from({ length: 2500 }, (_, i) => `a${i}`);
    const right = Array.from({ length: 2500 }, (_, i) => `b${i}`);
    const rows = diffLines(left, right);
    expect(sides(rows)).toEqual({ left, right });
    expect(diffStats(rows)).toEqual({ added: 2500, removed: 2500 });
  });
});

describe('foldRows', () => {
  const nums = (n: number) => Array.from({ length: n }, (_, i) => `l${i}`);
  it('identical file becomes one fold', () => {
    const f = foldRows(diffLines(nums(20), nums(20)));
    expect(f).toEqual([{ kind: 'fold', count: 20, id: expect.any(String) }]);
  });
  it('keeps context around a change and folds the rest', () => {
    const right = nums(30);
    right[15] = 'X';
    const f = foldRows(diffLines(nums(30), right), 3);
    expect(f.map((r) => r.kind)).toEqual(['fold', 'same', 'same', 'same', 'del', 'add', 'same', 'same', 'same', 'fold']);
    expect(f[0]).toMatchObject({ count: 12 });
    expect(f[9]).toMatchObject({ count: 11 });
  });
  it('does not fold short runs between changes', () => {
    const right = nums(20);
    right[5] = 'X';
    right[12] = 'Y'; // 6 unchanged between (<= 2*3+1)
    const f = foldRows(diffLines(nums(20), right), 3);
    expect(f.filter((r) => r.kind === 'fold')).toHaveLength(2); // only head and tail
  });
  it('folds interior runs longer than 2*context+1', () => {
    const right = nums(30);
    right[3] = 'X';
    right[20] = 'Y';
    const f = foldRows(diffLines(nums(30), right), 3);
    expect(f.filter((r) => r.kind === 'fold').length).toBeGreaterThanOrEqual(1);
    const total = f.reduce((n, r) => n + (r.kind === 'fold' ? r.count : r.kind === 'add' ? 0 : 1), 0);
    expect(total).toBe(30);
  });
  it('fold ids are unique', () => {
    const right = nums(60);
    right[10] = 'X';
    right[40] = 'Y';
    const ids = foldRows(diffLines(nums(60), right)).flatMap((r) => (r.kind === 'fold' ? [r.id] : []));
    expect(new Set(ids).size).toBe(ids.length);
  });
});
