<script lang="ts">
  import { NodeToolbar, Position, type Node } from '@xyflow/svelte';
  import type { CanvasFileNode, FileNode, TextNode } from '../../../src/shared/protocol';
  import type { FlowData } from '../lib/flow';
  import NodeToolbarBar, { type NodeToolbarAction } from '../ui/molecules/NodeToolbar.svelte';
  import ToolbarButton from '../ui/molecules/ToolbarButton.svelte';
  import type { IconName } from '../ui/atoms/Icon.svelte';

  // Floating chrome for the selection: a contextual toolbar above a single node, a compact align / distribute /
  // group toolbar above a multi-selection. Presentational: Canvas.svelte performs the actions.
  let {
    selected,
    busy = false,
    onaction,
    oncolor,
    onmulti,
  }: {
    /** Selected nodes (not exiting). */
    selected: Node[];
    /** Hide while dragging. */
    busy?: boolean;
    onaction?: (nodeId: string, action: string) => void;
    oncolor?: (ids: string[], color: string | undefined) => void;
    onmulti?: (action: string) => void;
  } = $props();

  const single = $derived(selected.length === 1 ? selected[0] : undefined);
  const multi = $derived(selected.length > 1);
  const ids = $derived(selected.map((n) => n.id));

  const STATUSES: { id: string; label: string; icon: IconName }[] = [
    { id: 'open', label: 'Open', icon: 'statusOpen' },
    { id: 'investigating', label: 'Investigating', icon: 'statusInvestigating' },
    { id: 'confirmed', label: 'Confirmed', icon: 'statusConfirmed' },
    { id: 'ruled-out', label: 'Ruled out', icon: 'statusRuledOut' },
  ];

  function actionsFor(n: Node): NodeToolbarAction[] {
    const doc = (n.data as FlowData).node as CanvasFileNode;
    const common: NodeToolbarAction[] = [
      { id: 'duplicate', label: 'Duplicate', icon: 'duplicate', shortcut: '⌘D' },
      { id: 'del', label: 'Delete', icon: 'trash', shortcut: '⌫', danger: true },
    ];
    switch (n.type) {
      case 'code':
        return [
          { id: 'open', label: 'Open in editor', icon: 'external' },
          { id: 'callers', label: 'Trace callers', icon: 'callers' },
          { id: 'callees', label: 'Trace callees', icon: 'callees' },
          { id: 'more', label: 'Show more lines', icon: 'moreLines' },
          { id: 'layout', label: 'Fix layout', icon: 'layout' },
          ...common,
        ];
      case 'fileRef':
        return [{ id: 'open', label: 'Open in editor', icon: 'external' }, ...common];
      case 'finding': {
        const status = (doc as TextNode).status ?? 'open';
        return [...STATUSES.map((s) => ({ id: `status:${s.id}`, label: s.label, icon: s.icon, active: s.id === status })), ...common];
      }
      case 'service':
        return [...((doc as TextNode).canvas ? [{ id: 'canvas', label: 'Open canvas', icon: 'portal' as IconName }] : []), ...common];
      case 'portal':
        return [{ id: 'canvas', label: 'Open canvas', icon: 'portal' }, ...common];
      case 'link':
        return [{ id: 'open', label: 'Open link', icon: 'external' }, ...common];
      default:
        return common;
    }
  }
</script>

{#if single && !busy}
  <NodeToolbar nodeId={single.id} position={Position.Top} offset={12} isVisible>
    <NodeToolbarBar
      color={(single.data as FlowData).node.color}
      actions={actionsFor(single)}
      oncolor={(c) => oncolor?.([single.id], c)}
      onaction={(a) => onaction?.(single.id, a)}
    />
  </NodeToolbar>
{:else if multi && !busy}
  <NodeToolbar nodeId={ids} position={Position.Top} offset={12} isVisible>
    <div class="bar nodrag nopan" role="toolbar" aria-label={`${selected.length} nodes selected`}>
      <span class="count">{selected.length} selected</span>
      <span class="sep"></span>
      <ToolbarButton icon="alignLeft" label="Align left" onclick={() => onmulti?.('align:left')} />
      <ToolbarButton icon="alignCenterH" label="Align horizontal centres" onclick={() => onmulti?.('align:centerH')} />
      <ToolbarButton icon="alignTop" label="Align top" onclick={() => onmulti?.('align:top')} />
      <ToolbarButton icon="alignCenterV" label="Align vertical centres" onclick={() => onmulti?.('align:centerV')} />
      <ToolbarButton icon="distributeH" label="Distribute horizontally" disabled={selected.length < 3} onclick={() => onmulti?.('distribute:x')} />
      <ToolbarButton icon="distributeV" label="Distribute vertically" disabled={selected.length < 3} onclick={() => onmulti?.('distribute:y')} />
      <span class="sep"></span>
      <ToolbarButton icon="group" label="Group" shortcut="⌘G" onclick={() => onmulti?.('group')} />
      <ToolbarButton icon="layout" label="Fix layout" onclick={() => onmulti?.('layout')} />
      <span class="sep"></span>
      <ToolbarButton icon="trash" label="Delete" shortcut="⌫" danger onclick={() => onmulti?.('del')} />
    </div>
  </NodeToolbar>
{/if}

<style>
  .bar {
    display: inline-flex;
    align-items: center;
    padding: 4px;
    box-sizing: border-box;
    background: var(--vscode-editorWidget-background, #252526);
    border: 1px solid var(--vscode-editorWidget-border, var(--vscode-widget-border, #454545));
    border-radius: 6px;
    box-shadow: var(--cv-shadow-float, 0 4px 16px rgb(0 0 0 / 0.28));
    font-family: var(--vscode-font-family, system-ui, sans-serif);
    white-space: nowrap;
  }
  .count {
    padding: 0 6px;
    color: var(--vscode-descriptionForeground, #9d9d9d);
    font-size: 11px;
  }
  .sep {
    width: 1px;
    height: 16px;
    margin: 0 4px;
    background: var(--vscode-editorWidget-border, var(--vscode-widget-border, #454545));
  }
</style>
