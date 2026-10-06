import * as vscode from 'vscode';
import type { CanvasFile } from '../shared/canvasFile';
import { applyLintFix, fixCanvas, lintCanvas, type LintDiagnostic, type LintFix, type LintSeverity } from '../shared/lint';
import { lintOptionsFor, lintSettings } from './lintSupport';
import { parseCanvas, serializeCanvas } from './model';

const SOURCE = 'canvas-lint';
const DEBOUNCE_MS = 300;
const isCanvas = (d: vscode.TextDocument) => d.uri.path.toLowerCase().endsWith('.canvas.json');

const SEVERITY: Record<LintSeverity, vscode.DiagnosticSeverity> = {
  error: vscode.DiagnosticSeverity.Error,
  warning: vscode.DiagnosticSeverity.Warning,
  info: vscode.DiagnosticSeverity.Information,
};

/** Line of `"id": "<id>"` in the JSON text (0 when not found). */
export function lineOfId(text: string, id: string | undefined): number {
  if (!id) return 0;
  const m = new RegExp(`"id"\\s*:\\s*${JSON.stringify(id).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).exec(text);
  if (!m) return 0;
  let line = 0;
  for (let i = 0; i < m.index; i++) if (text.charCodeAt(i) === 10) line++;
  return line;
}

/** Line of the `"flows"` key in the JSON text (0 when not found). */
function lineOfFlowsKey(text: string): number {
  const m = /"flows"\s*:/.exec(text);
  if (!m) return 0;
  let line = 0;
  for (let i = 0; i < m.index; i++) if (text.charCodeAt(i) === 10) line++;
  return line;
}

/** Problems-panel diagnostics for open canvas documents, with quick fixes. */
export class CanvasLintProvider implements vscode.CodeActionProvider, vscode.Disposable {
  private readonly collection = vscode.languages.createDiagnosticCollection(SOURCE);
  private readonly timers = new Map<string, NodeJS.Timeout>();
  /** Diagnostics by document and message (messages embed the node ids), for quick fixes. */
  private readonly found = new Map<string, Map<string, LintDiagnostic>>();
  private readonly disposables: vscode.Disposable[] = [this.collection];

  constructor() {
    this.disposables.push(
      vscode.workspace.onDidOpenTextDocument((d) => this.schedule(d)),
      vscode.workspace.onDidChangeTextDocument((e) => this.schedule(e.document)),
      vscode.workspace.onDidCloseTextDocument((d) => {
        const key = d.uri.toString();
        clearTimeout(this.timers.get(key));
        this.timers.delete(key);
        this.found.delete(key);
        this.collection.delete(d.uri);
      }),
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('vsCanvas.lint')) vscode.workspace.textDocuments.forEach((d) => this.schedule(d));
      }),
      vscode.languages.registerCodeActionsProvider(
        { pattern: '**/*.canvas.json' }, this, { providedCodeActionKinds: [vscode.CodeActionKind.QuickFix] },
      ),
    );
    vscode.workspace.textDocuments.forEach((d) => this.schedule(d));
  }

  private schedule(doc: vscode.TextDocument) {
    if (!isCanvas(doc)) return;
    const key = doc.uri.toString();
    clearTimeout(this.timers.get(key));
    this.timers.set(key, setTimeout(() => void this.update(doc), DEBOUNCE_MS));
  }

  private async analyse(doc: vscode.TextDocument): Promise<LintDiagnostic[] | undefined> {
    let canvas: CanvasFile;
    try {
      canvas = parseCanvas(doc.getText(), doc.fileName);
    } catch {
      return undefined; // invalid JSON: VS Code's JSON support reports it
    }
    return lintCanvas(canvas, await lintOptionsFor(canvas));
  }

  private async update(doc: vscode.TextDocument) {
    if (doc.isClosed) return;
    const diags = await this.analyse(doc);
    if (!diags) return void this.collection.delete(doc.uri);
    const text = doc.getText();
    const byMessage = new Map<string, LintDiagnostic>();
    const out = diags.map((d) => {
      byMessage.set(d.message, d);
      const at = d.rule === 'legacy-flows' ? lineOfFlowsKey(text) : lineOfId(text, d.nodeIds[0] ?? d.edgeIds[0]);
      const line = Math.min(at, Math.max(0, doc.lineCount - 1));
      const diag = new vscode.Diagnostic(doc.lineAt(line).range, d.message, SEVERITY[d.severity]);
      diag.source = SOURCE;
      diag.code = d.rule;
      return diag;
    });
    this.found.set(doc.uri.toString(), byMessage);
    this.collection.set(doc.uri, out);
  }

  private editFor(doc: vscode.TextDocument, make: (c: CanvasFile) => CanvasFile): vscode.WorkspaceEdit | undefined {
    let canvas: CanvasFile;
    try {
      canvas = parseCanvas(doc.getText(), doc.fileName);
    } catch {
      return undefined;
    }
    const before = doc.getText();
    const after = serializeCanvas(make(canvas));
    if (after === before) return undefined;
    const we = new vscode.WorkspaceEdit();
    we.replace(doc.uri, new vscode.Range(doc.positionAt(0), doc.positionAt(before.length)), after);
    return we;
  }

  provideCodeActions(doc: vscode.TextDocument, _range: vscode.Range, ctx: vscode.CodeActionContext): vscode.CodeAction[] {
    const mine = ctx.diagnostics.filter((d) => d.source === SOURCE);
    if (!mine.length) return [];
    const found = this.found.get(doc.uri.toString());
    const actions: vscode.CodeAction[] = [];
    const seen = new Set<string>();
    for (const d of mine) {
      const lint = found?.get(d.message);
      const fix: LintFix | undefined = lint?.fix;
      if (!fix || seen.has(fix.description)) continue;
      seen.add(fix.description);
      const edit = this.editFor(doc, (c) => applyLintFix(c, fix));
      if (!edit) continue;
      const a = new vscode.CodeAction(`Canvas lint: ${fix.description}`, vscode.CodeActionKind.QuickFix);
      a.diagnostics = [d];
      a.edit = edit;
      actions.push(a);
    }
    const all = this.editFor(doc, (c) => fixCanvas(c, lintSettings()).canvas);
    if (all) {
      const a = new vscode.CodeAction('Canvas lint: Fix all layout issues', vscode.CodeActionKind.QuickFix);
      a.diagnostics = mine;
      a.edit = all;
      actions.push(a);
    }
    return actions;
  }

  dispose() {
    this.timers.forEach(clearTimeout);
    this.disposables.forEach((d) => d.dispose());
  }
}
