<script module lang="ts">
  import type { IconName } from '../atoms/Icon.svelte';
  export type CommandNode = { id: string; title: string; path?: string; text?: string; icon?: IconName };
  export type CommandCanvas = { path: string; title: string };
  export type CommandAction = { id: string; label: string; shortcut?: string; icon?: IconName };
  export type CommandGroup = 'action' | 'node' | 'canvas';
  export type CommandSelection = { group: CommandGroup; id: string };
</script>

<script lang="ts">
  import Icon from '../atoms/Icon.svelte';
  import { scoreFields } from '../../lib/search';

  let {
    open = $bindable(false),
    nodes = [],
    canvases = [],
    actions = [],
    shortcut = true,
    onselect,
  }: {
    open?: boolean;
    nodes?: CommandNode[];
    canvases?: CommandCanvas[];
    actions?: CommandAction[];
    /** Cmd/Ctrl+K toggles the bar. */
    shortcut?: boolean;
    onselect?: (sel: CommandSelection) => void;
  } = $props();

  type Row = { group: CommandGroup; id: string; label: string; detail?: string; icon: IconName; shortcut?: string; s: number };
  const GROUPS: { key: CommandGroup; title: string }[] = [
    { key: 'action', title: 'Actions' },
    { key: 'node', title: 'Nodes' },
    { key: 'canvas', title: 'Canvases' },
  ];
  const LIMIT: Record<CommandGroup, number> = { action: 6, node: 8, canvas: 4 };

  let query = $state('');
  let active = $state(0);
  let input = $state<HTMLInputElement>();
  let list = $state<HTMLDivElement>();

  const rows = $derived.by<Row[]>(() => {
    const q = query.trim();
    const all: Row[] = [
      ...actions.map((a): Row => ({ group: 'action', id: a.id, label: a.label, icon: a.icon ?? 'command', shortcut: a.shortcut, s: scoreFields(q, [[a.label, 1]]) })),
      ...nodes.map((n): Row => ({ group: 'node', id: n.id, label: n.title || 'Untitled', detail: n.path, icon: n.icon ?? 'note', s: scoreFields(q, [[n.title, 1], [n.path, 0.8], [n.text, 0.4]]) })),
      ...canvases.map((c): Row => ({ group: 'canvas', id: c.path, label: c.title, detail: c.path, icon: 'map', s: scoreFields(q, [[c.title, 1], [c.path, 0.6]]) })),
    ].filter((r) => r.s > 0);
    const out: Row[] = [];
    for (const g of GROUPS) {
      const inGroup = all.filter((r) => r.group === g.key);
      if (q) inGroup.sort((a, b) => b.s - a.s);
      out.push(...inGroup.slice(0, LIMIT[g.key]));
    }
    return out;
  });

  $effect(() => {
    void query;
    active = 0;
  });
  $effect(() => {
    if (open) {
      query = '';
      queueMicrotask(() => input?.focus());
    }
  });
  $effect(() => {
    if (open && list) list.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  });

  function choose(r: Row | undefined) {
    if (!r) return;
    open = false;
    onselect?.({ group: r.group, id: r.id });
  }
  function onkeydown(e: KeyboardEvent) {
    e.stopPropagation();
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      active = (active + 1) % Math.max(1, rows.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      active = (active - 1 + rows.length) % Math.max(1, rows.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose(rows[active]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      open = false;
    }
  }
  function windowKey(e: KeyboardEvent) {
    if (shortcut && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      open = !open;
    }
  }
</script>

<svelte:window onkeydown={windowKey} />

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div class="scrim nodrag nopan nowheel" onpointerdown={(e) => e.target === e.currentTarget && (open = false)}>
    <div class="bar" role="dialog" aria-label="Command bar" tabindex="-1" {onkeydown}>
      <div class="search">
        <Icon name="search" size={16} />
        <input
          bind:this={input}
          bind:value={query}
          placeholder="Search nodes, canvases and actions"
          spellcheck="false"
          role="combobox"
          aria-expanded="true"
          aria-controls="cb-list"
        />
        <kbd>Esc</kbd>
      </div>
      <div class="list" id="cb-list" role="listbox" bind:this={list}>
        {#each GROUPS as g (g.key)}
          {@const inGroup = rows.filter((r) => r.group === g.key)}
          {#if inGroup.length}
            <div class="head">{g.title}</div>
            {#each inGroup as r (r.group + r.id)}
              {@const i = rows.indexOf(r)}
              <button
                type="button"
                class="row"
                class:active={i === active}
                role="option"
                aria-selected={i === active}
                onmousemove={() => (active = i)}
                onclick={() => choose(r)}
              >
                <span class="glyph"><Icon name={r.icon} /></span>
                <span class="label">{r.label}</span>
                {#if r.detail}<span class="detail">{r.detail}</span>{/if}
                {#if r.shortcut}<kbd>{r.shortcut}</kbd>{/if}
              </button>
            {/each}
          {/if}
        {/each}
        {#if !rows.length}
          <div class="empty">No results for “{query}”. Try a file name, a title or an action.</div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .scrim {
    position: absolute;
    inset: 0;
    z-index: 30;
    display: flex;
    justify-content: center;
    align-items: flex-start;
    padding-top: 12vh;
    background: transparent;
  }
  .bar {
    width: min(560px, calc(100% - 32px));
    box-sizing: border-box;
    background: var(--vscode-quickInput-background, var(--vscode-editorWidget-background, #252526));
    border: 1px solid var(--vscode-editorWidget-border, var(--vscode-widget-border, #454545));
    border-radius: 10px;
    box-shadow: var(--cv-shadow-float, 0 4px 16px rgb(0 0 0 / 0.28));
    color: var(--vscode-editor-foreground, #ccc);
    font-family: var(--vscode-font-family, system-ui, sans-serif);
    font-size: 13px;
    overflow: hidden;
    animation: cb-in 120ms ease-out;
  }
  .search {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 40px;
    padding: 0 12px;
    color: var(--vscode-descriptionForeground, #9d9d9d);
    border-bottom: 1px solid var(--vscode-editorWidget-border, var(--vscode-widget-border, #454545));
  }
  input {
    flex: 1;
    min-width: 0;
    height: 32px;
    border: 0;
    outline: none;
    background: transparent;
    color: var(--vscode-editor-foreground, #ccc);
    font: inherit;
    font-size: 14px;
  }
  input::placeholder {
    color: var(--vscode-input-placeholderForeground, #8a8a8a);
  }
  kbd {
    flex: none;
    padding: 0 6px;
    height: 18px;
    line-height: 18px;
    border-radius: 4px;
    border: 1px solid var(--vscode-editorWidget-border, #454545);
    background: var(--vscode-keybindingLabel-background, transparent);
    color: var(--vscode-descriptionForeground, #9d9d9d);
    font-family: inherit;
    font-size: 11px;
  }
  .row kbd {
    margin-left: auto;
  }
  .list {
    max-height: 360px;
    overflow-y: auto;
    padding: 4px;
  }
  .head {
    padding: 8px 8px 4px;
    color: var(--vscode-descriptionForeground, #9d9d9d);
    font-size: 11px;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    height: 32px;
    padding: 0 8px;
    box-sizing: border-box;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
  .row.active {
    background: var(--vscode-list-activeSelectionBackground, var(--vscode-list-hoverBackground, rgba(90, 93, 94, 0.31)));
    color: var(--vscode-list-activeSelectionForeground, inherit);
  }
  .glyph {
    display: grid;
    flex: none;
    color: var(--vscode-icon-foreground, var(--vscode-editor-foreground, #ccc));
  }
  .label {
    flex: none;
    max-width: 55%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .detail {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--vscode-descriptionForeground, #9d9d9d);
    font-size: 11px;
  }
  .row.active .detail {
    color: inherit;
    opacity: 0.8;
  }
  .empty {
    padding: 16px 12px;
    color: var(--vscode-descriptionForeground, #9d9d9d);
  }
  @keyframes cb-in {
    from {
      opacity: 0;
      transform: translateY(2px);
    }
    to {
      opacity: 1;
      transform: none;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .bar {
      animation: none;
    }
  }
</style>
