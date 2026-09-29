// Pure part of "trace": turns a resolved call tree (from the language server) into canvas nodes and edges.
// No vscode import, so it is unit tested with plain node.
import type { CanvasFile, CanvasFileNode, FileNode } from '../shared/canvasFile';
import type { LintOptions } from '../shared/lint';
import { fixOnly, layoutNodes, applyMoves } from './layout';
import { addEdge, addNode, codeSize, isCodeNode, isCanvasPath } from './model';

export const TRACE_MAX_LINES = 30;

export type TraceItem = {
  key: string;
  name: string;
  /** Workspace-relative path. */
  file: string;
  /** 1-based line of the symbol name (edge anchor when this item is the callee). */
  selLine: number;
  /** 1-based full range of the symbol. */
  start: number;
  end: number;
  /** Lines the displayed window must contain (call sites in this item, its own selLine). */
  requires: number[];
  /** Displayed window (set by finalizeItem). */
  lines?: [number, number];
  /** Longest line in the window, for sizing. */
  longest?: number;
};

export type TraceLink = { from: string; to: string; callSites: number[]; label: string };
export type TracePlan = { root: TraceItem; items: TraceItem[]; links: TraceLink[] };

/** Pick a window of at most `cap` lines inside [start, end] that contains as many `required` lines as it can. */
export function chooseWindow(start: number, end: number, required: number[], cap = TRACE_MAX_LINES): [number, number] {
  const req = [...new Set(required)].filter((l) => l >= start && l <= end).sort((a, b) => a - b);
  let s = start;
  let e = Math.min(end, start + cap - 1);
  if (!req.length || (req[0] >= s && req[req.length - 1] <= e)) return [s, e];
  const lo = req[0];
  const hi = req[req.length - 1];
  if (hi - lo + 1 <= cap) {
    s = Math.max(start, lo - Math.floor((cap - (hi - lo + 1)) / 2));
    e = Math.min(end, s + cap - 1);
    if (e < hi) {
      e = hi;
      s = Math.max(start, e - cap + 1);
    }
  } else {
    s = Math.max(start, lo - 4);
    e = Math.min(end, s + cap - 1);
  }
  return [s, e];
}

export function finalizeItem(i: TraceItem): TraceItem {
  i.lines = chooseWindow(i.start, i.end, [i.selLine, ...i.requires]);
  return i;
}

/** An existing code node that shows the item's name line. */
export function findShowing(file: CanvasFile, item: Pick<TraceItem, 'file' | 'selLine'>): FileNode | undefined {
  return file.nodes.find(
    (n): n is FileNode =>
      n.type === 'file' && isCodeNode(n) && !isCanvasPath(n.file) && n.file === item.file &&
      (!n.lines || (n.lines[0] <= item.selLine && item.selLine <= n.lines[1])),
  );
}

const within = (n: CanvasFileNode, line: number) =>
  n.type === 'file' && (!n.lines || (line >= n.lines[0] && line <= n.lines[1]));

export type TraceResult = {
  rootId: string;
  /** Node id per call-tree item key. */
  nodes: Record<string, string>;
  newNodes: string[];
  reused: string[];
  newEdges: string[];
};

/**
 * Add the plan to the canvas: reuse code nodes that already show an item, create the rest, connect callers to
 * callees with line-anchored edges, lay the new nodes out around the root (callers left, callees right) and fix
 * remaining lint issues for the new nodes only. Mutates `file`.
 */
export function applyTrace(file: CanvasFile, plan: TracePlan, opts: { rootNode?: string; lint?: LintOptions } = {}): TraceResult {
  const nodes: Record<string, string> = {};
  const newNodes: string[] = [];
  const reused: string[] = [];
  const ensure = (item: TraceItem, forced?: string): string => {
    if (nodes[item.key]) return nodes[item.key];
    const existing = forced ? file.nodes.find((n) => n.id === forced) : findShowing(file, item);
    if (existing) {
      nodes[item.key] = existing.id;
      reused.push(existing.id);
      return existing.id;
    }
    if (!item.lines) finalizeItem(item);
    const lines = item.lines!;
    const size = codeSize(lines[1] - lines[0] + 1, item.longest ?? 60);
    const n = addNode(file, { type: 'file', file: item.file, display: 'code', lines, width: size.w, height: size.h });
    nodes[item.key] = n.id;
    newNodes.push(n.id);
    return n.id;
  };

  const rootId = ensure(plan.root, opts.rootNode);
  for (const i of plan.items) ensure(i);

  const byId = new Map(file.nodes.map((n) => [n.id, n]));
  const newEdges: string[] = [];
  for (const l of plan.links) {
    const from = nodes[l.from];
    const to = nodes[l.to];
    if (!from || !to || from === to) continue;
    const a = byId.get(from)!;
    const b = byId.get(to)!;
    const toItem = [plan.root, ...plan.items].find((i) => i.key === l.to);
    const fromLine = l.callSites.find((c) => within(a, c));
    const toLine = toItem && within(b, toItem.selLine) ? toItem.selLine : undefined;
    if (file.edges.some((e) => e.fromNode === from && e.toNode === to && e.fromLine === fromLine && e.toLine === toLine)) continue;
    newEdges.push(addEdge(file, { fromNode: from, toNode: to, fromLine, toLine, label: l.label }).id);
  }

  const set = [rootId, ...newNodes.filter((id) => id !== rootId)];
  if (newNodes.length) {
    applyMoves(file, layoutNodes(file, set, { algorithm: 'layered', anchor: rootId }));
    fixOnly(file, newNodes, opts.lint);
  }
  return { rootId, nodes, newNodes, reused, newEdges };
}
