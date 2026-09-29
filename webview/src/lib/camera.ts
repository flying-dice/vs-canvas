import type { Rect, Viewport } from '@xyflow/svelte';
import { MOTION, dur, easeInOutCubic } from './motion';

export type Size = { width: number; height: number };

export type PlanInput = {
  /** Union bounds of the targets, in flow coordinates. */
  bounds: Rect;
  size: Size;
  /** Viewport to plan against (the destination of any move in flight, else the current one). */
  viewport: Viewport;
  /** True for "fit everything". */
  all: boolean;
  /** Bounds of the most recently added target; used when a subset cannot fit at a readable zoom. */
  anchor?: Rect;
  /** Skip the "already visible" check. */
  force?: boolean;
  /**
   * Content must be readable (e.g. flow playback lighting up code lines): below this zoom, move to exactly this
   * zoom, framing the targets if they fit, else centring on the anchor. A fixed zoom keeps consecutive steps to
   * calm pans instead of zoom pumping.
   */
  readableZoom?: number;
  /** An explicit "show me these": always frame the targets (zooming in up to max zoom), even if visible. */
  fit?: boolean;
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Pure camera policy: does nothing if visible, pans if it fits at the current zoom, else zooms to fit. */
export function planCamera(p: PlanInput): Viewport | null {
  const m = MOTION.cameraMarginPx;
  const { bounds: b, size, viewport: vp } = p;
  const z = vp.zoom;
  const usableW = Math.max(1, size.width - 2 * m);
  const usableH = Math.max(1, size.height - 2 * m);

  if (!p.force && !p.fit && !(p.readableZoom && z < p.readableZoom)) {
    // Visible rect in flow coordinates, shrunk by the margin.
    const left = (-vp.x + m) / z;
    const top = (-vp.y + m) / z;
    const right = (-vp.x + size.width - m) / z;
    const bottom = (-vp.y + size.height - m) / z;
    if (b.x >= left && b.y >= top && b.x + b.width <= right && b.y + b.height <= bottom) return null;
  }

  const centerOn = (r: Rect, zoom: number): Viewport => ({
    zoom,
    x: size.width / 2 - (r.x + r.width / 2) * zoom,
    y: size.height / 2 - (r.y + r.height / 2) * zoom,
  });

  if (p.readableZoom && z < p.readableZoom) {
    const rz = p.readableZoom;
    const fits = b.width * rz <= usableW && b.height * rz <= usableH;
    return centerOn(fits ? b : (p.anchor ?? b), rz);
  }

  if (p.fit) {
    const fz = Math.min(usableW / Math.max(b.width, 1), usableH / Math.max(b.height, 1));
    // Show all of them, however small: semantic zoom keeps cards legible when zoomed out.
    const minZ = MOTION.cameraFitMinZoom;
    return fz < minZ ? centerOn(p.anchor ?? b, minZ) : centerOn(b, Math.min(fz, MOTION.cameraMaxZoom));
  }

  // Fits at the current zoom: pan only.
  if (b.width * z <= usableW && b.height * z <= usableH) return centerOn(b, z);

  const fitZoom = Math.min(usableW / Math.max(b.width, 1), usableH / Math.max(b.height, 1));
  const minZoom = p.all ? MOTION.cameraFitMinZoom : MOTION.cameraFocusMinZoom;
  if (fitZoom < minZoom && !p.all) {
    // Too spread out to show readably: settle on the newest node instead.
    return centerOn(p.anchor ?? b, clamp(z, minZoom, MOTION.cameraMaxZoom));
  }
  return centerOn(b, clamp(fitZoom, minZoom, MOTION.cameraMaxZoom));
}

export type CameraDeps = {
  getViewport(): Viewport;
  setViewport(v: Viewport, o: { duration: number; ease: (t: number) => number; interpolate: 'linear' }): unknown;
  size(): Size;
  /** Ids currently in the flow (not exiting). */
  nodeIds(): string[];
  /** True once the node is measured. */
  measured(id: string): boolean;
  /** Final (post-tween) bounds of a node, or null if unknown. */
  nodeBounds(id: string): Rect | null;
  /** User is panning / dragging / wheeling. */
  busy(): boolean;
};

type Request = { ids: Set<string>; all: boolean; last?: string; instant: boolean; force: boolean; readableZoom?: number; fit?: boolean };

/** Coalesces focus requests and moves the viewport calmly. See MOTION for the tunables. */
export class Camera {
  private req: Request | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private deferTimer: ReturnType<typeof setTimeout> | undefined;
  private deferSince = 0;
  private raf = 0;
  private dest: Viewport | null = null;
  private destUntil = 0;

  constructor(private d: CameraDeps) {}

  request(ids?: string[], opts: { instant?: boolean; force?: boolean; immediate?: boolean; readableZoom?: number; fit?: boolean } = {}) {
    const r = (this.req ??= { ids: new Set(), all: false, instant: false, force: false });
    if (!ids || ids.length === 0) r.all = true;
    else {
      for (const id of ids) r.ids.add(id);
      r.last = ids[ids.length - 1];
    }
    r.instant ||= !!opts.instant;
    r.force ||= !!opts.force;
    r.fit ||= !!opts.fit;
    if (opts.readableZoom) r.readableZoom = Math.max(r.readableZoom ?? 0, opts.readableZoom);
    if (opts.immediate || opts.instant) {
      clearTimeout(this.timer);
      this.timer = undefined;
      this.begin();
    } else if (!this.timer && !this.deferTimer && !this.raf) {
      this.timer = setTimeout(() => {
        this.timer = undefined;
        this.begin();
      }, MOTION.cameraCoalesceMs);
    }
  }

  dispose() {
    clearTimeout(this.timer);
    clearTimeout(this.deferTimer);
    cancelAnimationFrame(this.raf);
    this.req = null;
  }

  private begin() {
    this.deferSince = 0;
    this.attempt(0);
  }

  /** Wait (a bounded number of frames) for new nodes to be measured, then run. */
  private attempt(tries: number) {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    const r = this.req;
    if (!r) return;
    const known = new Set(this.d.nodeIds());
    const targets = r.all || r.ids.size === 0 ? [...known] : [...r.ids].filter((id) => known.has(id));
    const ready = targets.length > 0 && targets.every((id) => this.d.measured(id));
    // The initial fit waits longer: a large board measures over several frames (async highlighting).
    if (!ready && tries < (r.instant ? 180 : 30)) {
      this.raf = requestAnimationFrame(() => this.attempt(tries + 1));
      return;
    }
    this.raf = 0;
    if (this.d.busy() && !r.instant) {
      // Defer while the user is interacting; drop if they keep at it.
      this.deferSince ||= performance.now();
      if (performance.now() - this.deferSince > MOTION.cameraDeferMaxMs) {
        this.req = null;
        this.deferSince = 0;
        return;
      }
      clearTimeout(this.deferTimer);
      this.deferTimer = setTimeout(() => {
        this.deferTimer = undefined;
        this.attempt(0);
      }, 300);
      return;
    }
    this.req = null;
    this.deferSince = 0;
    this.run(r, targets);
  }

  private run(r: Request, targets: string[]) {
    const all = r.all;
    const rects = targets
      .filter((id) => this.d.measured(id))
      .map((id) => this.d.nodeBounds(id))
      .filter((x): x is Rect => !!x && Number.isFinite(x.width) && Number.isFinite(x.height));
    if (!rects.length) return;
    const x1 = Math.min(...rects.map((q) => q.x));
    const y1 = Math.min(...rects.map((q) => q.y));
    const x2 = Math.max(...rects.map((q) => q.x + q.width));
    const y2 = Math.max(...rects.map((q) => q.y + q.height));
    const anchorId = r.last && targets.includes(r.last) ? r.last : targets[targets.length - 1];
    const now = performance.now();
    const vp = this.dest && now < this.destUntil ? this.dest : this.d.getViewport();
    const next = planCamera({
      bounds: { x: x1, y: y1, width: x2 - x1, height: y2 - y1 },
      size: this.d.size(),
      viewport: vp,
      all,
      anchor: this.d.nodeBounds(anchorId) ?? undefined,
      force: r.force,
      readableZoom: r.readableZoom,
      fit: r.fit,
    });
    if (!next) return;
    const duration = r.instant ? 0 : dur(MOTION.cameraMs);
    this.dest = next;
    this.destUntil = now + duration;
    this.d.setViewport(next, { duration, ease: easeInOutCubic, interpolate: 'linear' });
  }
}
