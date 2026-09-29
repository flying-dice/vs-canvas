// Stable per-workspace MCP ports and the Claude Code project config (.mcp.json). Pure, no vscode import.

export const DEFAULT_PORT = 3777;
/** Ports are spread over [DEFAULT_PORT, DEFAULT_PORT + PORT_SPAN). */
export const PORT_SPAN = 200;
export const MCP_SERVER_NAME = 'vs-canvas';

/**
 * The port for a workspace, derived from its folder name (not the full path) so teammates who clone the repo into
 * a folder of the same name get the same port, which keeps a committed .mcp.json valid for everyone.
 * No folder (empty window) -> DEFAULT_PORT.
 */
export function workspacePort(folderName: string | undefined): number {
  if (!folderName) return DEFAULT_PORT;
  // FNV-1a, 32-bit.
  let h = 0x811c9dc5;
  for (const ch of folderName.toLowerCase()) {
    h ^= ch.codePointAt(0)!;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return DEFAULT_PORT + (h % PORT_SPAN);
}

export type McpJson = { mcpServers?: Record<string, unknown>; [key: string]: unknown };

/**
 * Merge our server entry into existing .mcp.json text (other servers and keys are preserved). Returns the new text,
 * or undefined when the file already points at `url` (nothing to write). Throws on invalid JSON.
 */
export function mergeMcpJson(existing: string | undefined, url: string): string | undefined {
  const cfg: McpJson = existing?.trim() ? (JSON.parse(existing) as McpJson) : {};
  if (typeof cfg !== 'object' || cfg === null || Array.isArray(cfg)) throw new Error('.mcp.json must contain a JSON object');
  const servers = (cfg.mcpServers && typeof cfg.mcpServers === 'object' ? cfg.mcpServers : {}) as Record<string, unknown>;
  const current = servers[MCP_SERVER_NAME] as { type?: string; url?: string } | undefined;
  if (current?.type === 'http' && current.url === url) return undefined;
  servers[MCP_SERVER_NAME] = { type: 'http', url };
  cfg.mcpServers = servers;
  return JSON.stringify(cfg, null, 2) + '\n';
}

/** The url our entry in .mcp.json points at, if any. */
export function mcpJsonUrl(existing: string | undefined): string | undefined {
  try {
    const cfg = existing?.trim() ? (JSON.parse(existing) as McpJson) : undefined;
    const e = cfg?.mcpServers?.[MCP_SERVER_NAME] as { url?: unknown } | undefined;
    return typeof e?.url === 'string' ? e.url : undefined;
  } catch {
    return undefined;
  }
}
