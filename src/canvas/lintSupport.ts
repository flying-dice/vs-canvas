// vscode-side glue for the pure linter in ../shared/lint: options from settings and a workspace-backed fileInfo.
import * as vscode from 'vscode';
import { resolveUri } from '../code/files';
import type { CanvasFile } from '../shared/canvasFile';
import { DEFAULT_SEVERITY, LINT_RULES, type LintDiagnostic, type LintOptions, type LintRuleId, type LintSeverity } from '../shared/lint';

export function lintSettings(): Pick<LintOptions, 'rules'> {
  const raw = vscode.workspace.getConfiguration('vsCanvas').get<Record<string, unknown>>('lint.rules', {});
  const rules: NonNullable<LintOptions['rules']> = {};
  for (const [k, v] of Object.entries(raw ?? {})) {
    if ((LINT_RULES as readonly string[]).includes(k) && (v === 'off' || v === 'error' || v === 'warning' || v === 'info')) {
      rules[k as LintRuleId] = v;
    }
  }
  return { rules };
}

type Cached = { mtime: number; size: number; lines: number };
const cache = new Map<string, Cached>();

/**
 * Snapshot of {exists, totalLines} for every file node of `canvas`, as the synchronous lookup the linter wants.
 * Open (possibly dirty) documents win over disk; disk line counts are cached by mtime+size.
 */
export async function makeFileInfo(canvas: CanvasFile): Promise<NonNullable<LintOptions['fileInfo']>> {
  const paths = new Set<string>();
  for (const n of canvas.nodes) if (n.type === 'file') paths.add(n.file);
  const info = new Map<string, { exists: boolean; totalLines?: number }>();
  await Promise.all(
    [...paths].map(async (p) => {
      let uri: vscode.Uri;
      try {
        uri = resolveUri(p);
      } catch {
        return; // no workspace: unknown
      }
      const open = vscode.workspace.textDocuments.find((d) => d.uri.toString() === uri.toString());
      if (open) return void info.set(p, { exists: true, totalLines: open.lineCount });
      try {
        const st = await vscode.workspace.fs.stat(uri);
        const key = uri.toString();
        let c = cache.get(key);
        if (!c || c.mtime !== st.mtime || c.size !== st.size) {
          const text = Buffer.from(await vscode.workspace.fs.readFile(uri)).toString('utf8');
          c = { mtime: st.mtime, size: st.size, lines: text.split('\n').length };
          cache.set(key, c);
        }
        info.set(p, { exists: true, totalLines: c.lines });
      } catch {
        info.set(p, { exists: false });
      }
    }),
  );
  return (p) => info.get(p);
}

export async function lintOptionsFor(canvas: CanvasFile): Promise<LintOptions> {
  return { ...lintSettings(), fileInfo: await makeFileInfo(canvas) };
}

const ORDER: Record<LintSeverity, number> = { error: 0, warning: 1, info: 2 };

export type CompactDiagnostic = { rule: LintRuleId; severity: LintSeverity; message: string; ids: string[]; hasFix: boolean };

export const compact = (d: LintDiagnostic): CompactDiagnostic => ({
  rule: d.rule, severity: d.severity, message: d.message, ids: [...d.nodeIds, ...d.edgeIds], hasFix: !!d.fix,
});

export const bySeverity = (a: LintDiagnostic, b: LintDiagnostic) => ORDER[a.severity] - ORDER[b.severity];

export { DEFAULT_SEVERITY };
