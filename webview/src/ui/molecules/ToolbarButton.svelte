<script lang="ts">
  import Icon, { type IconName } from '../atoms/Icon.svelte';

  let {
    icon,
    label,
    shortcut,
    active = false,
    danger = false,
    disabled = false,
    onclick,
  }: {
    icon: IconName;
    label: string;
    shortcut?: string;
    active?: boolean;
    danger?: boolean;
    disabled?: boolean;
    onclick?: () => void;
  } = $props();
</script>

<button
  type="button"
  class="tb"
  class:active
  class:danger
  {disabled}
  title={shortcut ? `${label} (${shortcut})` : label}
  aria-label={label}
  aria-pressed={active || undefined}
  {onclick}
><Icon name={icon} /></button>

<style>
  .tb {
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    padding: 0;
    border: 0;
    border-radius: 4px;
    background: transparent;
    color: var(--vscode-icon-foreground, var(--vscode-editor-foreground, #ccc));
    cursor: pointer;
    transition: background-color 120ms ease;
  }
  .tb:hover:not(:disabled) {
    background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
  }
  .tb.active {
    background: var(--vscode-toolbar-activeBackground, rgba(99, 102, 103, 0.31));
  }
  .tb.danger:hover:not(:disabled) {
    color: var(--vscode-errorForeground, #f48771);
  }
  .tb:focus-visible {
    outline: 1px solid var(--vscode-focusBorder, #007fd4);
    outline-offset: -1px;
  }
  .tb:disabled {
    opacity: 0.4;
    cursor: default;
  }
  @media (prefers-reduced-motion: reduce) {
    .tb {
      transition: none;
    }
  }
</style>
