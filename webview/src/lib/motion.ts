// Motion constants shared by the canvas. CSS durations live in app.css and mirror these values.

export const MOTION = {
  /** JS tween of node position/size when the document moves a node. */
  moveMs: 320,
  /** Opacity fade-in of a new node / edge. */
  enterMs: 220,
  /** Draw-in of a new edge stroke. */
  edgeDrawMs: 420,
  /** Opacity fade-out before a removed node / edge leaves the state. */
  exitMs: 150,
  /** One-shot background flash on a newly added highlight. */
  pulseMs: 700,
  /** Outline flash on a node picked from the issues panel. */
  flashMs: 1400,
  /** Camera move duration. */
  cameraMs: 520,
  /** Focus requests arriving inside this window are merged into one camera move. */
  cameraCoalesceMs: 150,
  /** Screen-space margin kept around focused nodes. */
  cameraMarginPx: 48,
  /** Flow playback follows steps at this zoom when the viewer is zoomed out further (code lines stay legible). */
  playbackZoom: 0.85,
  /** Never zoom out further than this to focus a subset (keeps code readable). */
  cameraFocusMinZoom: 0.35,
  cameraFitMinZoom: 0.05,
  cameraMaxZoom: 1,
  /** No camera moves this long after the last wheel event. */
  wheelQuietMs: 1500,
  /** A camera move deferred by user interaction is dropped after this long. */
  cameraDeferMaxMs: 4000,
} as const;

export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

const query = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

/** Live value of `prefers-reduced-motion: reduce`; read it at the point of use. */
export function reducedMotion(): boolean {
  return query?.matches ?? false;
}

/** Duration to actually use: 0 when the user prefers reduced motion. */
export function dur(ms: number): number {
  return reducedMotion() ? 0 : ms;
}
