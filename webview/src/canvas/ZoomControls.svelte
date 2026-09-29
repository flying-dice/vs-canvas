<script lang="ts">
  import ZoomIndicator from '../ui/atoms/ZoomIndicator.svelte';
  import ToolbarButton from '../ui/molecules/ToolbarButton.svelte';

  // Compact zoom cluster (bottom-left): - 100% + fit.
  let {
    zoom,
    onzoomout,
    onzoomin,
    onreset,
    onfit,
  }: { zoom: number; onzoomout?: () => void; onzoomin?: () => void; onreset?: () => void; onfit?: () => void } = $props();
</script>

<div class="cluster nodrag nopan" role="group" aria-label="Zoom">
  <ToolbarButton icon="minus" label="Zoom out" shortcut="⌘−" onclick={onzoomout} />
  <ZoomIndicator {zoom} {onreset} />
  <ToolbarButton icon="plus" label="Zoom in" shortcut="⌘+" onclick={onzoomin} />
  <span class="sep"></span>
  <ToolbarButton icon="fit" label="Fit all" shortcut="⇧1" onclick={onfit} />
</div>

<style>
  .cluster {
    display: inline-flex;
    align-items: center;
    height: 32px;
    box-sizing: border-box;
    padding: 0 3px;
    background: var(--vscode-editorWidget-background, #252526);
    border: 1px solid var(--vscode-editorWidget-border, var(--vscode-widget-border, #454545));
    border-radius: 6px;
    box-shadow: var(--cv-shadow-float, 0 4px 16px rgb(0 0 0 / 0.28));
  }
  .sep {
    width: 1px;
    height: 16px;
    margin: 0 3px;
    background: var(--vscode-editorWidget-border, var(--vscode-widget-border, #454545));
  }
</style>
