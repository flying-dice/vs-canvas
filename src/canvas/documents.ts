import * as path from 'node:path';
import * as vscode from 'vscode';
import { CANVAS_GLOB, type CanvasFile, type CanvasMeta } from '../shared/canvasFile';
import { parseCanvas, serializeCanvas } from './model';

export const CANVAS_VIEW_TYPE = 'vsCanvas.canvasEditor';
const SUFFIX = '.canvas.json';

export const slugify = (name: string) =>
  name.trim().toLowerCase().replace(/\.canvas\.json$/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/** Reads, edits and creates `*.canvas.json` files through VS Code documents, and tracks the "active" canvas. */
export class CanvasDocuments implements vscode.Disposable {
  private current: vscode.Uri | undefined; // most recently focused / explicitly used canvas
  private mcp: vscode.Uri | undefined; // most recently MCP-used canvas
  private readonly chains = new Map<string, Promise<unknown>>();

  get directory(): string {
    return vscode.workspace.getConfiguration('vsCanvas').get<string>('canvasDirectory', 'canvases');
  }

  private get root(): vscode.Uri {
    const f = vscode.workspace.workspaceFolders?.[0];
    if (!f) throw new Error('No workspace folder is open; canvases are stored in the workspace.');
    return f.uri;
  }

  /** Workspace-relative (forward slashes) path for display, or the absolute path when outside the workspace. */
  relPath(uri: vscode.Uri): string {
    return vscode.workspace.asRelativePath(uri, false);
  }

  /** Resolve a workspace-relative or absolute canvas path argument. */
  resolvePath(arg: string): vscode.Uri {
    if (!arg.toLowerCase().endsWith(SUFFIX)) throw new Error(`Canvas path must end with ${SUFFIX}: "${arg}"`);
    return path.isAbsolute(arg) ? vscode.Uri.file(arg) : vscode.Uri.joinPath(this.root, arg);
  }

  async list(): Promise<vscode.Uri[]> {
    const uris = await vscode.workspace.findFiles(CANVAS_GLOB, '**/node_modules/**');
    return uris.sort((a, b) => this.relPath(a).localeCompare(this.relPath(b)));
  }

  /** Current content, preferring an open (possibly dirty) document over disk. */
  async read(uri: vscode.Uri): Promise<CanvasFile> {
    const open = vscode.workspace.textDocuments.find((d) => d.uri.toString() === uri.toString());
    let text: string;
    if (open) text = open.getText();
    else {
      try {
        text = Buffer.from(await vscode.workspace.fs.readFile(uri)).toString('utf8');
      } catch {
        throw new Error(`Canvas file not found: ${this.relPath(uri)}`);
      }
    }
    return parseCanvas(text, this.relPath(uri));
  }

  /**
   * Apply `mutate` to the parsed canvas and write it back as a full-range WorkspaceEdit, so open editors update and
   * undo/redo work. Edits to the same file are serialized. `mutate` must be synchronous.
   * `save`: true saves after the edit; 'if-clean' saves only if the document was clean before it.
   */
  edit<T>(uri: vscode.Uri, mutate: (file: CanvasFile) => T, opts: { save: boolean | 'if-clean' }): Promise<T> {
    const key = uri.toString();
    const run = (this.chains.get(key) ?? Promise.resolve()).catch(() => undefined).then(() => this.doEdit(uri, mutate, opts));
    this.chains.set(key, run);
    return run;
  }

  private async doEdit<T>(uri: vscode.Uri, mutate: (file: CanvasFile) => T, opts: { save: boolean | 'if-clean' }): Promise<T> {
    let doc: vscode.TextDocument;
    try {
      doc = await vscode.workspace.openTextDocument(uri);
    } catch {
      throw new Error(`Canvas file not found: ${this.relPath(uri)}`);
    }
    const wasDirty = doc.isDirty;
    const before = doc.getText();
    const file = parseCanvas(before, this.relPath(uri));
    const result = mutate(file);
    const after = serializeCanvas(file);
    if (after !== before) {
      const we = new vscode.WorkspaceEdit();
      we.replace(uri, new vscode.Range(doc.positionAt(0), doc.positionAt(before.length)), after);
      if (!(await vscode.workspace.applyEdit(we))) throw new Error(`Could not edit ${this.relPath(uri)}`);
    }
    // 'if-clean': save only when the document had no unsaved changes before this edit.
    if (doc.isDirty && (opts.save === true || (opts.save === 'if-clean' && !wasDirty))) await doc.save();
    return result;
  }

  // ----- active canvas -----

  /** A canvas editor took focus (or was explicitly opened/used). */
  setActive(uri: vscode.Uri, fromMcp = false) {
    this.current = uri;
    if (fromMcp) this.mcp = uri;
  }

  noteClosed(uri: vscode.Uri) {
    if (this.current?.toString() === uri.toString()) this.current = undefined;
  }

  async exists(uri: vscode.Uri) {
    try {
      await vscode.workspace.fs.stat(uri);
      return true;
    } catch {
      return false;
    }
  }

  async activeUri(): Promise<vscode.Uri | undefined> {
    for (const u of [this.current, this.mcp]) if (u && (await this.exists(u))) return u;
    return undefined;
  }

  /** The canvas a tool should act on: the explicit path, else the active canvas, else a scratch canvas. */
  async target(canvas?: string): Promise<vscode.Uri> {
    if (canvas) {
      const uri = this.resolvePath(canvas);
      if (!(await this.exists(uri))) throw new Error(`Canvas not found: ${canvas}. Use canvas_list or canvas_create.`);
      this.setActive(uri, true);
      return uri;
    }
    const active = await this.activeUri();
    if (active) {
      this.mcp = active;
      return active;
    }
    const scratch = await this.writeNew('scratch', 'Scratch', undefined, true);
    this.setActive(scratch, true);
    return scratch;
  }

  private async writeNew(
    slug: string, title: string, description: string | undefined, reuse: boolean, kind?: CanvasMeta['kind'], pinned?: boolean,
  ): Promise<vscode.Uri> {
    const dir = vscode.Uri.joinPath(this.root, this.directory);
    const uri = vscode.Uri.joinPath(dir, `${slug}${SUFFIX}`);
    if (await this.exists(uri)) {
      if (reuse) return uri;
      throw new Error(`Canvas already exists: ${this.relPath(uri)}`);
    }
    await vscode.workspace.fs.createDirectory(dir);
    const file: CanvasFile = { nodes: [], edges: [], vsCanvas: { version: 1, title, ...(description && { description }), ...(kind && { kind }), ...(pinned && { pinned }) } };
    await vscode.workspace.fs.writeFile(uri, Buffer.from(serializeCanvas(file), 'utf8'));
    return uri;
  }

  async create(name: string, title?: string, description?: string, kind?: CanvasMeta['kind'], pinned?: boolean): Promise<vscode.Uri> {
    const slug = slugify(name);
    if (!slug) throw new Error(`Cannot derive a file name from "${name}".`);
    return this.writeNew(slug, title ?? name.trim(), description, false, kind, pinned);
  }

  dispose() {
    this.chains.clear();
  }
}
