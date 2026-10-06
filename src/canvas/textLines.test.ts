import { describe, expect, it } from 'vitest';
import { lineAt, lineOfFlowsKey, lineOfId } from './textLines';

describe('lineAt', () => {
  it('counts newlines before the index', () => {
    expect(lineAt('a\nb\nc', 0)).toBe(0);
    expect(lineAt('a\nb\nc', 2)).toBe(1);
    expect(lineAt('a\nb\nc', 4)).toBe(2);
  });
});

describe('lineOfId', () => {
  const text = '{\n  "nodes": [\n    {\n      "id": "a.b"\n    }\n  ]\n}';
  it('finds an id, escaping regex characters', () => {
    expect(lineOfId(text, 'a.b')).toBe(3);
    expect(lineOfId(text, 'axb')).toBe(0);
    expect(lineOfId(text, undefined)).toBe(0);
  });
});

describe('lineOfFlowsKey', () => {
  it('ignores a flows property on an earlier node', () => {
    const text = [
      '{', '  "nodes": [', '    {', '      "id": "n",', '      "flows": 1', '    }', '  ],', '  "edges": [],',
      '  "vsCanvas": {', '    "version": 1,', '    "flows": []', '  }', '}',
    ].join('\n');
    expect(lineOfFlowsKey(text)).toBe(10);
  });
  it('supports the canvasIde key and falls back to the metadata line', () => {
    expect(lineOfFlowsKey('{\n "nodes": [],\n "canvasIde": {\n  "flows": []\n }\n}')).toBe(3);
    expect(lineOfFlowsKey('{\n "nodes": [],\n "vsCanvas": {}\n}')).toBe(2);
    expect(lineOfFlowsKey('{"nodes":[]}')).toBe(0);
  });
});
