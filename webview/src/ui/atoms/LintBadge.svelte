<script lang="ts">
  import type { LintSeverity } from '../../../../src/shared/lint';
  import Icon from './Icon.svelte';

  let {
    severity,
    messages = [],
    count,
  }: {
    /** Worst severity among the diagnostics on the node. */
    severity: LintSeverity;
    /** Listed in the tooltip. */
    messages?: string[];
    /** Number shown next to the icon when above 1; defaults to messages.length. */
    count?: number;
  } = $props();

  const n = $derived(count ?? messages.length);
  const title = $derived(messages.length ? messages.map((m) => `- ${m}`).join('\n') : severity);
</script>

<span class="badge {severity}" {title} role="img" aria-label={`${n || 1} ${severity}`}>
  <Icon name={severity} size={12} />
  {#if n > 1}<span class="n">{n}</span>{/if}
</span>

<style>
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    height: 18px;
    padding: 0 5px;
    border-radius: 9px;
    background: var(--vscode-editor-background, #1e1e1e);
    border: 1px solid currentColor;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
    font-family: var(--vscode-font-family, system-ui, sans-serif);
    font-size: 10px;
    line-height: 1;
    cursor: default;
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
  .n {
    color: var(--vscode-editor-foreground, #ccc);
  }
</style>
