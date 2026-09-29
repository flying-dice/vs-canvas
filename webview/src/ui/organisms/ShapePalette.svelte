<script lang="ts">
  import { LIBRARIES, shapesIn, type ShapeDef } from '../../../../src/shared/shapes';
  import { searchShapes } from '../../lib/shapes/search';
  import { SHAPE_MIME } from '../../lib/shapes/create';
  import { getState, setState } from '../../lib/vscode';
  import Icon from '../atoms/Icon.svelte';
  import IconButton from '../atoms/IconButton.svelte';
  import ShapeThumb from '../molecules/ShapeThumb.svelte';

  // Left side panel (240px, overlays the canvas edge): shape libraries as collapsible sections with search. Drag a
  // tile onto the canvas to drop the shape there, or click it to add it at the centre of the view.
  let {
    onadd,
    onclose,
  }: {
    /** Click / Enter: add at the centre of the view. */
    onadd?: (shapeId: string) => void;
    onclose?: () => void;
  } = $props();

  let query = $state('');
  let input = $state<HTMLInputElement>();
  let collapsed = $state<string[]>(getState<{ shapeSectionsCollapsed: string[] }>().shapeSectionsCollapsed ?? LIBRARIES.slice(1).map((l) => l.id));

  const results = $derived(query.trim() ? searchShapes(query) : []);
  const searching = $derived(query.trim() !== '');

  function toggle(id: string) {
    collapsed = collapsed.includes(id) ? collapsed.filter((c) => c !== id) : [...collapsed, id];
    setState({ shapeSectionsCollapsed: collapsed });
  }

  function dragstart(e: DragEvent, s: ShapeDef) {
    const dt = e.dataTransfer;
    if (!dt) return;
    dt.setData(SHAPE_MIME, s.id);
    dt.setData('text/plain', s.name);
    dt.effectAllowed = 'copy';
    const thumb = (e.currentTarget as HTMLElement).querySelector('.thumb');
    if (thumb) dt.setDragImage(thumb, 44, 24);
  }

  function onkeydown(e: KeyboardEvent) {
    e.stopPropagation();
    if (e.key === 'Escape') {
      e.preventDefault();
      if (query) query = '';
      else onclose?.();
    } else if (e.key === 'Enter' && e.target === input && results[0]) {
      e.preventDefault();
      onadd?.(results[0].id);
    }
  }
</script>

{#snippet tile(s: ShapeDef)}
  <button
    type="button"
    class="tile"
    draggable="true"
    title={`${s.name}: ${s.description}`}
    ondragstart={(e) => dragstart(e, s)}
    onclick={() => onadd?.(s.id)}
  >
    <ShapeThumb shape={s.id} width={88} height={52} />
    <span class="name">{s.name}</span>
  </button>
{/snippet}

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<aside class="palette nodrag nopan nowheel" aria-label="Shapes" {onkeydown}>
  <header>
    <span class="title">Shapes</span>
    <IconButton icon="close" title="Close (⇧S)" onclick={onclose} />
  </header>
  <div class="search">
    <Icon name="search" size={14} />
    <input bind:this={input} bind:value={query} placeholder="Search shapes" spellcheck="false" aria-label="Search shapes" />
  </div>
  <div class="scroll">
    {#if searching}
      {#if results.length}
        <div class="grid">
          {#each results as s (s.id)}{@render tile(s)}{/each}
        </div>
      {:else}
        <div class="empty">No shapes match “{query.trim()}”. Try “decision”, “class” or “database”.</div>
      {/if}
    {:else}
      {#each LIBRARIES as lib (lib.id)}
        {@const open = !collapsed.includes(lib.id)}
        {@const list = shapesIn(lib.id)}
        <section>
          <button type="button" class="sec" aria-expanded={open} title={lib.description} onclick={() => toggle(lib.id)}>
            <Icon name={open ? 'chevronDown' : 'chevronRight'} size={14} />
            <span class="lib">{lib.name}</span>
            <span class="count">{list.length}</span>
          </button>
          {#if open}
            <div class="grid">
              {#each list as s (s.id)}{@render tile(s)}{/each}
            </div>
          {/if}
        </section>
      {/each}
    {/if}
  </div>
</aside>

<style>
  .palette {
    position: absolute;
    z-index: 15;
    left: 0;
    top: 0;
    bottom: 0;
    width: 240px;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    background: var(--vscode-sideBar-background, var(--vscode-editorWidget-background, #252526));
    color: var(--vscode-sideBar-foreground, var(--vscode-editor-foreground, #ccc));
    border-right: 1px solid var(--vscode-sideBar-border, var(--vscode-editorWidget-border, #454545));
    font-family: var(--vscode-font-family, system-ui, sans-serif);
    font-size: 13px;
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex: none;
    height: 35px;
    padding: 0 6px 0 12px;
  }
  .title {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.02em;
    color: var(--vscode-sideBarTitle-foreground, var(--vscode-editor-foreground, #ccc));
  }
  .search {
    display: flex;
    align-items: center;
    gap: 6px;
    flex: none;
    height: 26px;
    margin: 0 8px 8px;
    padding: 0 6px;
    box-sizing: border-box;
    background: var(--vscode-input-background, #3c3c3c);
    border: 1px solid var(--vscode-input-border, transparent);
    border-radius: 4px;
    color: var(--vscode-descriptionForeground, #9d9d9d);
  }
  .search:focus-within {
    border-color: var(--vscode-focusBorder, #007fd4);
  }
  input {
    flex: 1;
    min-width: 0;
    height: 22px;
    border: 0;
    outline: none;
    background: transparent;
    color: var(--vscode-input-foreground, #ccc);
    font: inherit;
    font-size: 12px;
  }
  input::placeholder {
    color: var(--vscode-input-placeholderForeground, #8a8a8a);
  }
  .scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding-bottom: 16px;
  }
  .sec {
    display: flex;
    align-items: center;
    gap: 2px;
    width: 100%;
    height: 24px;
    padding: 0 8px 0 4px;
    border: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    font-size: 12px;
    font-weight: 600;
    text-align: left;
    cursor: pointer;
  }
  .sec:hover {
    background: var(--vscode-list-hoverBackground, rgba(90, 93, 94, 0.31));
  }
  .sec:focus-visible,
  .tile:focus-visible {
    outline: 1px solid var(--vscode-focusBorder, #007fd4);
    outline-offset: -1px;
  }
  .lib {
    flex: 1;
  }
  .count {
    padding: 0 6px;
    border-radius: 8px;
    background: var(--vscode-badge-background, #616161);
    color: var(--vscode-badge-foreground, #f8f8f8);
    font-size: 10px;
    font-weight: 400;
    line-height: 16px;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(2, 104px);
    gap: 4px;
    padding: 4px 8px 8px;
  }
  .tile {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    width: 104px;
    padding: 4px 4px 6px;
    box-sizing: border-box;
    border: 0;
    border-radius: 4px;
    background: transparent;
    color: inherit;
    font: inherit;
    cursor: grab;
  }
  .tile:hover {
    background: var(--vscode-list-hoverBackground, rgba(90, 93, 94, 0.31));
  }
  .tile:active {
    cursor: grabbing;
  }
  .name {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 11px;
    line-height: 16px;
  }
  .empty {
    padding: 12px;
    color: var(--vscode-descriptionForeground, #9d9d9d);
    font-size: 12px;
  }
</style>
