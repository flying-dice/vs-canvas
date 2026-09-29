<script module lang="ts">
  import type { IconName } from '../atoms/Icon.svelte';
  export type ToolbarItem = { id: string; label: string; title?: string; icon: IconName };
</script>

<script lang="ts">
  import IconButton from '../atoms/IconButton.svelte';

  let {
    items,
    caption,
    onselect,
    issueCount = 0,
    issueSeverity = 'warning',
    issuesOpen = false,
    onissues,
  }: {
    items: ToolbarItem[];
    /** Small muted text below the buttons (e.g. the canvas file path). */
    caption?: string;
    onselect?: (id: string) => void;
    /** Layout issues found by the linter; the button is hidden at 0. */
    issueCount?: number;
    /** Worst severity, colors the icon. */
    issueSeverity?: 'error' | 'warning' | 'info';
    issuesOpen?: boolean;
    onissues?: () => void;
  } = $props();
</script>

<div class="toolbar nodrag">
  <div class="row" role="toolbar">
    {#each items as item (item.id)}
      <IconButton icon={item.icon} label={item.label} title={item.title} onclick={() => onselect?.(item.id)} />
    {/each}
    {#if issueCount > 0}
      <span class="issues {issueSeverity}">
        <IconButton
          icon={issueSeverity}
          label={`${issueCount} ${issueCount === 1 ? 'issue' : 'issues'}`}
          title="Show layout issues"
          active={issuesOpen}
          onclick={onissues}
        />
      </span>
    {/if}
  </div>
  {#if caption}<div class="caption" title={caption}>{caption}</div>{/if}
</div>

<style>
  .toolbar {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 3px;
    max-width: 480px;
    background: var(--vscode-editorWidget-background, #252526);
    border: 1px solid var(--vscode-editorWidget-border, var(--vscode-panel-border, #454545));
    border-radius: 6px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }
  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 2px;
  }
  .issues {
    display: inline-flex;
    margin-left: 4px;
    padding-left: 4px;
    border-left: 1px solid var(--vscode-editorWidget-border, var(--vscode-panel-border, #454545));
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
  .caption {
    padding: 0 6px 2px;
    color: var(--vscode-descriptionForeground, #9d9d9d);
    font-family: var(--vscode-font-family, system-ui, sans-serif);
    font-size: 10px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
