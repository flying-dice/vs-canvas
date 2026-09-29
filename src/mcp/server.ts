import * as http from 'node:http';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import * as vscode from 'vscode';
import type { CanvasEditorProvider } from '../canvas/editor';
import type { CanvasDocuments } from '../canvas/documents';
import { MCP_INSTRUCTIONS } from './instructions';
import { registerTools } from './tools';

const rpcError = (res: http.ServerResponse, status: number, message: string) => {
  if (res.headersSent) return;
  res.writeHead(status, { 'content-type': 'application/json', ...(status === 405 && { allow: 'POST' }) });
  res.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32000, message }, id: null }));
};

async function readJson(req: http.IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const text = Buffer.concat(chunks).toString('utf8');
  return text ? JSON.parse(text) : undefined;
}

export class CanvasMcpServer implements vscode.Disposable {
  private server: http.Server | undefined;
  private port: number | undefined;
  private readonly emitter = new vscode.EventEmitter<string | undefined>();
  readonly onDidChangeUrl = this.emitter.event;

  constructor(
    private readonly docs: CanvasDocuments,
    private readonly editor: CanvasEditorProvider,
    private readonly log: (msg: string) => void,
  ) {}

  get url(): string | undefined {
    return this.port ? `http://127.0.0.1:${this.port}/mcp` : undefined;
  }

  async start(basePort: number): Promise<void> {
    await this.stop();
    for (let port = basePort; port <= basePort + 10; port++) {
      const server = http.createServer((req, res) => void this.handle(port, req, res));
      try {
        await new Promise<void>((resolve, reject) => {
          server.once('error', reject);
          server.listen(port, '127.0.0.1', () => {
            server.off('error', reject);
            resolve();
          });
        });
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code === 'EADDRINUSE') {
          this.log(`Port ${port} in use, trying next`);
          continue;
        }
        throw e;
      }
      this.server = server;
      this.port = port;
      this.log(`MCP server listening on ${this.url}`);
      this.emitter.fire(this.url);
      return;
    }
    this.emitter.fire(undefined);
    throw new Error(`No free port in ${basePort}-${basePort + 10}`);
  }

  private async handle(port: number, req: http.IncomingMessage, res: http.ServerResponse) {
    const path = (req.url ?? '').split('?')[0];
    try {
      if (path === '/health') {
        res.writeHead(200, { 'content-type': 'text/plain' }).end('ok');
      } else if (path === '/mcp' && req.method === 'POST') {
        await this.handleMcp(port, req, res);
      } else if (path === '/mcp') {
        rpcError(res, 405, 'Method not allowed.');
      } else {
        res.writeHead(404).end();
      }
    } catch (e) {
      this.log(`Request error: ${e instanceof Error ? e.stack : e}`);
      rpcError(res, e instanceof SyntaxError ? 400 : 500, e instanceof SyntaxError ? 'Invalid JSON' : 'Internal server error');
    }
  }

  private async handleMcp(port: number, req: http.IncomingMessage, res: http.ServerResponse) {
    const body = await readJson(req);
    const mcp = new McpServer({ name: 'vs-canvas', version: '0.0.1' }, { instructions: MCP_INSTRUCTIONS });
    registerTools(mcp, this.docs, this.editor);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
      enableDnsRebindingProtection: true,
      allowedHosts: [`127.0.0.1:${port}`, `localhost:${port}`],
    });
    res.on('close', () => {
      void transport.close();
      void mcp.close();
    });
    await mcp.connect(transport);
    await transport.handleRequest(req, res, body);
  }

  private async stop() {
    const s = this.server;
    this.server = undefined;
    this.port = undefined;
    if (s) await new Promise<void>((r) => { s.close(() => r()); s.closeAllConnections(); });
  }

  dispose() {
    void this.stop();
    this.emitter.dispose();
  }
}
