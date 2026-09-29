// Semantic zoom: which level of detail a card shows at a given canvas zoom.
//   far  (zoom < 0.6)          title, state colour, big glyph only (below this, 13px text is under 8px on screen)
//   mid  (0.6 <= zoom < 0.9)   summary
//   near (zoom >= 0.9)         full content and code
// A small hysteresis band stops the level flickering while the zoom hovers around a threshold.

export type Lod = 'far' | 'mid' | 'near';

export const LOD = {
  /** Below this zoom cards render at `far`. */
  farBelow: 0.6,
  /** From this zoom cards render at `near`. */
  nearFrom: 0.9,
  /** Half-width of the dead band around each threshold. */
  hysteresis: 0.03,
} as const;

/** Level for a zoom with no history (thresholds only). */
export function lodAt(zoom: number): Lod {
  return zoom < LOD.farBelow ? 'far' : zoom < LOD.nearFrom ? 'mid' : 'near';
}

/**
 * Level for `zoom` given the level currently shown. The level only changes once the zoom is past the threshold
 * by `hysteresis`, so tiny zoom changes right at a boundary never toggle it.
 */
export function lodForZoom(zoom: number, prev?: Lod): Lod {
  if (!prev) return lodAt(zoom);
  const h = LOD.hysteresis;
  switch (prev) {
    case 'far':
      return zoom >= LOD.farBelow + h ? lodAt(zoom - h) : 'far';
    case 'mid':
      if (zoom < LOD.farBelow - h) return 'far';
      if (zoom >= LOD.nearFrom + h) return 'near';
      return 'mid';
    case 'near':
      return zoom < LOD.nearFrom - h ? lodAt(zoom + h) : 'near';
  }
}

/** True when text at `fontPx` (screen px at zoom 1) would render below `minPx` on screen. */
export const tooSmall = (fontPx: number, zoom: number, minPx = 9): boolean => fontPx * zoom < minPx;
