import * as path from 'node:path';
import * as vscode from 'vscode';

const LANG_MAP: Record<string, string> = {
  typescriptreact: 'tsx',
  javascriptreact: 'jsx',
  shellscript: 'bash',
  plaintext: 'text',
};
export const MAX_UNRANGED_LINES = 400;

export function resolveUri(p: string): vscode.Uri {
  if (path.isAbsolute(p)) return vscode.Uri.file(p);
  const root = vscode.workspace.workspaceFolders?.[0];
  if (!root) throw new Error(`Cannot resolve relative path "${p}": no workspace folder is open`);
  return vscode.Uri.joinPath(root.uri, p);
}

export async function openDoc(p: string): Promise<vscode.TextDocument> {
  try {
    return await vscode.workspace.openTextDocument(resolveUri(p));
  } catch (e) {
    throw new Error(`Cannot open "${p}": ${e instanceof Error ? e.message : String(e)}`);
  }
}

export const relPath = (uri: vscode.Uri) => vscode.workspace.asRelativePath(uri, false);
export const shikiLang = (id: string) => LANG_MAP[id] ?? id;

export type LoadedFile = {
  path: string;
  relPath: string;
  language: string;
  firstLine: number;
  lastLine: number;
  lines: string[];
  totalLines: number;
  truncated: boolean;
};

export async function loadFile(p: string, startLine?: number, endLine?: number): Promise<LoadedFile> {
  const doc = await openDoc(p);
  const total = doc.lineCount;
  const ranged = startLine !== undefined || endLine !== undefined;
  const first = Math.min(Math.max(startLine ?? 1, 1), total);
  let last = Math.min(Math.max(endLine ?? total, first), total);
  let truncated = false;
  if (!ranged && last - first + 1 > MAX_UNRANGED_LINES) {
    last = first + MAX_UNRANGED_LINES - 1;
    truncated = true;
  }
  const lines: string[] = [];
  for (let i = first; i <= last; i++) lines.push(doc.lineAt(i - 1).text);
  return {
    path: doc.uri.fsPath,
    relPath: relPath(doc.uri),
    language: shikiLang(doc.languageId),
    firstLine: first,
    lastLine: last,
    lines,
    totalLines: total,
    truncated,
  };
}

/** Workspace-relative path (forward slashes) for a file arg; throws when the file is outside the workspace. */
export function workspaceRelPath(p: string): string {
  const uri = resolveUri(p);
  if (!vscode.workspace.getWorkspaceFolder(uri)) throw new Error(`"${p}" is outside the workspace; canvases can only reference workspace files.`);
  return vscode.workspace.asRelativePath(uri, false);
}
