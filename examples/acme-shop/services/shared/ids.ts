const counters = new Map<string, number>();

export function sequence(name: string, start = 0): () => string {
  counters.set(name, start);
  return () => {
    const next = (counters.get(name) ?? start) + 1;
    counters.set(name, next);
    return String(next);
  };
}

export function prefixedId(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${random}`;
}
