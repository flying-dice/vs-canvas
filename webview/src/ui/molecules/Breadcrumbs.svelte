<script module lang="ts">
  export type Crumb = { path: string; title: string };
</script>

<script lang="ts">
  import Icon from '../atoms/Icon.svelte';

  let {
    trail,
    max = 4,
    onnavigate,
  }: {
    /** Oldest first; the last entry is the canvas being viewed. */
    trail: Crumb[];
    /** Longer trails collapse their middle into an ellipsis. */
    max?: number;
    onnavigate?: (path: string, index: number) => void;
  } = $props();

  type Item = { crumb: Crumb; index: number } | { gap: true; hidden: Crumb[] };
  const items = $derived.by<Item[]>(() => {
    const all = trail.map((crumb, index) => ({ crumb, index }));
    if (all.length <= max) return all;
    // keep the root, the last (max - 2) entries, and fold the rest
    const keep = max - 2;
    return [all[0], { gap: true, hidden: all.slice(1, all.length - keep).map((a) => a.crumb) }, ...all.slice(all.length - keep)];
  });
</script>

{#if trail.length > 1}
  <nav class="crumbs nodrag nopan" aria-label="Canvas trail">
    {#each items as it, i (i)}
      {#if i > 0}<span class="sep"><Icon name="chevronRight" size={12} /></span>{/if}
      {#if 'gap' in it}
        <span class="gap" title={it.hidden.map((h) => h.title).join(' › ')}>…</span>
      {:else if it.index === trail.length - 1}
        <span class="cur" aria-current="page" title={it.crumb.path}>{it.crumb.title}</span>
      {:else}
        <button type="button" class="crumb" title={it.crumb.path} onclick={() => onnavigate?.(it.crumb.path, it.index)}>{it.crumb.title}</button>
      {/if}
    {/each}
  </nav>
{/if}

<style>
  .crumbs {
    display: inline-flex;
    align-items: center;
    gap: 0;
    height: 32px;
    box-sizing: border-box;
    padding: 0 8px;
    max-width: 100%;
    background: var(--vscode-editorWidget-background, #252526);
    border: 1px solid var(--vscode-editorWidget-border, var(--vscode-widget-border, #454545));
    border-radius: 6px;
    box-shadow: var(--cv-shadow-float, 0 4px 16px rgb(0 0 0 / 0.28));
    font-family: var(--vscode-font-family, system-ui, sans-serif);
    font-size: 12px;
    color: var(--vscode-editor-foreground, #ccc);
  }
  .crumb,
  .cur,
  .gap {
    max-width: 180px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .crumb {
    height: 24px;
    padding: 0 6px;
    border: 0;
    border-radius: 4px;
    background: transparent;
    color: var(--vscode-textLink-foreground, #3794ff);
    font: inherit;
    cursor: pointer;
  }
  .crumb:hover {
    background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
    text-decoration: underline;
  }
  .crumb:focus-visible {
    outline: 1px solid var(--vscode-focusBorder, #007fd4);
  }
  .cur {
    padding: 0 6px;
    font-weight: 600;
  }
  .gap {
    padding: 0 6px;
    color: var(--vscode-descriptionForeground, #9d9d9d);
  }
  .sep {
    display: grid;
    color: var(--vscode-descriptionForeground, #9d9d9d);
  }
</style>
