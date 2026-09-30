// Line diff for the diff node: pure, framework free. Prefix/suffix trim, then Myers O(ND) on the middle.

export type DiffRow = {
  kind: 'same' | 'add' | 'del';
  /** 1-based line number in the left (before) file; absent for 'add'. */
  left?: number;
  /** 1-based line number in the right (after) file; absent for 'del'. */
  right?: number;
  text: string;
};

export type FoldRow = { kind: 'fold'; count: number; id: string };
export type FoldedRow = DiffRow | FoldRow;

/** Edit distance above which the middle is reported as one delete block plus one add block (bounds memory). */
const MAX_D = 3000;

type Op = 'same' | 'add' | 'del';

/** Myers shortest edit script over a and b; returns ops in order, or null when D exceeds MAX_D. */
function myers(a: string[], b: string[]): Op[] | null {
  const n = a.length;
  const m = b.length;
  if (n === 0) return b.map(() => 'add');
  if (m === 0) return a.map(() => 'del');
  const max = Math.min(n + m, MAX_D);
  const off = max + 1;
  const v = new Int32Array(2 * max + 3);
  const trace: Int32Array[] = [];
  let found = -1;
  for (let d = 0; d <= max && found < 0; d++) {
    trace.push(v.slice());
    for (let k = -d; k <= d; k += 2) {
      let x: number;
      if (k === -d || (k !== d && v[off + k - 1] < v[off + k + 1])) x = v[off + k + 1];
      else x = v[off + k - 1] + 1;
      let y = x - k;
      while (x < n && y < m && a[x] === b[y]) {
        x++;
        y++;
      }
      v[off + k] = x;
      if (x >= n && y >= m) {
        found = d;
        break;
      }
    }
  }
  if (found < 0) return null;
  const ops: Op[] = [];
  let x = n;
  let y = m;
  for (let d = found; d > 0; d--) {
    const vv = trace[d];
    const k = x - y;
    const down = k === -d || (k !== d && vv[off + k - 1] < vv[off + k + 1]);
    const pk = down ? k + 1 : k - 1;
    const px = vv[off + pk];
    const py = px - pk;
    const mx = down ? px : px + 1;
    const my = mx - k;
    while (x > mx && y > my) {
      ops.push('same');
      x--;
      y--;
    }
    ops.push(down ? 'add' : 'del');
    x = px;
    y = py;
  }
  while (x > 0 && y > 0) {
    ops.push('same');
    x--;
    y--;
  }
  return ops.reverse();
}

export function diffLines(left: string[], right: string[]): DiffRow[] {
  let pre = 0;
  const lim = Math.min(left.length, right.length);
  while (pre < lim && left[pre] === right[pre]) pre++;
  let suf = 0;
  while (suf < lim - pre && left[left.length - 1 - suf] === right[right.length - 1 - suf]) suf++;
  const a = left.slice(pre, left.length - suf);
  const b = right.slice(pre, right.length - suf);
  const ops: Op[] = [];
  for (let i = 0; i < pre; i++) ops.push('same');
  const mid = myers(a, b) ?? [...a.map((): Op => 'del'), ...b.map((): Op => 'add')];
  for (const o of mid) ops.push(o);
  for (let i = 0; i < suf; i++) ops.push('same');

  const rows: DiffRow[] = [];
  let l = 0;
  let r = 0;
  for (const o of ops) {
    if (o === 'same') rows.push({ kind: 'same', left: l + 1, right: r + 1, text: left[l] }), l++, r++;
    else if (o === 'del') rows.push({ kind: 'del', left: l + 1, text: left[l] }), l++;
    else rows.push({ kind: 'add', right: r + 1, text: right[r] }), r++;
  }
  return rows;
}

/**
 * Collapse runs of unchanged rows longer than `2 * context + 1`, keeping `context` rows next to each change.
 * A file with no changes at all becomes a single fold. Fold ids are stable for a given position (`f<index>`).
 */
export function foldRows(rows: DiffRow[], context = 3): FoldedRow[] {
  const out: FoldedRow[] = [];
  let i = 0;
  while (i < rows.length) {
    if (rows[i].kind !== 'same') {
      out.push(rows[i++]);
      continue;
    }
    let j = i;
    while (j < rows.length && rows[j].kind === 'same') j++;
    const run = j - i;
    const atStart = i === 0;
    const atEnd = j === rows.length;
    const keepHead = atStart ? 0 : context;
    const keepTail = atEnd ? 0 : context;
    if (run > keepHead + keepTail + 1 && (atStart || atEnd || run > 2 * context + 1)) {
      for (let k = i; k < i + keepHead; k++) out.push(rows[k]);
      out.push({ kind: 'fold', count: run - keepHead - keepTail, id: `f${i + keepHead}` });
      for (let k = j - keepTail; k < j; k++) out.push(rows[k]);
    } else {
      for (let k = i; k < j; k++) out.push(rows[k]);
    }
    i = j;
  }
  return out;
}

export function diffStats(rows: DiffRow[]): { added: number; removed: number } {
  let added = 0;
  let removed = 0;
  for (const r of rows) {
    if (r.kind === 'add') added++;
    else if (r.kind === 'del') removed++;
  }
  return { added, removed };
}
