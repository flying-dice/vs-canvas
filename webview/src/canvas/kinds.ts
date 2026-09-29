// What "add X" creates for each quick-add id, and the geometry helpers that place a new node relative to a point.
import type { CanvasFileNode, DistributiveOmit } from '../../../src/shared/protocol';

export type NewNode = DistributiveOmit<CanvasFileNode, 'id' | 'x' | 'y' | 'width' | 'height'>;
export type KindDefault = { size: [number, number]; node: NewNode };

export const KIND_DEFAULTS: Record<string, KindDefault> = {
  sticky: { size: [224, 176], node: { type: 'text', variant: 'sticky', text: '', color: '3' } },
  text: { size: [400, 64], node: { type: 'text', variant: 'plain', text: '# Title' } },
  note: { size: [360, 224], node: { type: 'text', variant: 'note', text: '# Note\n\nWrite **markdown** here.' } },
  mermaid: { size: [480, 360], node: { type: 'text', variant: 'mermaid', text: 'flowchart LR\n  A --> B' } },
  group: { size: [480, 320], node: { type: 'group', label: 'Group' } },
  finding: {
    size: [336, 168],
    node: { type: 'text', variant: 'finding', findingKind: 'hypothesis', status: 'open', title: 'Hypothesis', text: '' },
  },
  log: { size: [520, 232], node: { type: 'text', variant: 'log', title: 'Log', text: '' } },
  service: { size: [360, 280], node: { type: 'text', variant: 'service', title: 'Service', text: '' } },
  link: { size: [336, 88], node: { type: 'link', url: 'https://example.com', title: 'Link' } },
};

/** Size assumed for a code node picked from the workspace (only used to place its arrow end). */
export const CODE_SIZE: [number, number] = [520, 184];

export type Dir = 'right' | 'left' | 'down' | 'up';

/** Which way an arrow travels from `from` to `to` (dominant axis). */
export function dirBetween(from: { x: number; y: number }, to: { x: number; y: number }): Dir {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 'right' : 'left') : dy >= 0 ? 'down' : 'up';
}

const grid = (v: number) => Math.round(v / 8) * 8;

/**
 * Top-left of a new node of `size` so that the dropped point lands in the middle of the node's edge that faces
 * the arrow's origin (arrow travelling right -> the point is the node's left-middle).
 */
export function placeAtEdge(p: { x: number; y: number }, size: [number, number], dir: Dir): { x: number; y: number } {
  const [w, h] = size;
  switch (dir) {
    case 'right': return { x: grid(p.x), y: grid(p.y - h / 2) };
    case 'left': return { x: grid(p.x - w), y: grid(p.y - h / 2) };
    case 'down': return { x: grid(p.x - w / 2), y: grid(p.y) };
    case 'up': return { x: grid(p.x - w / 2), y: grid(p.y - h) };
  }
}

/** Top-left for a node centred on `p`. */
export const placeCentered = (p: { x: number; y: number }, size: [number, number]) => ({
  x: grid(p.x - size[0] / 2),
  y: grid(p.y - size[1] / 2),
});
