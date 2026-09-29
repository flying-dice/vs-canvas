<script lang="ts">
  import type { LintDiagnostic, LintSeverity } from '../../../../src/shared/lint';
  import Icon from '../atoms/Icon.svelte';
  import IconButton from '../atoms/IconButton.svelte';

  let {
    diagnostics,
    onselect,
    onclose,
    onfixlayout,
    onfix,
  }: {
    diagnostics: LintDiagnostic[];
    /** A row was clicked. */
    onselect?: (d: LintDiagnostic) => void;
    onclose?: () => void;
    /** Header button: fix every layout issue that has a mechanical fix. */
    onfixlayout?: () => void;
    /** Per-issue quick fix (shown when the diagnostic has a `fix`). */
    onfix?: (d: LintDiagnostic) => void;
  } = $props();
  const fixable = $derived(diagnostics.some((d) => d.fix));

  const order: LintSeverity[] = ['error', 'warning', 'info'];
  const titles: Record<LintSeverity, string> = { error: 'Errors', warning: 'Warnings', info: 'Info' };

  const groups = $derived(
    order
      .map((severity) => ({ severity, items: diagnostics.filter((d) => d.severity === severity) }))
      .filter((g) => g.items.length),
  );
</script>

<section class="panel nodrag nowheel" aria-label="Layout issues">
  <header>
    <span class="title">Layout issues ({diagnostics.length})</span>
    <span class="hactions">
      {#if onfixlayout}<IconButton icon="layout" label="Fix layout" title="Fix layout" disabled={!fixable} onclick={onfixlayout} />{/if}
      <IconButton icon="close" title="Close" onclick={onclose} />
    </span>
  </header>
  <div class="scroll">
    {#each groups as g (g.severity)}
      <h3 class={g.severity}>{titles[g.severity]} ({g.items.length})</h3>
      <ul>
        {#each g.items as d, i (g.severity + i + d.rule + d.message)}
          <li class="li">
            <button type="button" class="item" onclick={() => onselect?.(d)}>
              <span class="ico {d.severity}"><Icon name={d.severity} size={14} /></span>
              <span class="text">
                <span class="msg">{d.message}</span>
                <span class="rule">{d.rule}</span>
              </span>
            </button>
            {#if d.fix && onfix}
              <button type="button" class="fix" title={d.fix.description} onclick={() => onfix?.(d)}>Fix</button>
            {/if}
          </li>
        {/each}
      </ul>
    {:else}
      <p class="empty">No issues.</p>
    {/each}
  </div>
</section>

<style>
  .panel {
    display: flex;
    flex-direction: column;
    width: 320px;
    max-height: min(60vh, 420px);
    background: var(--vscode-editorWidget-background, #252526);
    color: var(--vscode-editor-foreground, #ccc);
    border: 1px solid var(--vscode-editorWidget-border, var(--vscode-panel-border, #454545));
    border-radius: 6px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    font-family: var(--vscode-font-family, system-ui, sans-serif);
    font-size: 12px;
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 2px 3px 2px 10px;
    border-bottom: 1px solid var(--vscode-editorWidget-border, var(--vscode-panel-border, #454545));
  }
  .title {
    font-weight: 600;
  }
  .hactions {
    display: inline-flex;
    align-items: center;
    gap: 2px;
  }
  .li {
    position: relative;
    display: flex;
    align-items: flex-start;
  }
  .li:hover {
    background: var(--vscode-list-hoverBackground, rgba(90, 93, 94, 0.31));
  }
  .li .item {
    flex: 1;
    min-width: 0;
  }
  .fix {
    flex: none;
    align-self: center;
    margin-right: 8px;
    height: 22px;
    padding: 0 8px;
    border: 1px solid var(--vscode-button-secondaryBackground, #3a3d41);
    border-radius: 4px;
    background: var(--vscode-button-secondaryBackground, #3a3d41);
    color: var(--vscode-button-secondaryForeground, #ccc);
    font: inherit;
    cursor: pointer;
  }
  .fix:hover {
    background: var(--vscode-button-secondaryHoverBackground, #45494e);
  }
  .fix:focus-visible {
    outline: 1px solid var(--vscode-focusBorder, #007fd4);
  }
  .scroll {
    overflow-y: auto;
    padding: 2px 0 6px;
  }
  h3 {
    margin: 8px 10px 2px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--vscode-descriptionForeground, #9d9d9d);
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .item {
    display: flex;
    gap: 8px;
    width: 100%;
    padding: 5px 10px;
    border: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
  .item:focus-visible {
    outline: 1px solid var(--vscode-focusBorder, #007fd4);
    outline-offset: -1px;
  }
  .ico {
    flex: none;
    padding-top: 1px;
  }
  .text {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
  }
  .msg {
    overflow-wrap: anywhere;
  }
  .rule {
    color: var(--vscode-descriptionForeground, #9d9d9d);
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: 10px;
  }
  .error {
    color: var(--vscode-editorError-foreground, #f14c4c);
  }
  .warning {
    color: var(--vscode-editorWarning-foreground, #cca700);
  }
  .info {
    color: var(--vscode-editorInfo-foreground, #3794ff);
  }
  .empty {
    margin: 10px;
    color: var(--vscode-descriptionForeground, #9d9d9d);
  }
</style>
