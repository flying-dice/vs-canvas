import { describe, expect, it } from 'vitest';
import { DEFAULT_PORT, MCP_SERVER_NAME, PORT_SPAN, mcpJsonUrl, mergeMcpJson, workspacePort } from './port';

describe('workspacePort', () => {
  it('is stable for a folder name and case-insensitive', () => {
    expect(workspacePort('acme-shop')).toBe(workspacePort('acme-shop'));
    expect(workspacePort('Acme-Shop')).toBe(workspacePort('acme-shop'));
  });
  it('stays in range and uses the default for an empty window', () => {
    for (const n of ['a', 'canvas-ide', 'acme-shop', 'x'.repeat(200), 'ünïcødé']) {
      const p = workspacePort(n);
      expect(p).toBeGreaterThanOrEqual(DEFAULT_PORT);
      expect(p).toBeLessThan(DEFAULT_PORT + PORT_SPAN);
    }
    expect(workspacePort(undefined)).toBe(DEFAULT_PORT);
  });
  it('spreads different projects over different ports', () => {
    const names = ['api', 'web', 'acme-shop', 'canvas-ide', 'payments', 'ledger', 'infra', 'docs'];
    expect(new Set(names.map(workspacePort)).size).toBeGreaterThanOrEqual(7);
  });
});

describe('mergeMcpJson', () => {
  const url = 'http://127.0.0.1:3812/mcp';
  it('creates the file content when missing', () => {
    const out = JSON.parse(mergeMcpJson(undefined, url)!);
    expect(out).toEqual({ mcpServers: { [MCP_SERVER_NAME]: { type: 'http', url } } });
  });
  it('preserves other servers and keys', () => {
    const existing = JSON.stringify({ mcpServers: { other: { command: 'x' } }, extra: 1 });
    const out = JSON.parse(mergeMcpJson(existing, url)!);
    expect(out.mcpServers.other).toEqual({ command: 'x' });
    expect(out.extra).toBe(1);
    expect(out.mcpServers[MCP_SERVER_NAME].url).toBe(url);
  });
  it('returns undefined when already up to date, and updates a stale port', () => {
    const current = mergeMcpJson(undefined, url)!;
    expect(mergeMcpJson(current, url)).toBeUndefined();
    expect(mcpJsonUrl(mergeMcpJson(current, 'http://127.0.0.1:3900/mcp'))).toBe('http://127.0.0.1:3900/mcp');
  });
  it('rejects invalid JSON rather than overwriting it', () => {
    expect(() => mergeMcpJson('{ nope', url)).toThrow();
    expect(mcpJsonUrl('{ nope')).toBeUndefined();
  });
});
