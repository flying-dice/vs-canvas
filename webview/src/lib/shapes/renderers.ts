// Shape renderers: for every id in SHAPES, a pure function (w, h) -> geometry. ShapeCard, FrameShape and the palette
// thumbnails all draw from this, so a shape looks the same everywhere.
//
// Geometry lives in a w x h box at 1 user unit = 1 canvas px. The outline is inset by half the 1.5px stroke so it
// stays inside the node bounds. Strokes are drawn with vector-effect: non-scaling-stroke by the components.
import { SHAPES, shapeById } from '../../../../src/shared/shapes';

export type Box = { x: number; y: number; w: number; h: number };
/** surface = same fill as the outline, ink = foreground, shade = faint foreground tint, bg = editor background. */
export type DecoFill = 'none' | 'surface' | 'ink' | 'shade' | 'bg' | 'muted';
export type Deco = { d: string; fill?: DecoFill; width?: number; dash?: string; muted?: boolean };

export type ShapeGeometry = {
  /** SVG path data of the main silhouette (may contain several subpaths). */
  outline: string;
  /** Extra paths drawn over the outline: icons, side bars, wave, depth faces, glyphs. */
  decorations: Deco[];
  /** Safe area for the label. Inside [0,w]x[0,h] unless `labelOutside`, where it sits directly below the shape. */
  textBox: Box;
  /** `below` layouts: the figure the label sits under. */
  figure?: Box;
  /** The label is drawn under the shape, outside its bounds (small events, gateways, choice). */
  labelOutside?: boolean;
  /** outline fill: surface (default), ink (solid), none (transparent) or tint (frames). */
  outlineFill?: 'surface' | 'ink' | 'none' | 'tint';
  outlineWidth?: number;
  outlineDash?: string;
  /** Corner radius for clipping HTML content (compartments, table) to the outline. */
  radius?: number;
};

export type GeometryOpts = { label?: string };
export type Renderer = (w: number, h: number, o?: GeometryOpts) => ShapeGeometry;

// ---------- path helpers ----------
const S = 0.75; // half of the 1.5px stroke
const f = (v: number) => Math.round(v * 100) / 100;
const d = (...a: (string | number)[]) => a.map((v) => (typeof v === 'number' ? String(f(v)) : v)).join(' ');
const B = (w: number, h: number) => ({ l: S, t: S, r: w - S, b: h - S, w: w - 2 * S, h: h - 2 * S, cx: w / 2, cy: h / 2 });
const box = (x: number, y: number, w: number, h: number): Box => ({ x: f(x), y: f(y), w: f(Math.max(0, w)), h: f(Math.max(0, h)) });
const inset = (w: number, h: number, x: number, y = x): Box => box(x, y, w - 2 * x, h - 2 * y);
const NONE_BOX = (w: number, h: number): Box => box(w / 2, h / 2, 0, 0);

const rect = (l: number, t: number, r: number, b: number) => d('M', l, t, 'H', r, 'V', b, 'H', l, 'Z');
function rrect(l: number, t: number, r: number, b: number, rad: number) {
  const k = Math.max(0, Math.min(rad, (r - l) / 2, (b - t) / 2));
  return d('M', l + k, t, 'H', r - k, 'A', k, k, 0, 0, 1, r, t + k, 'V', b - k, 'A', k, k, 0, 0, 1, r - k, b, 'H', l + k, 'A', k, k, 0, 0, 1, l, b - k, 'V', t + k, 'A', k, k, 0, 0, 1, l + k, t, 'Z');
}
const ellipse = (cx: number, cy: number, rx: number, ry: number) =>
  d('M', cx - rx, cy, 'A', rx, ry, 0, 1, 0, cx + rx, cy, 'A', rx, ry, 0, 1, 0, cx - rx, cy, 'Z');
const poly = (pts: [number, number][]) => 'M' + pts.map(([x, y]) => `${f(x)} ${f(y)}`).join('L') + 'Z';

/** Translate an absolute-command path (M L H V C Q A Z) by (dx, dy). Used to place 16px glyphs. */
export function shift(path: string, dx: number, dy: number): string {
  const tokens = path.match(/[A-Za-z]|-?\d*\.?\d+/g) ?? [];
  const out: string[] = [];
  let cmd = '';
  let i = 0;
  for (const t of tokens) {
    if (/[A-Za-z]/.test(t)) {
      cmd = t;
      i = 0;
      out.push(t);
      continue;
    }
    let v = Number(t);
    if (cmd === 'H') v += dx;
    else if (cmd === 'V') v += dy;
    else if (cmd === 'A') {
      const k = i % 7;
      if (k === 5) v += dx;
      else if (k === 6) v += dy;
    } else if ('MLCQST'.includes(cmd)) v += i % 2 === 0 ? dx : dy;
    i++;
    out.push(String(f(v)));
  }
  return out.join(' ');
}

// 16x16 line glyphs for the architecture shapes (drawn top-right, muted).
const GLYPH = {
  service: 'M8 1.5L14 4.75V11.25L8 14.5L2 11.25V4.75Z M2 4.75L8 8L14 4.75 M8 8V14.5',
  cache: 'M9 1.5L3.5 9H8L7 14.5L12.5 7H8Z',
  gateway: 'M1.5 8H10 M7.5 5L10.5 8L7.5 11 M13.5 2.5V13.5',
  balancer: 'M1.5 8H5.5C8 8 8 3.5 10.5 3.5H14.5 M5.5 8H14.5 M5.5 8C8 8 8 12.5 10.5 12.5H14.5',
  cdn: 'M1.5 8A6.5 6.5 0 1 0 14.5 8A6.5 6.5 0 1 0 1.5 8Z M1.5 8H14.5 M8 1.5C5.5 4 5.5 12 8 14.5 M8 1.5C10.5 4 10.5 12 8 14.5',
  fn: 'M4.5 2.5H6.5L12 13.5 M8.8 7.5L4.5 13.5',
  cloud:
    'M4.5 12.5C2.5 12.5 1.5 11 1.5 9.5C1.5 8 2.7 6.9 4.2 6.8C4.6 4.8 6.2 3.5 8.2 3.5C10.3 3.5 11.9 4.9 12.2 6.9C13.8 7.1 14.5 8.2 14.5 9.6C14.5 11.2 13.3 12.5 11.7 12.5Z',
} as const;
const glyphAt = (name: keyof typeof GLYPH, w: number): Deco => ({ d: shift(GLYPH[name], w - 12 - 16, 10), muted: true, width: 1.25 });
/** Text box for shapes with a 16px glyph in the top-right corner. */
const withGlyphBox = (w: number, h: number): Box => box(12, 8, w - 12 - 36, h - 16);

// ---------- building blocks ----------
function card(w: number, h: number, rad = 6, px = 12, py = 8, extra: Partial<ShapeGeometry> = {}): ShapeGeometry {
  const b = B(w, h);
  return { outline: rrect(b.l, b.t, b.r, b.b, rad), decorations: [], textBox: inset(w, h, px, py), ...extra };
}

function cylinder(w: number, h: number, extra: { stripes?: number; ryMax?: number } = {}): ShapeGeometry {
  const b = B(w, h);
  const rx = b.w / 2;
  const ry = Math.min(extra.ryMax ?? 12, b.h * 0.16);
  const outline = d('M', b.l, b.t + ry, 'A', rx, ry, 0, 0, 1, b.r, b.t + ry, 'V', b.b - ry, 'A', rx, ry, 0, 0, 1, b.l, b.b - ry, 'Z');
  const arc = (y: number) => d('M', b.l, y, 'A', rx, ry, 0, 0, 0, b.r, y);
  const decorations: Deco[] = [{ d: arc(b.t + ry) }];
  const stripes = extra.stripes ?? 0;
  for (let i = 1; i <= stripes; i++) decorations.push({ d: arc(b.t + ry + i * ry * 1.7) });
  const top = 2 * ry + 4 + stripes * ry * 1.7;
  return { outline, decorations, textBox: box(12, top, w - 24, h - top - ry - 6) };
}

/** Horizontal pipe (queue): a cylinder on its side, open end on the right. */
function pipe(w: number, h: number): ShapeGeometry {
  const b = B(w, h);
  const rx = Math.min(14, b.w * 0.1);
  const ry = b.h / 2;
  const outline = d('M', b.l + rx, b.t, 'H', b.r - rx, 'A', rx, ry, 0, 0, 1, b.r - rx, b.b, 'H', b.l + rx, 'A', rx, ry, 0, 0, 1, b.l + rx, b.t, 'Z');
  return {
    outline,
    decorations: [{ d: d('M', b.r - rx, b.t, 'A', rx, ry, 0, 0, 0, b.r - rx, b.b) }],
    textBox: box(rx + 12, 6, w - 2 * rx - 24 - 4, h - 12),
  };
}

function docShape(w: number, h: number, top = 0, right = 0): { outline: string; bottom: number } {
  const b = B(w, h);
  const a = Math.min(10, b.h * 0.14);
  const y1 = b.b - a;
  const r = b.r - right;
  const t = b.t + top;
  const W = r - b.l;
  return {
    outline: d('M', b.l, t, 'H', r, 'V', y1, 'C', r - W * 0.35, y1 - a * 1.6, b.l + W * 0.35, y1 + a * 1.6, b.l, y1, 'Z'),
    bottom: y1 - a,
  };
}

function circle(w: number, h: number, extra: Partial<ShapeGeometry> = {}, stroke = 0): ShapeGeometry {
  const r = Math.max(2, Math.min(w, h) / 2 - S - stroke / 2 + (stroke ? 0.75 : 0));
  const side = r * 2 * 0.72;
  return { outline: ellipse(w / 2, h / 2, r, r), decorations: [], textBox: box(w / 2 - side / 2, h / 2 - side / 2, side, side), ...extra };
}

const outsideLabel = (w: number, h: number): Box => box(w / 2 - 64, h + 4, 128, 36);

function diamond(w: number, h: number): string {
  const b = B(w, h);
  return poly([[b.cx, b.t], [b.r, b.cy], [b.cx, b.b], [b.l, b.cy]]);
}

/** Person bust: a head and a dome of shoulders. */
function bust(w: number, top: number, fh: number): { head: string; dome: string } {
  const cx = w / 2;
  const r = fh * 0.2;
  const domeTop = top + 2 * r + 3;
  const domeH = top + fh - domeTop;
  const sw = Math.min(w / 2 - 6, domeH * 1.3);
  return {
    head: ellipse(cx, top + r, r, r),
    dome: d('M', cx - sw, top + fh, 'A', sw, domeH, 0, 0, 1, cx + sw, top + fh, 'Z'),
  };
}

function tabbed(w: number, h: number, label?: string): ShapeGeometry {
  const b = B(w, h);
  const tabW = Math.min(Math.max(72, (label?.length ?? 8) * 7.6 + 28), b.w * 0.7);
  const tabH = 24;
  return {
    outline: d('M', b.l, b.t, 'H', b.l + tabW, 'V', b.t + tabH, 'H', b.r, 'V', b.b, 'H', b.l, 'Z'),
    decorations: [],
    textBox: box(10, 4, tabW - 16, tabH - 8),
    outlineFill: 'tint',
  };
}

const compartments = (w: number, h: number, rad = 6): ShapeGeometry => card(w, h, rad, 0, 0, { radius: rad });

// ---------- the registry ----------
export const RENDERERS: Record<string, Renderer> = {
  // flowchart
  'flowchart.process': (w, h) => card(w, h, 6, 12, 8),
  'flowchart.decision': (w, h) => ({ outline: diamond(w, h), decorations: [], textBox: box(w * 0.25, h * 0.25, w * 0.5, h * 0.5) }),
  'flowchart.terminator': (w, h) => {
    const b = B(w, h);
    return { outline: rrect(b.l, b.t, b.r, b.b, b.h / 2), decorations: [], textBox: box(h * 0.4, 6, w - h * 0.8, h - 12) };
  },
  'flowchart.io': (w, h) => {
    const b = B(w, h);
    const s = Math.min(24, b.w * 0.14);
    return { outline: poly([[b.l + s, b.t], [b.r, b.t], [b.r - s, b.b], [b.l, b.b]]), decorations: [], textBox: box(s + 8, 8, w - 2 * s - 16, h - 16) };
  },
  'flowchart.document': (w, h) => {
    const doc = docShape(w, h);
    return { outline: doc.outline, decorations: [], textBox: box(12, 8, w - 24, Math.max(0, doc.bottom - 10)) };
  },
  'flowchart.multi-document': (w, h) => {
    const b = B(w, h);
    const front = docShape(w, h, 8, 8);
    const a = Math.min(10, b.h * 0.14);
    const y1 = b.b - a;
    const layer = (o: number) => d('M', b.l + o, b.t + 8, 'V', b.t + 8 - o, 'H', b.r - 8 + o, 'V', y1 - o, 'H', b.r - 8);
    return {
      outline: front.outline,
      decorations: [{ d: layer(4) }, { d: layer(8) }],
      textBox: box(12, 8 + 8, w - 8 - 24, Math.max(0, front.bottom - 8 - 12)),
    };
  },
  'flowchart.database': (w, h) => cylinder(w, h),
  'flowchart.subprocess': (w, h) => {
    const b = B(w, h);
    return card(w, h, 6, 20, 8, { decorations: [{ d: d('M', b.l + 12, b.t, 'V', b.b) }, { d: d('M', b.r - 12, b.t, 'V', b.b) }] });
  },
  'flowchart.manual-input': (w, h) => {
    const b = B(w, h);
    return { outline: poly([[b.l, b.t + 12], [b.r, b.t], [b.r, b.b], [b.l, b.b]]), decorations: [], textBox: box(12, 16, w - 24, h - 24) };
  },
  'flowchart.preparation': (w, h) => {
    const b = B(w, h);
    const i = Math.min(20, b.w * 0.12);
    return { outline: poly([[b.l + i, b.t], [b.r - i, b.t], [b.r, b.cy], [b.r - i, b.b], [b.l + i, b.b], [b.l, b.cy]]), decorations: [], textBox: box(i + 6, 8, w - 2 * i - 12, h - 16) };
  },
  'flowchart.delay': (w, h) => {
    const b = B(w, h);
    const rad = b.h / 2;
    return { outline: d('M', b.l, b.t, 'H', b.r - rad, 'A', rad, rad, 0, 0, 1, b.r - rad, b.b, 'H', b.l, 'Z'), decorations: [], textBox: box(12, 8, w - rad - 24, h - 16) };
  },
  'flowchart.display': (w, h) => {
    const b = B(w, h);
    const p = Math.min(20, b.w * 0.12);
    const rad = b.h / 2;
    return {
      outline: d('M', b.l, b.cy, 'L', b.l + p, b.t, 'H', b.r - rad, 'A', rad, rad, 0, 0, 1, b.r - rad, b.b, 'H', b.l + p, 'Z'),
      decorations: [],
      textBox: box(p + 8, 8, w - p - rad - 20, h - 16),
    };
  },
  'flowchart.connector': (w, h) => circle(w, h),
  'flowchart.off-page': (w, h) => {
    const b = B(w, h);
    const k = b.t + b.h * 0.62;
    return { outline: poly([[b.l, b.t], [b.r, b.t], [b.r, k], [b.cx, b.b], [b.l, k]]), decorations: [], textBox: box(6, 6, w - 12, k - 10) };
  },

  // UML
  'uml.class': (w, h) => compartments(w, h),
  'uml.interface': (w, h) => compartments(w, h),
  'uml.enum': (w, h) => compartments(w, h),
  'uml.object': (w, h) => compartments(w, h),
  'uml.state': (w, h) => compartments(w, h, 12),
  'uml.actor': (w, h) => {
    const fh = Math.max(24, h - 34);
    const r = fh * 0.16;
    const cx = w / 2;
    const top = S;
    const hip = top + fh * 0.62;
    const arm = Math.min(fh * 0.3, w / 2 - 2);
    const leg = Math.min(fh * 0.24, w / 2 - 2);
    const armY = top + 2 * r + (hip - top - 2 * r) * 0.28;
    return {
      outline: ellipse(cx, top + r, r, r),
      decorations: [
        { d: d('M', cx, top + 2 * r, 'V', hip, 'M', cx - arm, armY, 'H', cx + arm, 'M', cx - leg, top + fh - S, 'L', cx, hip, 'L', cx + leg, top + fh - S), fill: 'none' },
      ],
      textBox: box(0, h - 30, w, 30),
      figure: box(0, 0, w, fh),
    };
  },
  'uml.use-case': (w, h) => {
    const b = B(w, h);
    return { outline: ellipse(b.cx, b.cy, b.w / 2, b.h / 2), decorations: [], textBox: box(w * 0.14, h * 0.14, w * 0.72, h * 0.72) };
  },
  'uml.component': (w, h) => {
    const x = w - 12 - 16;
    const y = 10;
    return card(w, h, 6, 12, 8, {
      textBox: withGlyphBox(w, h),
      decorations: [
        { d: rect(x + 3, y + 1.5, x + 15, y + 13.5), fill: 'bg', muted: true, width: 1.25 },
        { d: rect(x, y + 4, x + 6, y + 6.5), fill: 'bg', muted: true, width: 1.25 },
        { d: rect(x, y + 8.5, x + 6, y + 11), fill: 'bg', muted: true, width: 1.25 },
      ],
    });
  },
  'uml.node': (w, h) => {
    const b = B(w, h);
    const k = 12;
    return {
      outline: rect(b.l, b.t + k, b.r - k, b.b),
      decorations: [
        { d: poly([[b.l, b.t + k], [b.l + k, b.t], [b.r, b.t], [b.r - k, b.t + k]]), fill: 'shade' },
        { d: poly([[b.r - k, b.t + k], [b.r, b.t], [b.r, b.b - k], [b.r - k, b.b]]), fill: 'shade' },
      ],
      textBox: box(12, k + 8, w - k - 24, h - k - 16),
    };
  },
  'uml.package': (w, h, o) => tabbed(w, h, o?.label),
  'uml.note': (w, h) => {
    const b = B(w, h);
    const k = 12;
    return {
      outline: d('M', b.l, b.t, 'H', b.r - k, 'L', b.r, b.t + k, 'V', b.b, 'H', b.l, 'Z'),
      decorations: [{ d: d('M', b.r - k, b.t, 'V', b.t + k, 'H', b.r), fill: 'none' }],
      textBox: box(10, 8, w - 20, h - 16),
    };
  },
  'uml.initial': (w, h) => circle(w, h, { outlineFill: 'ink', textBox: NONE_BOX(w, h) }),
  'uml.final': (w, h) => {
    const g = circle(w, h, { outlineFill: 'surface', textBox: NONE_BOX(w, h) });
    const r = Math.max(2, Math.min(w, h) / 2 - S);
    return { ...g, decorations: [{ d: ellipse(w / 2, h / 2, r * 0.55, r * 0.55), fill: 'ink', width: 0 }] };
  },
  'uml.choice': (w, h) => ({ outline: diamond(w, h), decorations: [], textBox: outsideLabel(w, h), labelOutside: true, figure: box(0, 0, w, h) }),
  'uml.fork': (w, h) => {
    const b = B(w, h);
    return { outline: rrect(b.l, b.t, b.r, b.b, Math.min(2, b.h / 2)), decorations: [], textBox: NONE_BOX(w, h), outlineFill: 'ink' };
  },
  'uml.activity': (w, h) => card(w, h, 12, 14, 8),

  // C4
  'c4.person': (w, h) => c4Person(w, h),
  'c4.person-external': (w, h) => c4Person(w, h),
  'c4.system': (w, h) => card(w, h, 6, 12, 10),
  'c4.system-external': (w, h) => card(w, h, 6, 12, 10),
  'c4.container': (w, h) => card(w, h, 6, 12, 10),
  'c4.container-db': (w, h) => cylinder(w, h, { ryMax: 16 }),
  'c4.container-queue': (w, h) => pipe(w, h),
  'c4.container-web': (w, h) => {
    const b = B(w, h);
    const dot = (x: number) => ellipse(b.l + x, b.t + 10, 2.5, 2.5);
    return card(w, h, 6, 12, 10, {
      decorations: [
        { d: d('M', b.l, b.t + 20, 'H', b.r) },
        { d: dot(12) + dot(22) + dot(32), fill: 'muted', width: 0 },
      ],
      textBox: box(12, 28, w - 24, h - 28 - 12),
    });
  },
  'c4.component': (w, h) => card(w, h, 6, 12, 10),
  'c4.boundary': (w, h) => {
    const b = B(w, h);
    return { outline: rrect(b.l, b.t, b.r, b.b, 8), decorations: [], textBox: box(12, Math.max(0, h - 48), w - 24, Math.min(40, h)), outlineFill: 'none', outlineDash: '6 4' };
  },

  // ERD
  'erd.entity': (w, h) => compartments(w, h),
  'erd.view': (w, h) => ({ ...compartments(w, h), outlineDash: '6 4' }),

  // architecture
  'arch.service': (w, h) => card(w, h, 6, 12, 8, { decorations: [glyphAt('service', w)], textBox: withGlyphBox(w, h) }),
  'arch.database': (w, h) => cylinder(w, h, { stripes: 1 }),
  'arch.cache': (w, h) => card(w, h, 6, 12, 8, { decorations: [glyphAt('cache', w)], textBox: withGlyphBox(w, h) }),
  'arch.queue': (w, h) => pipe(w, h),
  'arch.gateway': (w, h) => card(w, h, 6, 12, 8, { decorations: [glyphAt('gateway', w)], textBox: withGlyphBox(w, h) }),
  'arch.load-balancer': (w, h) => card(w, h, 6, 12, 8, { decorations: [glyphAt('balancer', w)], textBox: withGlyphBox(w, h) }),
  'arch.cdn': (w, h) => card(w, h, 6, 12, 8, { decorations: [glyphAt('cdn', w)], textBox: withGlyphBox(w, h) }),
  'arch.client': (w, h) => {
    const b = B(w, h);
    const dot = (x: number) => ellipse(b.l + x, b.t + 10, 2.5, 2.5);
    return card(w, h, 6, 12, 8, {
      decorations: [{ d: d('M', b.l, b.t + 20, 'H', b.r) }, { d: dot(12) + dot(22) + dot(32), fill: 'muted', width: 0 }],
      textBox: box(12, 28, w - 24, h - 28 - 12),
    });
  },
  'arch.mobile': (w, h) => {
    const fh = Math.max(40, h - 36);
    const pw = Math.min(w - 4, fh * 0.52);
    const x0 = (w - pw) / 2;
    const cx = w / 2;
    return {
      outline: rrect(x0 + S, S, x0 + pw - S, fh - S, 8),
      decorations: [
        { d: d('M', cx - 7, 8, 'H', cx + 7), muted: true },
        { d: d('M', cx - 9, fh - 8, 'H', cx + 9), muted: true },
      ],
      textBox: box(0, h - 32, w, 30),
      figure: box(x0, 0, pw, fh),
    };
  },
  'arch.function': (w, h) => card(w, h, 6, 12, 8, { decorations: [glyphAt('fn', w)], textBox: withGlyphBox(w, h) }),
  'arch.storage': (w, h) => {
    const b = B(w, h);
    const rx = b.w / 2;
    const ry = Math.min(12, b.h * 0.14);
    const tp = b.w * 0.08;
    return {
      outline: d('M', b.l, b.t + ry, 'A', rx, ry, 0, 0, 1, b.r, b.t + ry, 'L', b.r - tp, b.b - ry, 'A', rx - tp, ry, 0, 0, 1, b.l + tp, b.b - ry, 'Z'),
      decorations: [{ d: d('M', b.l, b.t + ry, 'A', rx, ry, 0, 0, 0, b.r, b.t + ry) }],
      textBox: box(tp + 12, 2 * ry + 4, w - 2 * tp - 24, h - 3 * ry - 10),
    };
  },
  'arch.user': (w, h) => {
    const fh = Math.max(40, h - 34);
    const { head, dome } = bust(w, S, fh);
    return { outline: dome, decorations: [{ d: head, fill: 'surface' }], textBox: box(0, h - 30, w, 30), figure: box(0, 0, w, fh) };
  },
  'arch.external': (w, h) => card(w, h, 6, 12, 8, { decorations: [glyphAt('cloud', w)], textBox: withGlyphBox(w, h) }),
  'arch.region': (w, h) => {
    const b = B(w, h);
    return { outline: rrect(b.l, b.t, b.r, b.b, 12), decorations: [], textBox: box(12, 8, w - 24, 24), outlineFill: 'tint', outlineDash: '4 4' };
  },

  // BPMN
  'bpmn.task': (w, h) => card(w, h, 8, 12, 8),
  'bpmn.subprocess': (w, h) => {
    const b = B(w, h);
    const x = b.cx;
    const y = b.b - 18;
    return card(w, h, 8, 12, 8, {
      decorations: [
        { d: rect(x - 7, y, x + 7, y + 14), fill: 'none' },
        { d: d('M', x - 4, y + 7, 'H', x + 4, 'M', x, y + 3, 'V', y + 11) },
      ],
      textBox: box(12, 8, w - 24, h - 8 - 24),
    });
  },
  'bpmn.start': (w, h) => circle(w, h, { textBox: outsideLabel(w, h), labelOutside: true, figure: box(0, 0, w, h) }),
  'bpmn.intermediate': (w, h) => {
    const r = Math.max(2, Math.min(w, h) / 2 - S);
    return circle(w, h, { textBox: outsideLabel(w, h), labelOutside: true, figure: box(0, 0, w, h), decorations: [{ d: ellipse(w / 2, h / 2, Math.max(1, r - 4), Math.max(1, r - 4)), fill: 'none' }] });
  },
  'bpmn.end': (w, h) => circle(w, h, { textBox: outsideLabel(w, h), labelOutside: true, figure: box(0, 0, w, h), outlineWidth: 3.5 }, 3.5),
  'bpmn.gateway-exclusive': (w, h) => {
    const s = Math.min(w, h) * 0.16;
    return {
      outline: diamond(w, h),
      decorations: [{ d: d('M', w / 2 - s, h / 2 - s, 'L', w / 2 + s, h / 2 + s, 'M', w / 2 + s, h / 2 - s, 'L', w / 2 - s, h / 2 + s), width: 2 }],
      textBox: outsideLabel(w, h),
      labelOutside: true,
      figure: box(0, 0, w, h),
    };
  },
  'bpmn.gateway-parallel': (w, h) => {
    const s = Math.min(w, h) * 0.22;
    return {
      outline: diamond(w, h),
      decorations: [{ d: d('M', w / 2, h / 2 - s, 'V', h / 2 + s, 'M', w / 2 - s, h / 2, 'H', w / 2 + s), width: 2 }],
      textBox: outsideLabel(w, h),
      labelOutside: true,
      figure: box(0, 0, w, h),
    };
  },
  'bpmn.data-object': (w, h) => {
    const b = B(w, h);
    const k = Math.min(12, b.w * 0.3);
    return {
      outline: d('M', b.l, b.t, 'H', b.r - k, 'L', b.r, b.t + k, 'V', b.b, 'H', b.l, 'Z'),
      decorations: [{ d: d('M', b.r - k, b.t, 'V', b.t + k, 'H', b.r) }],
      textBox: outsideLabel(w, h),
      labelOutside: true,
      figure: box(0, 0, w, h),
    };
  },
  'bpmn.pool': (w, h) => {
    const b = B(w, h);
    const band = 32;
    return {
      outline: rect(b.l, b.t, b.r, b.b),
      decorations: [{ d: rect(b.l, b.t, b.l + band, b.b), fill: 'shade' }],
      textBox: box(0, 0, band, h),
      outlineFill: 'tint',
    };
  },
};

function c4Person(w: number, h: number): ShapeGeometry {
  const b = B(w, h);
  const r = Math.max(10, Math.min(26, h * 0.14, w * 0.14));
  const top = b.t + 2 * r - 8;
  return {
    outline: rrect(b.l, top, b.r, b.b, 16),
    decorations: [{ d: ellipse(w / 2, S + r, r, r), fill: 'surface' }],
    textBox: box(12, 2 * r + 4, w - 24, h - 2 * r - 4 - 10),
    figure: box(w / 2 - r, 0, 2 * r, 2 * r),
  };
}

const RECT_FALLBACK: Renderer = (w, h) => card(w, h, 6, 12, 8);

/** Geometry for a shape id at a size (unknown ids draw as a plain card). */
export function geometryFor(shapeId: string | undefined, w: number, h: number, opts?: GeometryOpts): ShapeGeometry {
  const rw = Math.max(1, w);
  const rh = Math.max(1, h);
  return (shapeId ? RENDERERS[shapeId] : undefined)?.(rw, rh, opts) ?? RECT_FALLBACK(rw, rh, opts);
}

/** Default and minimum size of a shape (falls back to 176 x 72). */
export const sizeOfShape = (shapeId: string | undefined): [number, number] => shapeById(shapeId)?.size ?? [176, 72];
export const minSizeOfShape = (shapeId: string | undefined): [number, number] => {
  const s = shapeById(shapeId);
  if (s?.frame) return s.minSize ?? [160, 96];
  return s?.minSize ?? [Math.min(48, s?.size[0] ?? 48), Math.min(32, s?.size[1] ?? 32)];
};

/** Ids that have no renderer (must be empty; asserted in tests). */
export const missingRenderers = (): string[] => SHAPES.filter((s) => !RENDERERS[s.id]).map((s) => s.id);
