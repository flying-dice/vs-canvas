// Turn a log / stack trace line into text and clickable source frames.
// Recognised: `at fn (path/file.ts:48:12)`, `at path/file.ts:48`, `File "path/file.py", line 48`,
// `path/file.go:48`, `Bar.java:48`. Only known source extensions count, so `localhost:3000` and timestamps do not.

export type LogSegment = { text: string; frame?: { path: string; line: number; col?: number } };

const EXT = 'tsx?|jsx?|mjs|cjs|mts|cts|py|go|rs|java|kt|rb|php|cs|cpp|cc|c|h|hpp|swift|vue|svelte|scala|dart|ex|exs|lua|sh';
// path chars: no whitespace, parens, quotes or colons (except a Windows drive prefix)
const PATH = String.raw`(?:[A-Za-z]:[\\/])?[^\s()"'<>:]+?`;
const FRAME_RE = new RegExp(String.raw`(${PATH}\.(?:${EXT})):(\d+)(?::(\d+))?`, 'g');
const PY_RE = /"([^"\n]+\.[A-Za-z0-9]+)", line (\d+)/g;

/** Split one line into segments; frame segments carry the parsed location. */
export function parseLogLine(line: string): LogSegment[] {
  type Hit = { start: number; end: number; path: string; line: number; col?: number };
  const hits: Hit[] = [];
  for (const m of line.matchAll(PY_RE)) {
    hits.push({ start: m.index!, end: m.index! + m[0].length, path: m[1], line: Number(m[2]) });
  }
  for (const m of line.matchAll(FRAME_RE)) {
    const start = m.index!;
    const end = start + m[0].length;
    if (hits.some((h) => start < h.end && end > h.start)) continue;
    hits.push({ start, end, path: m[1], line: Number(m[2]), col: m[3] ? Number(m[3]) : undefined });
  }
  if (!hits.length) return [{ text: line }];
  hits.sort((a, b) => a.start - b.start);
  const out: LogSegment[] = [];
  let at = 0;
  for (const h of hits) {
    if (h.start > at) out.push({ text: line.slice(at, h.start) });
    out.push({ text: line.slice(h.start, h.end), frame: { path: h.path, line: h.line, col: h.col } });
    at = h.end;
  }
  if (at < line.length) out.push({ text: line.slice(at) });
  return out;
}

/** 1-based number of the first error line, or undefined. */
export const firstError = (errorLines: readonly number[] | undefined): number | undefined =>
  errorLines && errorLines.length ? Math.min(...errorLines) : undefined;
