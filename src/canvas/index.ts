// Workspace-wide index of canvases (title, kind, pinned, which code ranges they show). Feeds the Canvases tree view
// and the "On canvas" code lens. Refreshed (debounced) when canvas files change.
import * as vscode from 'vscode';
import { CANVAS_GLOB, type CanvasMeta } from '../shared/canvasFile';
import type { CanvasDocuments } from './documents';
import { isCanvasPath } from './model';

export type CodeRef = { file: string; start: number; end: number; nodeId: string };
export type CanvasInfo = {
  uri: vscode.Uri;
  path: string;
  title: string;
  kind?: CanvasMeta['kind'];
  pinned: boolean;
  nodeCount: number;
  refs: CodeRef[];
};

const DEBOUNCE_MS = 400;

export class CanvasIndex implements vscode.Disposable {
  private items: CanvasInfo[] = [];
  private timer: NodeJS.Timeout | undefined;
  private readonly emitter = new vscode.EventEmitter<void>();
  readonly onDidChange = this.emitter.event;
  private readonly disposables: vscode.Disposable[] = [];

  constructor(private readonly docs: CanvasDocuments) {
    const w = vscode.workspace.createFileSystemWatcher(CANVAS_GLOB);
    this.disposables.push(
      w, w.onDidCreate(() => this.schedule()), w.onDidDelete(() => this.schedule()), w.onDidChange(() => this.schedule()),
      vscode.workspace.onDidChangeTextDocument((e) => {
        if (e.contentChanges.length && isCanvasPath(e.document.fileName)) this.schedule();
      }),
      this.emitter,
    );
    this.schedule(0);
  }

  get canvases(): readonly CanvasInfo[] {
    return this.items;
  }

  /** Pinned canvases, maps first. */
  pinned(): CanvasInfo[] {
    return this.items.filter((c) => c.pinned).sort((a, b) => Number(b.kind === 'map') - Number(a.kind === 'map') || a.path.localeCompare(b.path));
  }

  refsIn(file: string): { canvas: CanvasInfo; ref: CodeRef }[] {
    const out: { canvas: CanvasInfo; ref: CodeRef }[] = [];
    for (const c of this.items) for (const ref of c.refs) if (ref.file === file) out.push({ canvas: c, ref });
    return out;
  }

  private schedule(delay = DEBOUNCE_MS) {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.refresh(), delay);
  }

  async refresh(): Promise<void> {
    let uris: vscode.Uri[] = [];
    try {
      uris = await this.docs.list();
    } catch { /* no workspace */ }
    const items: CanvasInfo[] = [];
    await Promise.all(
      uris.map(async (uri) => {
        const path = this.docs.relPath(uri);
        try {
          const c = await this.docs.read(uri);
          const refs: CodeRef[] = [];
          for (const n of c.nodes) {
            if (n.type === 'file' && !isCanvasPath(n.file) && n.display !== 'reference') {
              refs.push({ file: n.file, start: n.lines?.[0] ?? 1, end: n.lines?.[1] ?? Number.MAX_SAFE_INTEGER, nodeId: n.id });
              for (const h of n.highlights ?? []) refs.push({ file: n.file, start: h.start, end: h.end, nodeId: n.id });
            } else if (n.type === 'text' && n.variant === 'service') {
              for (const ep of n.entryPoints ?? []) {
                refs.push({ file: ep.file, start: ep.lines?.[0] ?? 1, end: ep.lines?.[1] ?? ep.lines?.[0] ?? 1, nodeId: n.id });
              }
            }
          }
          items.push({
            uri, path, title: c.vsCanvas?.title || path.split('/').pop()!.replace(/\.canvas\.json$/i, ''),
            kind: c.vsCanvas?.kind, pinned: !!c.vsCanvas?.pinned, nodeCount: c.nodes.length, refs,
          });
        } catch { /* unreadable canvas: skip */ }
      }),
    );
    items.sort((a, b) => a.path.localeCompare(b.path));
    this.items = items;
    this.emitter.fire();
  }

  dispose() {
    clearTimeout(this.timer);
    this.disposables.forEach((d) => d.dispose());
  }
}

