<script lang="ts">
  import IconButton from '../ui/atoms/IconButton.svelte';

  // The one slim floating toolbar (top-left): add, issues, pin, command bar. Canvas path lives in the breadcrumbs.
  let {
    pinned = false,
    issueCount = 0,
    issueSeverity = 'warning',
    issuesOpen = false,
    shapesOpen = false,
    title,
    canvasPath,
    onadd,
    onshapes,
    onissues,
    onpin,
    oncommand,
  }: {
    pinned?: boolean;
    issueCount?: number;
    issueSeverity?: 'error' | 'warning' | 'info';
    issuesOpen?: boolean;
    shapesOpen?: boolean;
    /** Shown muted at the end when there is no navigation trail. */
    title?: string;
    canvasPath?: string;
    /** Receives the anchor rect of the add button (client coordinates). */
    onadd?: (anchor: DOMRect) => void;
    onshapes?: () => void;
    onissues?: () => void;
    onpin?: () => void;
    oncommand?: () => void;
  } = $props();

  let addWrap = $state<HTMLSpanElement>();
</script>

<div class="toolbar nodrag nopan" role="toolbar" aria-label="Canvas">
  <span bind:this={addWrap} class="cell">
    <IconButton icon="plus" title="Add to canvas (/)" onclick={() => addWrap && onadd?.(addWrap.getBoundingClientRect())} />
  </span>
  <IconButton icon="shapes" title="Shapes (⇧S)" active={shapesOpen} onclick={onshapes} />
  <IconButton icon="command" title="Command bar (⌘K)" onclick={oncommand} />
  <IconButton icon={pinned ? 'pinFilled' : 'pin'} title={pinned ? 'Unpin from Canvases' : 'Pin to Canvases'} active={pinned} onclick={onpin} />
  {#if issueCount > 0}
    <span class="sep"></span>
    <span class="issues {issueSeverity}">
      <IconButton
        icon={issueSeverity}
        label={String(issueCount)}
        title={`${issueCount} layout ${issueCount === 1 ? 'issue' : 'issues'}`}
        active={issuesOpen}
        onclick={onissues}
      />
    </span>
  {/if}
  {#if title}
    <span class="sep"></span>
    <span class="title" title={canvasPath}>{title}</span>
  {/if}
</div>

<style>
  .toolbar {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    height: 32px;
    box-sizing: border-box;
    padding: 0 3px;
    max-width: 420px;
    background: var(--vscode-editorWidget-background, #252526);
    border: 1px solid var(--vscode-editorWidget-border, var(--vscode-widget-border, #454545));
    border-radius: 6px;
    box-shadow: var(--cv-shadow-float, 0 4px 16px rgb(0 0 0 / 0.28));
  }
  .cell {
    display: inline-flex;
  }
  .sep {
    width: 1px;
    height: 16px;
    margin: 0 3px;
    background: var(--vscode-editorWidget-border, var(--vscode-widget-border, #454545));
  }
  .issues.error :global(svg) {
    color: var(--vscode-editorError-foreground, #f14c4c);
  }
  .issues.warning :global(svg) {
    color: var(--vscode-editorWarning-foreground, #cca700);
  }
  .issues.info :global(svg) {
    color: var(--vscode-editorInfo-foreground, #3794ff);
  }
  .title {
    padding: 0 6px 0 3px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--vscode-descriptionForeground, #9d9d9d);
    font-family: var(--vscode-font-family, system-ui, sans-serif);
    font-size: 12px;
  }
</style>
