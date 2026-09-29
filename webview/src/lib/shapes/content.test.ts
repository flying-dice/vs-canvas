import { describe, expect, it } from 'vitest';
import { bracketed, c4TypeLine, linesOf, parseColumn, splitText } from './content';
import { searchShapes } from './search';

describe('content', () => {
  it('splits name and description', () => {
    expect(splitText('# API\nHandles orders\nand charges')).toEqual({ name: 'API', description: 'Handles orders\nand charges' });
    expect(splitText('')).toEqual({ name: '', description: '' });
  });
  it('reads list fields from arrays or strings', () => {
    expect(linesOf(['a', '', 'b '])).toEqual(['a', 'b']);
    expect(linesOf('x\n\ny')).toEqual(['x', 'y']);
    expect(linesOf(undefined)).toEqual([]);
  });
  it('builds the C4 type line', () => {
    expect(c4TypeLine('c4.container', 'Node.js')).toBe('[Container: Node.js]');
    expect(c4TypeLine('c4.system')).toBe('[Software System]');
    expect(bracketed('JSON/HTTPS')).toBe('[JSON/HTTPS]');
    expect(bracketed('[X]')).toBe('[X]');
  });
  it('parses ERD columns and key badges', () => {
    expect(parseColumn('id uuid PK')).toMatchObject({ name: 'id', type: 'uuid', pk: true, fk: false });
    expect(parseColumn('order_id uuid FK')).toMatchObject({ fk: true, pk: false });
    expect(parseColumn('amount numeric(12,2)')).toMatchObject({ name: 'amount', type: 'numeric(12,2)' });
    expect(parseColumn('email text UNIQUE')).toMatchObject({ unique: true, type: 'text' });
  });
});

describe('searchShapes', () => {
  it('finds shapes by name, keyword and library', () => {
    expect(searchShapes('decision')[0].id).toBe('flowchart.decision');
    expect(searchShapes('c4 container')[0].id).toBe('c4.container');
    expect(searchShapes('lambda').map((s) => s.id)).toContain('arch.function');
    expect(searchShapes('zzzz')).toEqual([]);
  });
  it('can exclude frames', () => {
    expect(searchShapes('boundary', { frames: false })).toEqual([]);
    expect(searchShapes('boundary').length).toBeGreaterThan(0);
  });
});
