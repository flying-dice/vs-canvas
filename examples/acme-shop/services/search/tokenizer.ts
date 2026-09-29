const STOP_WORDS = new Set(['a', 'an', 'the', 'and', 'of', 'for']);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}
