import { describe, expect, it } from 'vitest';
import { planCamera } from './camera';
import { MOTION } from './motion';

const size = { width: 1600, height: 900 };
const at = (zoom: number, x = 0, y = 0) => ({ x, y, zoom });

describe('planCamera', () => {
  it('does nothing when the targets are already visible (calm default)', () => {
    expect(planCamera({ bounds: { x: 100, y: 100, width: 200, height: 100 }, size, viewport: at(1), all: false })).toBeNull();
  });

  it('pans without zooming when the targets fit at the current zoom', () => {
    const v = planCamera({ bounds: { x: 3000, y: 0, width: 200, height: 100 }, size, viewport: at(0.5), all: false });
    expect(v?.zoom).toBe(0.5);
  });

  it('readableZoom moves to exactly that zoom when zoomed out further (no zoom pumping between steps)', () => {
    const v = planCamera({ bounds: { x: 0, y: 0, width: 400, height: 200 }, size, viewport: at(0.2), all: false, readableZoom: 0.85 });
    expect(v?.zoom).toBe(0.85);
    // Already at a readable zoom and visible: stay put.
    expect(planCamera({ bounds: { x: 100, y: 100, width: 200, height: 100 }, size, viewport: at(0.9), all: false, readableZoom: 0.85 })).toBeNull();
  });

  it('fit frames visible targets, zooming in up to the max zoom', () => {
    const small = planCamera({ bounds: { x: 0, y: 0, width: 200, height: 100 }, size, viewport: at(0.19), all: false, fit: true });
    expect(small?.zoom).toBe(MOTION.cameraMaxZoom);
    const wide = planCamera({ bounds: { x: 0, y: 0, width: 3000, height: 400 }, size, viewport: at(0.19), all: false, fit: true });
    expect(wide!.zoom).toBeGreaterThan(0.4);
    expect(wide!.zoom).toBeLessThan(0.55);
  });

  it('fit zooms out as far as fit-all to show every target, then falls back to the anchor', () => {
    const wide = planCamera({ bounds: { x: 0, y: 0, width: 6000, height: 400 }, size, viewport: at(0.19), all: false, fit: true });
    expect(wide!.zoom).toBeLessThan(MOTION.cameraFocusMinZoom);
    const anchor = { x: 9000, y: 0, width: 200, height: 100 };
    const v = planCamera({ bounds: { x: 0, y: 0, width: 100000, height: 400 }, size, viewport: at(0.19), all: false, fit: true, anchor });
    expect(v?.zoom).toBe(MOTION.cameraFitMinZoom);
    expect(v!.x).toBeCloseTo(size.width / 2 - (anchor.x + anchor.width / 2) * v!.zoom);
  });
});
