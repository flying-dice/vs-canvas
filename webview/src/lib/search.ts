// Tiny fuzzy scorer for the command bar and quick-add menu. Higher is better; 0 = no match.

/** Score how well `query` matches `text`: prefix > word start > substring > in-order subsequence. */
export function score(query: string, text: string | undefined): number {
  if (!text) return 0;
  const q = query.trim().toLowerCase();
  if (!q) return 1;
  const t = text.toLowerCase();
  if (t === q) return 100;
  if (t.startsWith(q)) return 80;
  const at = t.indexOf(q);
  if (at >= 0) return /[\s/._-]/.test(t[at - 1] ?? ' ') ? 60 : 40;
  // subsequence
  let i = 0;
  for (const ch of t) if (ch === q[i] && ++i === q.length) return 10;
  return 0;
}

/** Best weighted score across fields (`[text, weight]`). */
export function scoreFields(query: string, fields: [string | undefined, number][]): number {
  let best = 0;
  for (const [text, w] of fields) best = Math.max(best, score(query, text) * w);
  return best;
}
