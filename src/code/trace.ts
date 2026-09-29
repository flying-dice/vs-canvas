// Builds a TracePlan (pure data, see canvas/trace) from the language server's call hierarchy.
import * as vscode from 'vscode';
import { finalizeItem, type TraceItem, type TraceLink, type TracePlan } from '../canvas/trace';
import { loadFile, relPath } from './files';
import { findSymbolPosition, symbolAtLine, WARMUP_NOTE } from './intel';

export type TraceTarget = { symbol?: string; line?: number };
export type TraceOptions = {
  direction: 'incoming' | 'outgoing' | 'both';
  depth: number;
  maxPerLevel: number;
  /** Hard cap on items besides the root. */
  maxTotal?: number;
};

const shortName = (n: string) => n.replace(/\(.*$/, '').split('.').pop() || n;

function useful(uri: vscode.Uri): boolean {
  if (!vscode.workspace.getWorkspaceFolder(uri)) return false;
  return !/[\\/](node_modules|\.git)[\\/]|\.d\.ts$/.test(uri.fsPath);
}

export async function planTrace(path: string, target: TraceTarget, o: TraceOptions): Promise<TracePlan> {
  let doc: vscode.TextDocument;
  let pos: vscode.Position;
  if (target.symbol) ({ doc, pos } = await findSymbolPosition(path, target.symbol));
  else if (target.line !== undefined) ({ doc, pos } = await symbolAtLine(path, target.line));
  else throw new Error('Provide either symbol or line.');
  const rootItem = (await vscode.commands.executeCommand<vscode.CallHierarchyItem[]>('vscode.prepareCallHierarchy', doc.uri, pos))?.[0];
  if (!rootItem) throw new Error(`No call hierarchy item at that position. ${WARMUP_NOTE}`);

  const keyOf = (i: vscode.CallHierarchyItem) => `${relPath(i.uri)}#${i.range.start.line + 1}:${i.name}`;
  const toItem = (i: vscode.CallHierarchyItem): TraceItem => ({
    key: keyOf(i), name: shortName(i.name), file: relPath(i.uri),
    selLine: i.selectionRange.start.line + 1, start: i.range.start.line + 1, end: i.range.end.line + 1, requires: [],
  });
  const root = toItem(rootItem);
  const items = new Map<string, TraceItem>([[root.key, root]]);
  const raw = new Map<string, vscode.CallHierarchyItem>([[root.key, rootItem]]);
  const links: TraceLink[] = [];
  const maxTotal = o.maxTotal ?? 30;
  const linkKeys = new Set<string>();

  const dirs: ('incoming' | 'outgoing')[] = o.direction === 'both' ? ['incoming', 'outgoing'] : [o.direction];
  for (const dir of dirs) {
    let frontier = [rootItem];
    for (let level = 0; level < o.depth && frontier.length; level++) {
      const next: vscode.CallHierarchyItem[] = [];
      for (const parent of frontier) {
        const pk = keyOf(parent);
        let found: { item: vscode.CallHierarchyItem; ranges: vscode.Range[] }[];
        try {
          found = dir === 'incoming'
            ? ((await vscode.commands.executeCommand<vscode.CallHierarchyIncomingCall[]>('vscode.provideIncomingCalls', parent)) ?? [])
                .map((c) => ({ item: c.from, ranges: c.fromRanges }))
            : ((await vscode.commands.executeCommand<vscode.CallHierarchyOutgoingCall[]>('vscode.provideOutgoingCalls', parent)) ?? [])
                .map((c) => ({ item: c.to, ranges: c.fromRanges }));
        } catch {
          continue;
        }
        found = found.filter((f) => useful(f.item.uri));
        const site = (f: { ranges: vscode.Range[] }) => Math.min(...f.ranges.map((r) => r.start.line + 1), Infinity);
        found.sort((a, b) => (dir === 'outgoing' ? site(a) - site(b) : relPath(a.item.uri).localeCompare(relPath(b.item.uri)) || a.item.range.start.line - b.item.range.start.line));
        for (const f of found.slice(0, o.maxPerLevel)) {
          const k = keyOf(f.item);
          if (!items.has(k)) {
            if (items.size - 1 >= maxTotal) continue;
            items.set(k, toItem(f.item));
            raw.set(k, f.item);
            next.push(f.item);
          }
          const sites = [...new Set(f.ranges.map((r) => r.start.line + 1))].sort((a, b) => a - b);
          const link: TraceLink = dir === 'incoming'
            ? { from: k, to: pk, callSites: sites, label: shortName(parent.name) }
            : { from: pk, to: k, callSites: sites, label: shortName(f.item.name) };
          const lk = `${link.from}>${link.to}`;
          if (linkKeys.has(lk)) continue;
          linkKeys.add(lk);
          links.push(link);
          // The window of the calling item must show the call site.
          items.get(link.from)?.requires.push(...sites.slice(0, 1));
        }
      }
      frontier = next;
    }
  }

  // Windows (max 30 lines, containing selLine + call sites), then measure the longest line for node width.
  const all = [...items.values()];
  await Promise.all(
    all.map(async (i) => {
      finalizeItem(i);
      try {
        const f = await loadFile(i.file, i.lines![0], i.lines![1]);
        i.longest = f.lines.reduce((m, l) => Math.max(m, l.length), 0);
      } catch { /* sized with the default width */ }
    }),
  );
  return { root, items: all.filter((i) => i !== root), links };
}
