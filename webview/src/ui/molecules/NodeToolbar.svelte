<script module lang="ts">
  import type { IconName } from '../atoms/Icon.svelte';
  export type NodeToolbarAction = {
    id: string;
    label: string;
    icon: IconName;
    /** Shown in the tooltip, e.g. "⌘D". */
    shortcut?: string;
    danger?: boolean;
    disabled?: boolean;
    /** Pressed / current state (e.g. the finding's current status). */
    active?: boolean;
  };
</script>

<script lang="ts">
  import ColorPicker from './ColorPicker.svelte';
  import ToolbarButton from './ToolbarButton.svelte';

  let {
    color,
    actions = [],
    showColors = true,
    oncolor,
    onaction,
  }: {
    color?: string;
    /** Contextual actions, e.g. Open in editor, Trace callers, Duplicate, Delete, Fix layout. */
    actions?: NodeToolbarAction[];
    showColors?: boolean;
    oncolor?: (color: string | undefined) => void;
    onaction?: (id: string) => void;
  } = $props();
</script>

<!-- Floating chrome: place above the selected node (e.g. inside xyflow's <NodeToolbar>). -->
<div class="bar nodrag nopan" role="toolbar" aria-label="Node actions">
  {#if showColors}<ColorPicker value={color} onchange={oncolor} />{/if}
  {#if showColors && actions.length}<span class="sep"></span>{/if}
  {#each actions as a (a.id)}
    <ToolbarButton icon={a.icon} label={a.label} shortcut={a.shortcut} danger={a.danger} disabled={a.disabled} active={a.active} onclick={() => onaction?.(a.id)} />
  {/each}
</div>

<style>
  .bar {
    display: inline-flex;
    align-items: center;
    gap: 0;
    padding: 4px;
    box-sizing: border-box;
    background: var(--vscode-editorWidget-background, #252526);
    border: 1px solid var(--vscode-editorWidget-border, var(--vscode-widget-border, #454545));
    border-radius: 6px;
    box-shadow: var(--cv-shadow-float, 0 4px 16px rgb(0 0 0 / 0.28));
    font-family: var(--vscode-font-family, system-ui, sans-serif);
    white-space: nowrap;
  }
  .sep {
    width: 1px;
    height: 16px;
    margin: 0 4px;
    background: var(--vscode-editorWidget-border, var(--vscode-widget-border, #454545));
  }
</style>
