<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    value,
    editing = $bindable(false),
    mono = false,
    placeholder = 'Double-click to edit',
    oncommit,
    children,
    class: cls = '',
  }: {
    value: string;
    editing?: boolean;
    /** Monospace textarea, e.g. for Mermaid source. */
    mono?: boolean;
    placeholder?: string;
    /** Called with the new text on blur or Ctrl/Cmd+Enter (only when it changed). */
    oncommit?: (text: string) => void;
    /** The read-only view. */
    children: Snippet;
    class?: string;
  } = $props();

  let draft = $state('');
  let area = $state<HTMLTextAreaElement>();
  let finished = false;

  $effect(() => {
    if (editing && area) {
      finished = false;
      draft = value;
      area.focus();
      area.setSelectionRange(area.value.length, area.value.length);
    }
  });

  function commit() {
    if (finished) return;
    finished = true;
    editing = false;
    if (draft !== value) oncommit?.(draft);
  }
  function cancel() {
    finished = true;
    editing = false;
  }
  function onkeydown(e: KeyboardEvent) {
    // Keep keys away from the canvas (Backspace must not delete the node).
    e.stopPropagation();
    if (e.key === 'Escape') {
      e.preventDefault();
      cancel();
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      commit();
    }
  }
</script>

{#if editing}
  <textarea
    bind:this={area}
    bind:value={draft}
    class={['editor', 'nodrag', 'nowheel', 'nopan', mono && 'mono', cls]}
    {placeholder}
    spellcheck="false"
    {onkeydown}
    onkeyup={(e) => e.stopPropagation()}
    onblur={commit}
  ></textarea>
{:else}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class={['view', cls]} ondblclick={() => (editing = true)}>
    {@render children()}
  </div>
{/if}

<style>
  .view {
    width: 100%;
    height: 100%;
    box-sizing: border-box;
  }
  .editor {
    display: block;
    box-sizing: border-box;
    width: 100%;
    height: 100%;
    min-height: 40px;
    margin: 0;
    padding: 8px 10px;
    resize: none;
    border: 1px solid var(--vscode-focusBorder, #007fd4);
    border-radius: 4px;
    outline: none;
    background: var(--vscode-input-background, #3c3c3c);
    color: var(--vscode-input-foreground, #ccc);
    font-family: var(--vscode-font-family, system-ui, sans-serif);
    font-size: 13px;
    line-height: 1.5;
    user-select: text;
    cursor: text;
  }
  .editor.mono {
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: 12px;
  }
</style>
