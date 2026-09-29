<script lang="ts">
  import Icon, { type IconName } from './Icon.svelte';

  let {
    icon,
    label,
    title,
    active = false,
    disabled = false,
    onclick,
  }: {
    icon?: IconName;
    /** Visible text next to the icon; omit for an icon-only button. */
    label?: string;
    title?: string;
    active?: boolean;
    disabled?: boolean;
    onclick?: (e: MouseEvent) => void;
  } = $props();
</script>

<button type="button" class="btn" class:active {disabled} title={title ?? label} aria-label={title ?? label} {onclick}>
  {#if icon}<Icon name={icon} />{/if}
  {#if label}<span>{label}</span>{/if}
</button>

<style>
  .btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    height: 26px;
    padding: 0 8px;
    border: 1px solid transparent;
    border-radius: 4px;
    background: transparent;
    color: var(--vscode-editor-foreground, #ccc);
    font-family: var(--vscode-font-family, system-ui, sans-serif);
    font-size: 12px;
    cursor: pointer;
  }
  .btn:hover:not(:disabled) {
    background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
  }
  .btn:focus-visible {
    outline: 1px solid var(--vscode-focusBorder, #007fd4);
  }
  .btn.active {
    background: var(--vscode-toolbar-activeBackground, rgba(99, 102, 103, 0.31));
  }
  .btn:disabled {
    opacity: 0.4;
    cursor: default;
  }
</style>
