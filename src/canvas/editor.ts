import * as path from 'node:path';
import * as vscode from 'vscode';
import { loadFile, openDoc, relPath, resolveUri } from '../code/files';
import { planTrace } from '../code/trace';
import type { CanvasFile, FileNode } from '../shared/canvasFile';
import { fixCanvas } from '../shared/lint';
import type { ConnectFrom, FromWebview, PortalPreview, ResolvedCode, ToWebview } from '../shared/protocol';
import { CANVAS_VIEW_TYPE, type CanvasDocuments } from './documents';
import { distWebview, webviewHtml } from './html';
import { fixOnly } from './layout';
import { lintOptionsFor, lintSettings } from './lintSupport';
import {
  addEdge, addNode, codeSize, isCanvasPath, isCodeNode, parseCanvas, removeEdges, removeNodes, requireNode, syncSubpath,
  type NodeSpec,
} from './model';
import { applyTrace } from './trace';

const CODE_DEBOUNCE_MS = 200;
const DOC_DEBOUNCE_MS = 30;

type Session = {
  doc: vscode.TextDocument;
  panel: vscode.WebviewPanel;
  ready: boolean;
  /** A document post is scheduled or in flight. */
  pending: boolean;
  seq: number;
  timer?: NodeJS.Timeout;
  /** fsPaths of files currently referenced as code (for change watching). */
  files: Set<string>;
  queuedFocus: { nodeIds?: string[]; zoom?: boolean }[];
  /** 'select' replies wait for the document post that contains the new nodes. */
  queuedSelect: { nodeIds: string[]; edit?: boolean }[];
  queuedPlay: { flowId: string; fromStep?: number }[];
  /** Canvases this one was opened from via openCanvas (oldest first, at most MAX_TRAIL). */
  trail: Trail;
};

type Trail = { path: string; title: string }[];
const MAX_TRAIL = 5;
const ENTRY_LINES = 12;
const MAX_PORTAL_RECTS = 200;
const canvasTitle = (c: CanvasFile | undefined, rel: string) =>
  c?.vsCanvas?.title || path.basename(rel).replace(/\.canvas\.json$/i, '');

async function resolveCode(node: FileNode): Promise<ResolvedCode> {
  try {
    const f = await loadFile(node.file, node.lines?.[0], node.lines?.[1]);
    return {
      absPath: f.path, language: f.language, firstLine: f.firstLine, lines: f.lines,
      totalLines: f.totalLines, ...(f.truncated && { truncated: true }),
    };
  } catch (e) {
    let absPath = node.file;
    try { absPath = resolveUri(node.file).fsPath; } catch { /* keep the raw path */ }
    return {
      absPath, language: 'text', firstLine: node.lines?.[0] ?? 1, lines: [], totalLines: 0,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

/** Add a node and (optionally) an edge to/from an existing node; edges follow drag direction. Returns the node id. */
function addWithConnection(f: CanvasFile, spec: NodeSpec, from?: ConnectFrom): string {
  if (from) requireNode(f, from.nodeId);
  const hasPos = typeof spec.x === 'number' && typeof spec.y === 'number';
  const node = addNode(f, spec, hasPos ? { x: spec.x, y: spec.y } : undefined);
  if (from) {
    addEdge(
      f,
      from.handleType === 'source'
        ? { fromNode: from.nodeId, fromLine: from.line, fromSide: from.line ? undefined : from.side, toNode: node.id }
        : { fromNode: node.id, toNode: from.nodeId, toLine: from.line, toSide: from.line ? undefined : from.side },
    );
  }
  return node.id;
}

export class CanvasEditorProvider implements vscode.CustomTextEditorProvider, vscode.Disposable {
  private readonly sessions = new Set<Session>();
  private readonly opening = new Map<string, Promise<void>>();
  private readonly disposables: vscode.Disposable[] = [];
  private mcpUrl: string | null = null;
  /** Trail for a canvas about to be opened via openCanvas, consumed by resolveCustomTextEditor. */
  private readonly pendingTrails = new Map<string, Trail>();

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly docs: CanvasDocuments,
    private readonly log: (msg: string) => void,
  ) {
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument((e) => {
        if (!e.contentChanges.length) return;
        const key = e.document.uri.toString();
        for (const s of this.sessions) {
          if (s.doc.uri.toString() === key) this.schedule(s, DOC_DEBOUNCE_MS);
          else if (s.files.has(e.document.uri.fsPath)) this.schedule(s, CODE_DEBOUNCE_MS);
        }
      }),
    );
    const watcher = vscode.workspace.createFileSystemWatcher('**/*');
    const onFile = (uri: vscode.Uri) => {
      for (const s of this.sessions) if (s.files.has(uri.fsPath)) this.schedule(s, CODE_DEBOUNCE_MS);
    };
    this.disposables.push(watcher, watcher.onDidChange(onFile), watcher.onDidCreate(onFile), watcher.onDidDelete(onFile));
  }

  register(): vscode.Disposable {
    return vscode.window.registerCustomEditorProvider(CANVAS_VIEW_TYPE, this, {
      webviewOptions: { retainContextWhenHidden: true },
      supportsMultipleEditorsPerDocument: false,
    });
  }

  setMcpUrl(url: string | null) {
    this.mcpUrl = url;
    for (const s of this.sessions) if (s.ready) this.send(s, { type: 'info', mcpUrl: url });
  }

  resolveCustomTextEditor(doc: vscode.TextDocument, panel: vscode.WebviewPanel): void {
    const key = doc.uri.toString();
    const s: Session = {
      doc, panel, ready: false, pending: false, seq: 0, files: new Set(), queuedFocus: [], queuedSelect: [], queuedPlay: [],
      trail: this.pendingTrails.get(key) ?? [],
    };
    this.pendingTrails.delete(key);
    this.sessions.add(s);
    panel.webview.options = { enableScripts: true, localResourceRoots: [distWebview(this.extensionUri)] };
    panel.webview.onDidReceiveMessage((m: FromWebview) => void this.onMessage(s, m));
    panel.onDidChangeViewState((e) => {
      if (e.webviewPanel.active) this.docs.setActive(doc.uri);
    });
    panel.onDidDispose(() => {
      clearTimeout(s.timer);
      this.sessions.delete(s);
      this.docs.noteClosed(doc.uri);
    });
    if (panel.active) this.docs.setActive(doc.uri);
    panel.webview.html = webviewHtml(panel.webview, this.extensionUri);
  }

  // ----- public API for tools / commands -----

  private sessionsFor(uri: vscode.Uri) {
    const key = uri.toString();
    return [...this.sessions].filter((s) => s.doc.uri.toString() === key);
  }

  async reveal(uri: vscode.Uri): Promise<void> {
    const existing = this.sessionsFor(uri);
    if (existing.length) {
      existing[0].panel.reveal(undefined, true);
      return;
    }
    const key = uri.toString();
    let p = this.opening.get(key);
    if (!p) {
      p = Promise.resolve(
        vscode.commands.executeCommand('vscode.openWith', uri, CANVAS_VIEW_TYPE, {
          // Beside an open editor (e.g. the code being discussed); in an empty window, 'Beside' leaves a
          // stray unresolved tab in the first group, so use the active group instead.
          viewColumn: vscode.window.tabGroups.activeTabGroup.tabs.length ? vscode.ViewColumn.Beside : vscode.ViewColumn.Active,
          preserveFocus: true,
        }),
      ).then(() => undefined).finally(() => this.opening.delete(key));
      this.opening.set(key, p);
    }
    await p;
  }

  /** Reload every canvas webview with fresh HTML (dev mode, after the webview bundle is rebuilt). */
  reloadWebviews() {
    for (const s of this.sessions) {
      s.ready = false;
      s.panel.webview.html = webviewHtml(s.panel.webview, this.extensionUri);
    }
  }

  focus(uri: vscode.Uri, nodeIds?: string[], opts: { zoom?: boolean } = {}) {
    const zoom = opts.zoom && nodeIds?.length ? true : undefined;
    for (const s of this.sessionsFor(uri)) {
      if (s.ready && !s.pending) this.send(s, { type: 'focus', nodeIds, zoom });
      else s.queuedFocus.push({ nodeIds, zoom });
    }
  }

  /** Start a flow in the canvas's webview(s) (queued until the webview has the latest document). */
  playFlow(uri: vscode.Uri, flowId: string, fromStep?: number) {
    for (const s of this.sessionsFor(uri)) {
      if (s.ready && !s.pending) this.send(s, { type: 'playFlow', flowId, ...(fromStep !== undefined && { fromStep }) });
      else s.queuedPlay.push({ flowId, ...(fromStep !== undefined && { fromStep }) });
    }
  }

  // ----- webview plumbing -----

  private send(s: Session, msg: ToWebview) {
    void s.panel.webview.postMessage(msg);
  }

  private schedule(s: Session, delay: number) {
    if (!s.ready) return;
    s.pending = true;
    clearTimeout(s.timer);
    s.timer = setTimeout(() => void this.postDocument(s), delay);
  }

  private async postDocument(s: Session) {
    const seq = ++s.seq;
    let canvas: CanvasFile;
    try {
      canvas = parseCanvas(s.doc.getText(), s.doc.fileName);
    } catch {
      s.pending = false; // invalid JSON mid-edit: keep showing the last good document
      return;
    }
    const code: Record<string, ResolvedCode> = {};
    const entryCode: Record<string, ResolvedCode> = {};
    const portals: Record<string, PortalPreview> = {};
    const files = new Set<string>();
    await Promise.all(
      canvas.nodes.map(async (n) => {
        if (n.type === 'file' && isCanvasPath(n.file)) {
          portals[n.id] = await this.portalPreview(n.file, files);
        } else if (n.type === 'file' && n.display !== 'reference') {
          const r = await resolveCode(n);
          code[n.id] = r;
          files.add(r.absPath);
        } else if (n.type === 'text' && n.variant === 'service' && n.entryPoints?.length) {
          await Promise.all(
            n.entryPoints.map(async (ep, i) => {
              const first = ep.lines?.[0] ?? 1;
              const last = ep.lines ? Math.min(ep.lines[1], first + ENTRY_LINES - 1) : first + ENTRY_LINES - 1;
              const r = await resolveCode({ id: n.id, type: 'file', x: 0, y: 0, width: 0, height: 0, file: ep.file, lines: [first, last] });
              entryCode[`${n.id}#${i}`] = r;
              files.add(r.absPath);
            }),
          );
        }
      }),
    );
    if (seq !== s.seq) return; // superseded by a newer post
    s.files = files;
    s.pending = false;
    this.send(s, {
      type: 'document', canvas, code, canvasPath: this.docs.relPath(s.doc.uri),
      ...(Object.keys(entryCode).length && { entryCode }),
      ...(Object.keys(portals).length && { portals }),
      ...(s.trail.length && { breadcrumbs: s.trail }),
    });
    for (const f of s.queuedFocus.splice(0)) this.send(s, { type: 'focus', nodeIds: f.nodeIds, zoom: f.zoom });
    for (const p of s.queuedPlay.splice(0)) this.send(s, { type: 'playFlow', ...p });
    for (const q of s.queuedSelect.splice(0)) this.send(s, { type: 'select', nodeIds: q.nodeIds, ...(q.edit && { edit: true }) });
  }

  private async portalPreview(file: string, watch: Set<string>): Promise<PortalPreview> {
    let uri: vscode.Uri;
    try {
      uri = resolveUri(file);
    } catch (e) {
      return { title: path.basename(file), nodeCount: 0, rects: [], error: e instanceof Error ? e.message : String(e) };
    }
    watch.add(uri.fsPath);
    try {
      const c = await this.docs.read(uri);
      return {
        title: canvasTitle(c, file),
        ...(c.vsCanvas?.description && { description: c.vsCanvas.description }),
        ...(c.vsCanvas?.kind && { kind: c.vsCanvas.kind }),
        nodeCount: c.nodes.length,
        rects: c.nodes.slice(0, MAX_PORTAL_RECTS).map((n) => ({
          x: n.x, y: n.y, width: n.width, height: n.height, ...(n.color && { color: n.color }), type: n.type,
        })),
      };
    } catch (e) {
      return { title: path.basename(file).replace(/\.canvas\.json$/i, ''), nodeCount: 0, rects: [], error: e instanceof Error ? e.message : String(e) };
    }
  }

  private edit(s: Session, mutate: (f: CanvasFile) => unknown) {
    this.docs.edit(s.doc.uri, mutate, { save: false }).catch((e) => {
      this.log(`Edit failed: ${e instanceof Error ? e.message : e}`);
      void vscode.window.showWarningMessage(`VS Canvas: ${e instanceof Error ? e.message : e}`);
    });
  }

  /**
   * 'user' (drag/resize) is a normal edit that leaves the document dirty. 'measure' reports the rendered size of
   * auto-sized nodes: apply it, and save silently when the document was clean so that direct on-disk edits
   * (agents editing the file) do not collide with a dirty buffer.
   */
  private nodesChanged(s: Session, m: Extract<FromWebview, { type: 'nodesChanged' }>) {
    this.docs
      .edit(s.doc.uri, (f) => {
        for (const c of m.changes) {
          const n = f.nodes.find((x) => x.id === c.id);
          if (!n) continue;
          n.x = c.x;
          n.y = c.y;
          if (c.width !== undefined) n.width = c.width;
          if (c.height !== undefined) n.height = c.height;
        }
      }, { save: m.reason === 'measure' ? 'if-clean' : false })
      .catch((e) => {
        this.log(`Edit failed: ${e instanceof Error ? e.message : e}`);
        void vscode.window.showWarningMessage(`VS Canvas: ${e instanceof Error ? e.message : e}`);
      });
  }

  private async onMessage(s: Session, m: FromWebview) {
    switch (m.type) {
      case 'ready':
        s.ready = true;
        this.send(s, { type: 'info', mcpUrl: this.mcpUrl });
        s.pending = true;
        await this.postDocument(s);
        break;
      case 'nodesChanged':
        this.nodesChanged(s, m);
        break;
      case 'addNode':
        this.edit(s, (f) => addNode(f, m.node as NodeSpec));
        break;
      case 'updateNode':
        this.edit(s, (f) => {
          const n = f.nodes.find((x) => x.id === m.id);
          if (!n) return;
          for (const [k, v] of Object.entries(m.patch)) {
            if (k === 'id' || k === 'type') continue;
            if (v === undefined || v === null) delete (n as Record<string, unknown>)[k];
            else (n as Record<string, unknown>)[k] = v;
          }
          syncSubpath(n);
        });
        break;
      case 'removeNodes':
        this.edit(s, (f) => removeNodes(f, m.ids));
        break;
      case 'removeEdges':
        this.edit(s, (f) => removeEdges(f, m.ids));
        break;
      case 'connect':
        this.edit(s, (f) => addEdge(f, m.edge));
        break;
      case 'openFile':
        await this.openFile(m.path, m.line);
        break;
      case 'openUrl':
        if (/^https?:\/\//i.test(m.url)) void vscode.env.openExternal(vscode.Uri.parse(m.url));
        break;
      case 'updateEdge':
        this.edit(s, (f) => {
          const e = f.edges.find((x) => x.id === m.id);
          if (!e) return;
          for (const [k, v] of Object.entries(m.patch)) {
            if (k === 'id' || k === 'fromNode' || k === 'toNode') continue;
            if (v === undefined || v === null || v === '') delete (e as unknown as Record<string, unknown>)[k];
            else (e as unknown as Record<string, unknown>)[k] = v;
          }
        });
        break;
      case 'addConnected':
        await this.guarded(async () => {
          const id = await this.docs.edit(s.doc.uri, (f) => addWithConnection(f, m.node as NodeSpec, m.from), { save: false });
          this.queueSelect(s, [id], m.node.type === 'text');
        });
        break;
      case 'pickFile':
        await this.guarded(() => this.pickFile(s, m));
        break;
      case 'openCanvas':
        await this.guarded(() => this.openCanvas(s, m.path, m.focusNodeIds));
        break;
      case 'trace':
        await this.guarded(() => this.trace(s, m));
        break;
      case 'expandRange':
        await this.guarded(() => this.expandRange(s, m));
        break;
      case 'fixLayout':
        await this.guarded(async () => {
          const opts = await lintOptionsFor(parseCanvas(s.doc.getText(), s.doc.fileName));
          await this.docs.edit(s.doc.uri, (f) => {
            if (m.nodeIds?.length) fixOnly(f, m.nodeIds, opts);
            else {
              const r = fixCanvas(f, opts);
              f.nodes = r.canvas.nodes;
              f.edges = r.canvas.edges;
            }
          }, { save: false });
        });
        break;
      case 'setPinned':
        this.edit(s, (f) => {
          const meta = { ...f.vsCanvas, version: 1 as const };
          if (m.pinned) meta.pinned = true;
          else delete meta.pinned;
          f.vsCanvas = meta;
        });
        break;
    }
  }

  private async guarded(fn: () => Promise<unknown>) {
    try {
      await fn();
    } catch (e) {
      this.log(`Action failed: ${e instanceof Error ? e.message : e}`);
      void vscode.window.showWarningMessage(`VS Canvas: ${e instanceof Error ? e.message : e}`);
    }
  }

  /** Reply with 'select' once the document containing `nodeIds` has been posted. */
  private queueSelect(s: Session, nodeIds: string[], edit?: boolean) {
    if (!nodeIds.length) return;
    s.queuedSelect.push({ nodeIds, ...(edit && { edit }) });
    this.schedule(s, 0);
  }

  private async pickFile(s: Session, m: Extract<FromWebview, { type: 'pickFile' }>) {
    const uris = await vscode.workspace.findFiles('**/*', '{**/node_modules/**,**/dist/**,**/.git/**,**/out/**,**/build/**}', 5000);
    const items = uris
      .map((u) => ({ rel: relPath(u) }))
      .sort((a, b) => a.rel.localeCompare(b.rel))
      .map(({ rel }) => ({ label: path.basename(rel), description: path.dirname(rel) === '.' ? '' : path.dirname(rel), rel }));
    const pick = await vscode.window.showQuickPick(items, {
      placeHolder: 'Add a file to the canvas (type to fuzzy search)', matchOnDescription: true,
    });
    if (!pick) return;
    let spec: NodeSpec;
    if (isCanvasPath(pick.rel)) spec = { type: 'file', file: pick.rel };
    else {
      let lines: [number, number] | undefined;
      let size = codeSize(20);
      try {
        const f = await loadFile(pick.rel);
        if (f.totalLines > 60) lines = [1, 40];
        const shown = lines ? f.lines.slice(0, 40) : f.lines;
        size = codeSize(shown.length, shown.reduce((mx, l) => Math.max(mx, l.length), 0));
      } catch { /* binary / unreadable: add anyway, the node shows the error */ }
      spec = { type: 'file', file: pick.rel, display: 'code', ...(lines && { lines }), width: size.w, height: size.h };
    }
    spec = { ...spec, x: m.at.x, y: m.at.y } as NodeSpec;
    const id = await this.docs.edit(s.doc.uri, (f) => addWithConnection(f, spec, m.from), { save: false });
    this.queueSelect(s, [id]);
  }

  private async openCanvas(s: Session, target: string, focusNodeIds?: string[]) {
    const uri = this.docs.resolvePath(target);
    try {
      await vscode.workspace.fs.stat(uri);
    } catch {
      throw new Error(`Canvas not found: ${target}`);
    }
    if (uri.toString() === s.doc.uri.toString()) return void this.focus(uri, focusNodeIds);
    const here = this.docs.relPath(s.doc.uri);
    let title = path.basename(here);
    try { title = canvasTitle(parseCanvas(s.doc.getText()), here); } catch { /* keep the file name */ }
    const back = s.trail.findIndex((t) => t.path === this.docs.relPath(uri));
    const trail = (back >= 0 ? s.trail.slice(0, back) : [...s.trail, { path: here, title }]).slice(-MAX_TRAIL);

    const existing = this.sessionsFor(uri)[0];
    if (existing) {
      existing.trail = trail;
      existing.panel.reveal(existing.panel.viewColumn, false);
      this.schedule(existing, 0);
    } else {
      this.pendingTrails.set(uri.toString(), trail);
      await vscode.commands.executeCommand('vscode.openWith', uri, CANVAS_VIEW_TYPE, s.panel.viewColumn ?? vscode.ViewColumn.Active);
      this.pendingTrails.delete(uri.toString());
    }
    // Replace: close the tab we navigated away from (breadcrumbs lead back); keep it when it has unsaved changes.
    if (!s.doc.isDirty) {
      for (const g of vscode.window.tabGroups.all) {
        for (const tab of g.tabs) {
          if (tab.input instanceof vscode.TabInputCustom && tab.input.viewType === CANVAS_VIEW_TYPE && tab.input.uri.toString() === s.doc.uri.toString()) {
            await vscode.window.tabGroups.close(tab);
          }
        }
      }
    }
    this.docs.setActive(uri, true);
    this.focus(uri, focusNodeIds);
  }

  private async trace(s: Session, m: Extract<FromWebview, { type: 'trace' }>) {
    const canvas = parseCanvas(s.doc.getText(), s.doc.fileName);
    const node = requireNode(canvas, m.nodeId);
    if (node.type !== 'file' || !isCodeNode(node)) throw new Error('Trace works on code nodes.');
    const plan = await planTrace(node.file, { line: m.line }, { direction: m.direction, depth: 1, maxPerLevel: 6, maxTotal: 6 });
    if (!plan.items.length) {
      void vscode.window.showInformationMessage(
        `VS Canvas: no ${m.direction === 'incoming' ? 'callers' : 'callees'} found (the language server may still be warming up).`,
      );
      return;
    }
    const lint = lintSettings();
    const res = await this.docs.edit(s.doc.uri, (f) => applyTrace(f, plan, { rootNode: m.nodeId, lint }), { save: false });
    this.queueSelect(s, res.newNodes);
  }

  private async expandRange(s: Session, m: Extract<FromWebview, { type: 'expandRange' }>) {
    const canvas = parseCanvas(s.doc.getText(), s.doc.fileName);
    const node = requireNode(canvas, m.nodeId);
    if (node.type !== 'file' || !isCodeNode(node)) return;
    const total = (await openDoc(node.file)).lineCount;
    await this.docs.edit(s.doc.uri, (f) => {
      const n = requireNode(f, m.nodeId);
      if (n.type !== 'file') return;
      const [s0, e0] = n.lines ?? [1, total];
      let start = Math.max(1, Math.min(total, s0 - m.before));
      let end = Math.max(1, Math.min(total, e0 + m.after));
      if (end < start) [start, end] = [Math.min(s0, e0), Math.max(s0, e0)];
      if (start === s0 && end === e0 && n.lines) return;
      n.lines = [start, end];
      n.height = Math.max(60, n.height + (end - start - (e0 - s0)) * 18);
      syncSubpath(n);
      // Keep highlights valid: clamp to the new range, drop the ones that fell out.
      if (n.highlights) {
        n.highlights = n.highlights
          .filter((h) => h.end >= start && h.start <= end)
          .map((h) => ({ ...h, start: Math.max(h.start, start), end: Math.min(h.end, end) }));
        if (!n.highlights.length) delete n.highlights;
      }
      // Edge anchors on lines that are no longer shown fall back to the node's side.
      for (const e of f.edges) {
        if (e.fromNode === n.id && e.fromLine && (e.fromLine < start || e.fromLine > end)) delete e.fromLine;
        if (e.toNode === n.id && e.toLine && (e.toLine < start || e.toLine > end)) delete e.toLine;
      }
    }, { save: false });
  }

  private async openFile(p: string, line?: number) {
    try {
      const doc = await vscode.workspace.openTextDocument(resolveUri(p));
      const editor = await vscode.window.showTextDocument(doc, vscode.ViewColumn.One);
      if (line === undefined) return;
      const l = Math.min(Math.max(line - 1, 0), doc.lineCount - 1);
      const range = doc.lineAt(l).range;
      editor.selection = new vscode.Selection(range.start, range.end);
      editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
    } catch (e) {
      void vscode.window.showErrorMessage(`VS Canvas: cannot open ${p}: ${e instanceof Error ? e.message : e}`);
    }
  }

  dispose() {
    for (const s of this.sessions) clearTimeout(s.timer);
    this.disposables.forEach((d) => d.dispose());
  }
}
