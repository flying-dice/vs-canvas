import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EDGE_MARKERS, RELATIONS, SHAPES } from './shapes';

const schema = JSON.parse(readFileSync(join(__dirname, '../../schemas/canvas.schema.json'), 'utf8'));
const defs = schema.definitions;

describe('canvas.schema.json stays in sync with shapes.ts', () => {
  it('lists every shape, frame, relation and marker', () => {
    expect(defs.textNode.properties.shape.enum).toEqual(SHAPES.map((s) => s.id));
    expect(defs.groupNode.properties.shape.enum).toEqual(SHAPES.filter((s) => s.frame).map((s) => s.id));
    expect(defs.edge.properties.relation.enum).toEqual(RELATIONS.map((r) => r.id));
    expect(defs.marker.enum).toEqual([...EDGE_MARKERS]);
    expect(defs.textNode.properties.variant.enum).toContain('shape');
  });
});
