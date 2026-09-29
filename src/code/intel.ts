import * as vscode from 'vscode';
import { openDoc, relPath } from './files';

export const WARMUP_NOTE =
  'Language servers may need a moment to warm up; if results are empty, retry in a few seconds.';

export type SymbolInfo = { name: string; kind: string; startLine: number; endLine: number };
export type FlatSym = SymbolInfo & { pos: vscode.Position };

const kindName = (k: vscode.SymbolKind) => vscode.SymbolKind[k] ?? String(k);

export async function flatSymbols(p: string): Promise<{ doc: vscode.TextDocument; syms: FlatSym[] }> {
  const doc = await openDoc(p);
  const res =
    (await vscode.commands.executeCommand<(vscode.DocumentSymbol | vscode.SymbolInformation)[]>(
      'vscode.executeDocumentSymbolProvider',
      doc.uri,
    )) ?? [];
  const syms: FlatSym[] = [];
  const walk = (s: vscode.DocumentSymbol, prefix: string) => {
    const name = prefix ? `${prefix}.${s.name}` : s.name;
    syms.push({
      name, kind: kindName(s.kind), startLine: s.range.start.line + 1, endLine: s.range.end.line + 1,
      pos: s.selectionRange.start,
    });
    s.children.forEach((c) => walk(c, name));
  };
  for (const s of res) {
    if ('children' in s) walk(s, '');
    else {
      syms.push({
        name: s.containerName ? `${s.containerName}.${s.name}` : s.name,
        kind: kindName(s.kind),
        startLine: s.location.range.start.line + 1,
        endLine: s.location.range.end.line + 1,
        pos: s.location.range.start,
      });
    }
  }
  return { doc, syms };
}

export async function listSymbols(p: string) {
  const { doc, syms } = await flatSymbols(p);
  return {
    path: relPath(doc.uri),
    symbols: syms.map(({ pos: _pos, ...s }) => s),
    ...(syms.length === 0 && { note: WARMUP_NOTE }),
  };
}

export async function findSymbolPosition(p: string, symbol: string) {
  const { doc, syms } = await flatSymbols(p);
  const hit =
    syms.find((s) => s.name === symbol) ?? syms.find((s) => s.name.split('.').pop() === symbol);
  if (!hit) throw new Error(`Symbol "${symbol}" not found in ${p}. ${WARMUP_NOTE}`);
  return { doc, pos: hit.pos };
}

async function positionFor(
  p: string,
  target: { symbol?: string; line?: number; column?: number },
) {
  if (target.symbol) return findSymbolPosition(p, target.symbol);
  if (target.line === undefined) throw new Error('Provide either symbol or line');
  const doc = await openDoc(p);
  return { doc, pos: new vscode.Position(Math.max(0, target.line - 1), Math.max(0, (target.column ?? 1) - 1)) };
}

const rangeLines = (r: vscode.Range) => ({ startLine: r.start.line + 1, endLine: r.end.line + 1 });

export async function callHierarchy(
  p: string,
  target: { symbol?: string; line?: number; column?: number },
  direction: 'incoming' | 'outgoing',
) {
  const { doc, pos } = await positionFor(p, target);
  const items = await vscode.commands.executeCommand<vscode.CallHierarchyItem[]>(
    'vscode.prepareCallHierarchy', doc.uri, pos,
  );
  const root = items?.[0];
  if (!root) return { calls: [], note: `No call hierarchy item at that position. ${WARMUP_NOTE}` };
  const describe = (i: vscode.CallHierarchyItem, fromRanges: vscode.Range[]) => ({
    name: i.name,
    kind: kindName(i.kind),
    path: relPath(i.uri),
    ...rangeLines(i.range),
    callSiteLines: [...new Set(fromRanges.map((r) => r.start.line + 1))].sort((a, b) => a - b),
  });
  let calls;
  if (direction === 'incoming') {
    const r = (await vscode.commands.executeCommand<vscode.CallHierarchyIncomingCall[]>(
      'vscode.provideIncomingCalls', root)) ?? [];
    calls = r.map((c) => describe(c.from, c.fromRanges));
  } else {
    const r = (await vscode.commands.executeCommand<vscode.CallHierarchyOutgoingCall[]>(
      'vscode.provideOutgoingCalls', root)) ?? [];
    calls = r.map((c) => describe(c.to, c.fromRanges));
  }
  return {
    root: describe(root, []),
    direction,
    calls,
    note:
      direction === 'incoming'
        ? 'callSiteLines are lines inside each caller where the call happens.'
        : 'callSiteLines are lines inside the root symbol where each call happens.',
    ...(calls.length === 0 && { hint: WARMUP_NOTE }),
  };
}

export async function definition(p: string, line: number, column: number) {
  const doc = await openDoc(p);
  const res =
    (await vscode.commands.executeCommand<(vscode.Location | vscode.LocationLink)[]>(
      'vscode.executeDefinitionProvider', doc.uri, new vscode.Position(line - 1, column - 1),
    )) ?? [];
  const definitions = res.map((d) => {
    const uri = 'targetUri' in d ? d.targetUri : d.uri;
    const range = 'targetUri' in d ? d.targetRange : d.range;
    return { path: relPath(uri), ...rangeLines(range) };
  });
  return { definitions, ...(definitions.length === 0 && { note: WARMUP_NOTE }) };
}

/** Position of the innermost callable (else any) symbol whose range contains `line` (1-based). */
export async function symbolAtLine(p: string, line: number): Promise<{ doc: vscode.TextDocument; pos: vscode.Position; name?: string }> {
  const { doc, syms } = await flatSymbols(p);
  const containing = syms.filter((s) => s.startLine <= line && line <= s.endLine);
  const span = (s: SymbolInfo) => s.endLine - s.startLine;
  const callable = containing.filter((s) => /^(Function|Method|Constructor)$/.test(s.kind));
  const pool = (callable.length ? callable : containing).sort((a, b) => span(a) - span(b));
  if (pool[0]) return { doc, pos: pool[0].pos, name: pool[0].name };
  const text = doc.lineAt(Math.min(Math.max(line - 1, 0), doc.lineCount - 1));
  return { doc, pos: new vscode.Position(text.lineNumber, text.firstNonWhitespaceCharacterIndex) };
}
