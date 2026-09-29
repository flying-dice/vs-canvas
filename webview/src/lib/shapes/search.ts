// Search over the shape libraries for the palette and the quick-add menu. Every word of the query must match
// somewhere (name, "library name", keywords, description, id), so "c4 container" finds the C4 container.
import { LIBRARIES, SHAPES, libraryById, type ShapeDef } from '../../../../src/shared/shapes';
import { scoreFields } from '../search';

export function scoreShape(query: string, s: ShapeDef): number {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return 1;
  const lib = libraryById(s.library);
  let total = 0;
  for (const w of words) {
    const sc = scoreFields(w, [
      [s.name, 1],
      [`${lib?.name ?? ''} ${s.name}`, 0.9],
      [s.library, 0.7],
      [s.keywords?.join(' '), 0.6],
      [s.id, 0.5],
      [s.description, 0.3],
    ]);
    if (sc <= 0) return 0;
    total += sc;
  }
  return total / words.length;
}

/** Shapes matching a query, best first. Empty query returns all in library order. */
export function searchShapes(query: string, opts: { frames?: boolean } = {}): ShapeDef[] {
  const pool = SHAPES.filter((s) => opts.frames !== false || !s.frame);
  if (!query.trim()) return pool;
  const order = new Map(LIBRARIES.map((l, i) => [l.id as string, i]));
  return pool
    .map((s) => ({ s, sc: scoreShape(query, s) }))
    .filter((r) => r.sc > 0)
    .sort((a, b) => b.sc - a.sc || (order.get(a.s.library) ?? 0) - (order.get(b.s.library) ?? 0))
    .map((r) => r.s);
}

/** Small curated set shown in the quick-add menu before the user types. */
export const FEATURED_SHAPES = ['flowchart.process', 'flowchart.decision', 'uml.class', 'c4.container', 'erd.entity', 'arch.service'];
