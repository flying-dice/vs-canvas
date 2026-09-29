// Edge end markers: vector glyphs in a local coordinate system where the path end (the node border) is the origin
// and the glyph extends back along the line towards negative x. The same data draws the real markers (CanvasEdge),
// the relation picker preview and the Storybook gallery, so they can never drift apart.
import type { CanvasFileEdge, EdgeEnd, EdgeMarker } from '../../../../src/shared/canvasFile';
import { relationById } from '../../../../src/shared/shapes';
import { effectiveRouting } from '../../../../src/shared/geometry';

/** ink = stroke colour fill, bg = editor background (hollow), none = outline only. */
export type Glyph = { d: string; fill: 'none' | 'ink' | 'bg' };

const foot = 'M-12 0L0 -6M-12 0L0 0M-12 0L0 6';
const ring = (cx: number, r: number) => `M${cx - r} 0A${r} ${r} 0 1 0 ${cx + r} 0A${r} ${r} 0 1 0 ${cx - r} 0Z`;

export const MARKER_GLYPHS: Record<EdgeMarker, Glyph[]> = {
  none: [],
  arrow: [{ d: 'M0 0L-10 -4.5V4.5Z', fill: 'ink' }],
  'open-arrow': [{ d: 'M-9 -5L0 0L-9 5', fill: 'none' }],
  triangle: [{ d: 'M0 0L-12 -6.5V6.5Z', fill: 'bg' }],
  diamond: [{ d: 'M0 0L-8 -5L-16 0L-8 5Z', fill: 'bg' }],
  'diamond-filled': [{ d: 'M0 0L-8 -5L-16 0L-8 5Z', fill: 'ink' }],
  circle: [{ d: ring(-4.5, 4.5), fill: 'bg' }],
  'crow-one': [{ d: 'M-7 -6V6M-12 -6V6', fill: 'none' }],
  'crow-zero-one': [
    { d: ring(-15, 4), fill: 'bg' },
    { d: 'M-7 -6V6', fill: 'none' },
  ],
  'crow-many': [{ d: foot, fill: 'none' }],
  'crow-one-many': [
    { d: foot, fill: 'none' },
    { d: 'M-16 -6V6', fill: 'none' },
  ],
  'crow-zero-many': [
    { d: foot, fill: 'none' },
    { d: ring(-20, 4), fill: 'bg' },
  ],
};

/** How far a marker reaches back along the line from the path end (px). */
export const MARKER_REACH = 24;

export const MARKER_NAMES: Record<EdgeMarker, string> = {
  none: 'None',
  arrow: 'Arrow',
  'open-arrow': 'Open arrow',
  triangle: 'Hollow triangle',
  diamond: 'Hollow diamond',
  'diamond-filled': 'Filled diamond',
  circle: 'Circle',
  'crow-one': 'Exactly one',
  'crow-zero-one': 'Zero or one',
  'crow-many': 'Many',
  'crow-one-many': 'One or many',
  'crow-zero-many': 'Zero or many',
};

const endToMarker = (e: EdgeEnd | undefined): EdgeMarker | undefined => (e === undefined ? undefined : e === 'arrow' ? 'arrow' : 'none');

export type EdgeLook = {
  fromMarker: EdgeMarker;
  toMarker: EdgeMarker;
  lineStyle: 'solid' | 'dashed' | 'dotted';
  routing: 'bezier' | 'orthogonal' | 'straight';
  /** True when the edge carries any diagram styling (relation, markers, routing or line style). */
  diagram: boolean;
};

/**
 * What an edge looks like: explicit markers / line style / routing win, then the relation preset, then the closest
 * JSON Canvas ends (`toEnd` defaults to an arrow), then a plain curved line.
 */
export function edgeLook(e: CanvasFileEdge | undefined): EdgeLook {
  const rel = relationById(e?.relation);
  return {
    fromMarker: e?.fromMarker ?? rel?.fromMarker ?? endToMarker(e?.fromEnd) ?? 'none',
    toMarker: e?.toMarker ?? rel?.toMarker ?? endToMarker(e?.toEnd) ?? 'arrow',
    lineStyle: e?.lineStyle ?? rel?.lineStyle ?? 'solid',
    routing: e ? effectiveRouting(e) : 'bezier',
    diagram: !!(e && (e.relation || e.fromMarker || e.toMarker || e.lineStyle || e.routing)),
  };
}

/** Stroke-dasharray / cap for a line style. */
export function dashFor(style: EdgeLook['lineStyle']): { dash?: string; cap?: 'round' } {
  return style === 'dashed' ? { dash: '6 4' } : style === 'dotted' ? { dash: '1.5 4', cap: 'round' } : {};
}
