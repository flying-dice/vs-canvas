import * as vscode from 'vscode';
import { CANVAS_VIEW_TYPE, CanvasDocuments } from './canvas/documents';
import { CanvasLintProvider } from './canvas/diagnostics';
import { CanvasEditorProvider } from './canvas/editor';
import { CanvasIndex } from './canvas/index';
import { CanvasCodeLens, CanvasesTree } from './canvas/views';
import { addHighlights, addNode, codeSize } from './canvas/model';
import { loadFile, workspaceRelPath } from './code/files';
import { installAgentSkills, refreshInstalledSkills } from './agent/install';
import { setUpClaudeCode, syncClaudeCodeConfig } from './mcp/claudeCode';
import { workspacePort } from './mcp/port';
import { CanvasMcpServer } from './mcp/server';
import { COLOR_PRESETS } from './shared/canvasFile';

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function activate(ctx: vscode.ExtensionContext) {
  const out = vscode.window.createOutputChannel('VS Canvas');
  const log = (m: string) => out.appendLine(`[${new Date().toISOString()}] ${m}`);
  const docs = new CanvasDocuments();
  const editor = new CanvasEditorProvider(ctx.extensionUri, docs, log);
  const server = new CanvasMcpServer(docs, editor, log);
  const lint = new CanvasLintProvider();
  const index = new CanvasIndex(docs);
  const defsChanged = new vscode.EventEmitter<void>();

  // Keep guides installed earlier by "Install Agent Skills" current (never creates files, never prompts).
  void refreshInstalledSkills().catch(() => {});

  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  status.command = 'vsCanvas.open';
  status.show();

  const refresh = () => {
    const url = server.url;
    editor.setMcpUrl(url ?? null);
    status.text = url ? `$(type-hierarchy) Canvas :${new URL(url).port}` : '$(type-hierarchy) Canvas (MCP off)';
    const pinned = index.pinned()[0];
    status.tooltip =
      (url ? `VS Canvas - MCP server: ${url}` : 'VS Canvas - MCP server not running') +
      (pinned ? `\nPinned map: ${pinned.title} (Ctrl/Cmd+Alt+M)` : '');
    defsChanged.fire();
  };
  server.onDidChangeUrl(refresh);
  server.onDidChangeUrl((url) => {
    if (url) void syncClaudeCodeConfig(url, ctx.workspaceState, log);
  });
  index.onDidChange(refresh);

  // `npm run dev` rebuilds the webview on change; reload open canvases so UI edits show up without a restart.
  // Extension-host changes still need "Developer: Restart Extension Host" (or Cmd/Ctrl+R in the dev host).
  if (ctx.extensionMode === vscode.ExtensionMode.Development) {
    const watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(vscode.Uri.joinPath(ctx.extensionUri, 'dist', 'webview'), 'index.html'),
    );
    let timer: NodeJS.Timeout | undefined;
    const reload = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        log('Webview bundle changed, reloading canvases');
        editor.reloadWebviews();
      }, 300);
    };
    ctx.subscriptions.push(watcher, watcher.onDidChange(reload), watcher.onDidCreate(reload));
  }

  // Each window runs its own server. The port is stable per workspace (derived from the folder name) unless
  // vsCanvas.mcp.port is set explicitly; if it is taken, the server falls back to the next free port.
  const basePort = () => {
    const i = vscode.workspace.getConfiguration('vsCanvas').inspect<number>('mcp.port');
    return i?.workspaceFolderValue ?? i?.workspaceValue ?? i?.globalValue ?? workspacePort(vscode.workspace.workspaceFolders?.[0]?.name);
  };
  const start = () =>
    server
      .start(basePort())
      .catch((e) => {
        log(`Failed to start MCP server: ${e}`);
        void vscode.window.showErrorMessage(`VS Canvas: MCP server failed to start: ${errMsg(e)}`);
      });
  void start();

  if (vscode.lm?.registerMcpServerDefinitionProvider) {
    ctx.subscriptions.push(
      vscode.lm.registerMcpServerDefinitionProvider('vsCanvas.mcp', {
        onDidChangeMcpServerDefinitions: defsChanged.event,
        provideMcpServerDefinitions: () =>
          server.url ? [new vscode.McpHttpServerDefinition('VS Canvas', vscode.Uri.parse(server.url))] : [],
      }),
    );
  }

  const openCanvas = (uri: vscode.Uri) => {
    docs.setActive(uri, true);
    return vscode.commands.executeCommand('vscode.openWith', uri, CANVAS_VIEW_TYPE);
  };

  const newCanvas = async () => {
    const name = await vscode.window.showInputBox({
      prompt: 'Canvas name', placeHolder: 'e.g. Auth flow', validateInput: (v) => (v.trim() ? undefined : 'Enter a name'),
    });
    if (!name) return;
    try {
      await openCanvas(await docs.create(name));
    } catch (e) {
      void vscode.window.showErrorMessage(`VS Canvas: ${errMsg(e)}`);
    }
  };

  ctx.subscriptions.push(
    out, status, docs, editor, lint, index, editor.register(), server, defsChanged,
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('vsCanvas.mcp.port')) void start();
      if (e.affectsConfiguration('vsCanvas.claudeCode.mcpJson') && server.url) {
        void syncClaudeCodeConfig(server.url, ctx.workspaceState, log);
      }
    }),
    vscode.commands.registerCommand('vsCanvas.newCanvas', newCanvas),
    vscode.window.createTreeView('vsCanvas.canvases', { treeDataProvider: new CanvasesTree(index), showCollapseAll: false }),
    vscode.languages.registerCodeLensProvider({ scheme: 'file' }, new CanvasCodeLens(index)),
    vscode.commands.registerCommand('vsCanvas.openCanvasFile', (uri: vscode.Uri) => openCanvas(uri)),
    vscode.commands.registerCommand('vsCanvas.openCanvasNode', async (uri: vscode.Uri, nodeId: string) => {
      docs.setActive(uri, true);
      await editor.reveal(uri);
      editor.focus(uri, [nodeId]);
    }),
    vscode.commands.registerCommand('vsCanvas.openPinned', async () => {
      await index.refresh();
      const pinned = index.pinned();
      if (!pinned.length) return void vscode.window.showInformationMessage('VS Canvas: no pinned canvas. Pin one from the Canvases view.');
      const maps = pinned.filter((c) => c.kind === 'map');
      const pool = maps.length ? maps : pinned;
      if (pool.length === 1) return void (await openCanvas(pool[0].uri));
      const pick = await vscode.window.showQuickPick(
        pool.map((c) => ({ label: c.title, description: c.path, uri: c.uri })), { placeHolder: 'Open pinned canvas' },
      );
      if (pick) await openCanvas(pick.uri);
    }),
    ...(['pin', 'unpin'] as const).map((k) =>
      vscode.commands.registerCommand(`vsCanvas.${k}Canvas`, async (item?: { uri?: vscode.Uri }) => {
        const uri = item?.uri;
        if (!uri) return;
        try {
          await docs.edit(uri, (f) => {
            const meta = { ...f.vsCanvas, version: 1 as const };
            if (k === 'pin') meta.pinned = true;
            else delete meta.pinned;
            f.vsCanvas = meta;
          }, { save: true });
          await index.refresh();
        } catch (e) {
          void vscode.window.showErrorMessage(`VS Canvas: ${errMsg(e)}`);
        }
      })),
    vscode.commands.registerCommand('vsCanvas.revealCanvas', (item?: { uri?: vscode.Uri }) =>
      item?.uri && vscode.commands.executeCommand('revealInExplorer', item.uri)),
    vscode.commands.registerCommand('vsCanvas.open', async () => {
      try {
        const items = (await docs.list()).map((uri) => ({ label: docs.relPath(uri), uri }));
        const NEW = { label: '$(add) New canvas\u2026', uri: undefined };
        const pick = await vscode.window.showQuickPick([...items, NEW], { placeHolder: 'Open a canvas' });
        if (!pick) return;
        if (pick.uri) await openCanvas(pick.uri);
        else await newCanvas();
      } catch (e) {
        void vscode.window.showErrorMessage(`VS Canvas: ${errMsg(e)}`);
      }
    }),
    vscode.commands.registerCommand('vsCanvas.addCurrentFile', async () => {
      const ed = vscode.window.activeTextEditor;
      if (!ed) return void vscode.window.showWarningMessage('VS Canvas: no active text editor.');
      try {
        const sel = ed.selection;
        const file = workspaceRelPath(ed.document.uri.fsPath);
        const hasSel = !sel.isEmpty;
        const first = sel.start.line + 1;
        // A selection ending at column 0 of a line doesn't include that line.
        const last = sel.end.character === 0 && sel.end.line > sel.start.line ? sel.end.line : sel.end.line + 1;
        const f = await loadFile(ed.document.uri.fsPath, hasSel ? first : undefined, hasSel ? last : undefined);
        const size = codeSize(f.lines.length, f.lines.reduce((m, l) => Math.max(m, l.length), 0));
        const uri = await docs.target();
        const id = await docs.edit(uri, (cf) => {
          const node = addNode(cf, {
            type: 'file', file, display: 'code', width: size.w, height: size.h,
            ...(hasSel && { lines: [f.firstLine, f.lastLine] as [number, number] }),
          });
          if (hasSel && node.type === 'file') {
            addHighlights(cf, node, [{ start: f.firstLine, end: f.lastLine, color: COLOR_PRESETS.yellow }], false);
          }
          return node.id;
        }, { save: true });
        await editor.reveal(uri);
        editor.focus(uri, [id]);
      } catch (e) {
        void vscode.window.showErrorMessage(`VS Canvas: ${errMsg(e)}`);
      }
    }),
    vscode.commands.registerCommand('vsCanvas.setUpClaudeCode', () => setUpClaudeCode(server.url)),
    vscode.commands.registerCommand('vsCanvas.installAgentSkills', () => installAgentSkills()),
    vscode.commands.registerCommand('vsCanvas.copyMcpUrl', async () => {
      const url = server.url;
      if (!url) return void vscode.window.showWarningMessage('VS Canvas: MCP server is not running.');
      await vscode.env.clipboard.writeText(url);
      void vscode.window.showInformationMessage(
        `Copied ${url}. To connect Claude Code, run "VS Canvas: Set Up Claude Code for This Workspace".`,
      );
    }),
  );
}

export function deactivate() {}
