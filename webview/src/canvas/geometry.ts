// Pure canvas geometry for interaction: hit tests, drop sides, code line under a point, align / distribute / group.
import { GEOMETRY } from '../../../src/shared/geometry';
import type { Side } from '../../../src/shared/protocol';

export type Box = { id: string; x: number; y: number; w: number; h: number };

export const inBox = (b: Box, x: number, y: number) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;

/** The side of a box a point is nearest to, by normalised offset from the centre. */
export function nearestSide(b: Box, px: number, py: number): Side {
  const dx = (px - (b.x + b.w / 2)) / Math.max(1, b.w);
  const dy = (py - (b.y + b.h / 2)) / Math.max(1, b.h);
  return Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'top' : 'bottom';
}

/** Absolute line number under flow-y `py` inside a code node's body, or undefined (header, padding, past the end). */
export function lineAt(b: Box, firstLine: number, lineCount: number, py: number): number | undefined {
  const i = Math.floor((py - b.y - GEOMETRY.codeHeaderHeight - GEOMETRY.codeBodyPaddingTop) / GEOMETRY.codeLineHeight);
  return i >= 0 && i < lineCount ? firstLine + i : undefined;
}

/** Top y (flow) of code line `line`. */
export const lineTop = (b: Box, firstLine: number, line: number) =>
  b.y + GEOMETRY.codeHeaderHeight + GEOMETRY.codeBodyPaddingTop + (line - firstLine) * GEOMETRY.codeLineHeight;

export type Align = 'left' | 'centerH' | 'top' | 'centerV';

/** New x/y per box id after aligning. */
export function alignBoxes(boxes: readonly Box[], how: Align): Map<string, { x: number; y: number }> {
  const out = new Map<string, { x: number; y: number }>();
  if (boxes.length < 2) return out;
  const minX = Math.min(...boxes.map((b) => b.x));
  const maxX = Math.max(...boxes.map((b) => b.x + b.w));
  const minY = Math.min(...boxes.map((b) => b.y));
  const maxY = Math.max(...boxes.map((b) => b.y + b.h));
  for (const b of boxes) {
    switch (how) {
      case 'left': out.set(b.id, { x: minX, y: b.y }); break;
      case 'top': out.set(b.id, { x: b.x, y: minY }); break;
      case 'centerH': out.set(b.id, { x: Math.round((minX + maxX) / 2 - b.w / 2), y: b.y }); break;
      case 'centerV': out.set(b.id, { x: b.x, y: Math.round((minY + maxY) / 2 - b.h / 2) }); break;
    }
  }
  return out;
}

/** Even gaps between boxes along an axis (first and last stay put). Needs 3+ boxes. */
export function distributeBoxes(boxes: readonly Box[], axis: 'x' | 'y'): Map<string, { x: number; y: number }> {
  const out = new Map<string, { x: number; y: number }>();
  if (boxes.length < 3) return out;
  const size = axis === 'x' ? 'w' : 'h';
  const sorted = [...boxes].sort((a, b) => a[axis] - b[axis]);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const span = last[axis] + last[size] - first[axis];
  const total = sorted.reduce((s, b) => s + b[size], 0);
  const gap = (span - total) / (sorted.length - 1);
  let cursor = first[axis];
  for (const b of sorted) {
    out.set(b.id, axis === 'x' ? { x: Math.round(cursor), y: b.y } : { x: b.x, y: Math.round(cursor) });
    cursor += b[size] + gap;
  }
  return out;
}

/** Group rect around boxes: 40px padding, plus the 36px label strip on top. */
export function groupAround(boxes: readonly Box[]) {
  const pad = 40;
  const minX = Math.min(...boxes.map((b) => b.x));
  const minY = Math.min(...boxes.map((b) => b.y));
  const maxX = Math.max(...boxes.map((b) => b.x + b.w));
  const maxY = Math.max(...boxes.map((b) => b.y + b.h));
  return {
    x: Math.round(minX - pad),
    y: Math.round(minY - pad - GEOMETRY.groupLabelHeight),
    width: Math.round(maxX - minX + 2 * pad),
    height: Math.round(maxY - minY + 2 * pad + GEOMETRY.groupLabelHeight),
  };
}
