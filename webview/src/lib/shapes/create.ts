// What adding a shape creates: the node spec (without id / position) and its size.
import { shapeById, type ShapeDef } from '../../../../src/shared/shapes';
import type { NewNode } from '../../canvas/kinds';

export const SHAPE_KIND_PREFIX = 'shape:';
export const shapeKind = (id: string) => `${SHAPE_KIND_PREFIX}${id}`;
export const shapeIdOfKind = (kind: string): string | undefined => (kind.startsWith(SHAPE_KIND_PREFIX) ? kind.slice(SHAPE_KIND_PREFIX.length) : undefined);

export function newShape(def: ShapeDef): { size: [number, number]; node: NewNode } {
  return {
    size: def.size,
    node: def.frame ? { type: 'group', label: def.name, shape: def.id } : { type: 'text', variant: 'shape', shape: def.id, text: def.name },
  };
}

export const newShapeById = (id: string) => {
  const def = shapeById(id);
  return def ? newShape(def) : undefined;
};

/** dataTransfer type used when dragging a shape from the palette onto the canvas. */
export const SHAPE_MIME = 'application/x-vscanvas-shape';
