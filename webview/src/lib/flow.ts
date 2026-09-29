import type { CanvasFileNode, PortalPreview, ResolvedCode } from '../../../src/shared/protocol';

/** `data` of every flow node: the document node plus what the extension resolved for it. */
export type FlowData = {
  node: CanvasFileNode;
  /** Resolved source for file nodes displayed as code. */
  code?: ResolvedCode;
  /** Anchored line numbers (from edges' fromLine/toLine) that need line handles. */
  anchors?: { in: number[]; out: number[] };
  /** Service nodes: resolved entry-point snippets by entry index (from ToWebview.entryCode `${nodeId}#${index}`). */
  entryCode?: Record<number, ResolvedCode>;
  /** Portal nodes: thumbnail data (from ToWebview.portals[nodeId]). */
  portal?: PortalPreview;
} & Record<string, unknown>;

export type FlowKind = 'code' | 'fileRef' | 'note' | 'sticky' | 'text' | 'mermaid' | 'link' | 'group' | 'finding' | 'log' | 'service' | 'portal' | 'shape';

export function kindOf(n: CanvasFileNode): FlowKind {
  switch (n.type) {
    case 'file':
      if (n.file.endsWith('.canvas.json')) return 'portal';
      return n.display === 'reference' ? 'fileRef' : 'code';
    case 'link':
      return 'link';
    case 'group':
      return 'group';
    case 'text':
      switch (n.variant) {
        case 'sticky': return 'sticky';
        case 'plain': return 'text';
        case 'mermaid': return 'mermaid';
        case 'finding': return 'finding';
        case 'log': return 'log';
        case 'service': return 'service';
        case 'shape': return 'shape';
        default: return 'note';
      }
  }
}

/** Kinds whose size comes from the document; the others size themselves and report it back. */
export const RESIZABLE: ReadonlySet<FlowKind> = new Set(['note', 'sticky', 'mermaid', 'group', 'text', 'link', 'finding', 'log', 'service', 'portal', 'shape']);
