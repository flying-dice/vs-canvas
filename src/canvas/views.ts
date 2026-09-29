// VS Code surfaces: Canvases tree view (Explorer) and the "On canvas" code lens.
import * as vscode from 'vscode';
import { relPath } from '../code/files';
import type { CanvasInfo, CanvasIndex } from './index';

const KIND_ICON: Record<string, string> = { map: 'map', investigation: 'bug', flow: 'pulse', notes: 'note' };

type Node = { section: 'Pinned' | 'All'; items: CanvasInfo[] } | CanvasInfo;
const isSection = (n: Node): n is Extract<Node, { section: string }> => 'section' in n;

export class CanvasesTree implements vscode.TreeDataProvider<Node> {
  private readonly emitter = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this.emitter.event;
  constructor(private readonly index: CanvasIndex) {
    index.onDidChange(() => this.emitter.fire());
  }

  getChildren(el?: Node): Node[] {
    if (!el) {
      const pinned = this.index.pinned();
      const sections: Node[] = [];
      if (pinned.length) sections.push({ section: 'Pinned', items: pinned });
      sections.push({ section: 'All', items: [...this.index.canvases] });
      return sections;
    }
    return isSection(el) ? el.items : [];
  }

  getTreeItem(el: Node): vscode.TreeItem {
    if (isSection(el)) {
      const t = new vscode.TreeItem(el.section, vscode.TreeItemCollapsibleState.Expanded);
      t.description = String(el.items.length);
      t.contextValue = 'section';
      return t;
    }
    const t = new vscode.TreeItem(el.title, vscode.TreeItemCollapsibleState.None);
    t.description = `${el.nodeCount}`;
    t.tooltip = `${el.path}${el.kind ? ` (${el.kind})` : ''}: ${el.nodeCount} nodes`;
    t.iconPath = new vscode.ThemeIcon(KIND_ICON[el.kind ?? ''] ?? 'symbol-misc');
    t.resourceUri = el.uri;
    t.contextValue = el.pinned ? 'canvas.pinned' : 'canvas';
    t.command = { command: 'vsCanvas.openCanvasFile', title: 'Open canvas', arguments: [el.uri] };
    return t;
  }
}

/** "On canvas: <title>" above code that some canvas shows. */
export class CanvasCodeLens implements vscode.CodeLensProvider {
  private readonly emitter = new vscode.EventEmitter<void>();
  readonly onDidChangeCodeLenses = this.emitter.event;
  constructor(private readonly index: CanvasIndex) {
    index.onDidChange(() => this.emitter.fire());
  }

  provideCodeLenses(doc: vscode.TextDocument): vscode.CodeLens[] {
    if (!vscode.workspace.getConfiguration('vsCanvas').get<boolean>('codeLens.enabled', true)) return [];
    if (doc.uri.scheme !== 'file') return [];
    const file = relPath(doc.uri);
    const byStart = new Map<number, Map<string, { canvas: CanvasInfo; nodeId: string }>>();
    for (const { canvas, ref } of this.index.refsIn(file)) {
      if (ref.start > doc.lineCount) continue;
      const m = byStart.get(ref.start) ?? new Map();
      if (!m.has(canvas.path)) m.set(canvas.path, { canvas, nodeId: ref.nodeId });
      byStart.set(ref.start, m);
    }
    const lenses: vscode.CodeLens[] = [];
    for (const [start, m] of [...byStart].sort((a, b) => a[0] - b[0])) {
      const range = new vscode.Range(start - 1, 0, start - 1, 0);
      for (const { canvas, nodeId } of [...m.values()].slice(0, 3)) {
        lenses.push(new vscode.CodeLens(range, {
          title: `On canvas: ${canvas.title}`, command: 'vsCanvas.openCanvasNode', arguments: [canvas.uri, nodeId],
        }));
      }
    }
    return lenses;
  }
}
