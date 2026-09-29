<script module lang="ts">
  import type { IconName } from '../atoms/Icon.svelte';
  export type QuickAddItem = { id: string; label: string; hint: string; icon: IconName; keywords?: string; /** Section heading shown above the first item of a group. */ group?: string; /** Shape id: the row shows a live thumbnail instead of the icon. */ shape?: string };

  export const QUICK_ADD_ITEMS: QuickAddItem[] = [
    { id: 'sticky', label: 'Sticky', hint: 'A short coloured note', icon: 'sticky' },
    { id: 'note', label: 'Note', hint: 'Markdown card with a title', icon: 'note' },
    { id: 'text', label: 'Text', hint: 'Free text drawn on the canvas', icon: 'text', keywords: 'label title' },
    { id: 'code', label: 'Code file…', hint: 'Pick a file from the workspace', icon: 'code', keywords: 'file source' },
    { id: 'finding', label: 'Finding', hint: 'Hypothesis, evidence or question', icon: 'hypothesis', keywords: 'hypothesis evidence investigation' },
    { id: 'log', label: 'Log', hint: 'Stack trace with clickable frames', icon: 'log', keywords: 'stack trace error' },
    { id: 'mermaid', label: 'Mermaid', hint: 'Diagram from text', icon: 'mermaid', keywords: 'diagram chart' },
    { id: 'service', label: 'Service', hint: 'A domain with entry points', icon: 'service', keywords: 'domain map' },
    { id: 'link', label: 'Link', hint: 'A web address', icon: 'link', keywords: 'url' },
  ];
</script>

<script lang="ts">
  import { onMount } from 'svelte';
  import Icon from '../atoms/Icon.svelte';
  import { scoreFields } from '../../lib/search';
  import { LIBRARIES, SHAPES, libraryById, type ShapeDef } from '../../../../src/shared/shapes';
  import { FEATURED_SHAPES, scoreShape } from '../../lib/shapes/search';
  import { shapeKind } from '../../lib/shapes/create';
  import ShapeThumb from './ShapeThumb.svelte';

  let {
    x,
    y,
    items = QUICK_ADD_ITEMS,
    frames = true,
    onselect,
    onclose,
  }: {
    /** Screen point (px, relative to the positioned parent) where the arrow was dropped. */
    x: number;
    y: number;
    items?: QuickAddItem[];
    /** Offer frame shapes (boundary, package, pool, region). Off when connecting from a node: frames cannot be linked. */
    frames?: boolean;
    onselect?: (id: string) => void;
    onclose?: () => void;
  } = $props();

  let query = $state('');
  let active = $state(0);
  let root = $state<HTMLDivElement>();
  let input = $state<HTMLInputElement>();
  let shift = $state({ x: 0, y: 0 });

  const shapeItem = (d: ShapeDef): QuickAddItem => ({
    id: shapeKind(d.id),
    label: d.name,
    hint: libraryById(d.library)?.name ?? d.library,
    icon: 'shapes',
    shape: d.id,
    group: 'Shapes',
  });
  const MAX_SHAPES = 24;

  // Built-in kinds first, then a "Shapes" group: a few featured ones, or everything that matches the query.
  const results = $derived.by<QuickAddItem[]>(() => {
    const q = query.trim();
    const pool = SHAPES.filter((d) => frames || !d.frame);
    if (!q) return [...items, ...FEATURED_SHAPES.map((id) => pool.find((d) => d.id === id)).filter((d): d is ShapeDef => !!d).map(shapeItem)];
    const base = items
      .map((it) => ({ it, s: scoreFields(q, [[it.label, 1], [it.keywords, 0.6], [it.hint, 0.4]]) }))
      .filter((r) => r.s > 0)
      .sort((a, b) => b.s - a.s)
      .map((r) => r.it);
    const order = new Map(LIBRARIES.map((l, i) => [l.id as string, i]));
    const shapes = pool
      .map((d) => ({ d, s: scoreShape(q, d) }))
      .filter((r) => r.s > 0)
      .sort((a, b) => b.s - a.s || (order.get(a.d.library) ?? 0) - (order.get(b.d.library) ?? 0))
      .slice(0, MAX_SHAPES)
      .map((r) => shapeItem(r.d));
    return [...base, ...shapes];
  });
  $effect(() => {
    void query;
    active = 0;
  });
  // Keep the highlighted row in view while arrowing through a long list.
  $effect(() => {
    const it = results[active];
    if (it) root?.querySelector(`#qa-${CSS.escape(it.id)}`)?.scrollIntoView({ block: 'nearest' });
  });

  onMount(() => {
    input?.focus();
    // keep inside the parent
    const el = root;
    const parent = el?.offsetParent as HTMLElement | null;
    if (el && parent) {
      const dx = Math.min(0, parent.clientWidth - 8 - (x + el.offsetWidth));
      const dy = Math.min(0, parent.clientHeight - 8 - (y + el.offsetHeight));
      shift = { x: dx, y: dy };
    }
    const down = (e: PointerEvent) => {
      if (root && !root.contains(e.target as Node)) onclose?.();
    };
    window.addEventListener('pointerdown', down, true);
    return () => window.removeEventListener('pointerdown', down, true);
  });

  function onkeydown(e: KeyboardEvent) {
    e.stopPropagation();
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      active = (active + 1) % Math.max(1, results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      active = (active - 1 + results.length) % Math.max(1, results.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const it = results[active];
      if (it) onselect?.(it.id);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onclose?.();
    }
  }
</script>

<div
  class="menu nodrag nopan nowheel"
  bind:this={root}
  style={`left:${x + shift.x}px; top:${y + shift.y}px`}
  role="dialog"
  aria-label="Add to canvas"
  tabindex="-1"
  {onkeydown}
>
  <div class="search">
    <Icon name="search" size={14} />
    <input
      bind:this={input}
      bind:value={query}
      placeholder="Add to canvas"
      spellcheck="false"
      role="combobox"
      aria-expanded="true"
      aria-controls="qa-list"
      aria-activedescendant={results[active] ? `qa-${results[active].id}` : undefined}
    />
  </div>
  <div class="list" id="qa-list" role="listbox">
    {#each results as it, i (it.id)}
      {#if it.group && results[i - 1]?.group !== it.group}<div class="group">{it.group}</div>{/if}
      <button
        type="button"
        id={`qa-${it.id}`}
        class="row"
        class:active={i === active}
        role="option"
        aria-selected={i === active}
        onmousemove={() => (active = i)}
        onclick={() => onselect?.(it.id)}
      >
        <span class="glyph" class:thumb={!!it.shape}>
          {#if it.shape}<ShapeThumb shape={it.shape} width={32} height={22} pad={2} />{:else}<Icon name={it.icon} />{/if}
        </span>
        <span class="label">{it.label}</span>
        <span class="hint">{it.hint}</span>
      </button>
    {:else}
      <div class="empty">Nothing matches. Try “sticky”, “code” or “decision”.</div>
    {/each}
  </div>
</div>

<style>
  .menu {
    position: absolute;
    z-index: 20;
    width: 320px;
    box-sizing: border-box;
    padding: 4px;
    background: var(--vscode-editorWidget-background, #252526);
    border: 1px solid var(--vscode-editorWidget-border, var(--vscode-widget-border, #454545));
    border-radius: 10px;
    box-shadow: var(--cv-shadow-float, 0 4px 16px rgb(0 0 0 / 0.28));
    color: var(--vscode-editor-foreground, #ccc);
    font-family: var(--vscode-font-family, system-ui, sans-serif);
    font-size: 13px;
    animation: qa-in 120ms ease-out;
  }
  @keyframes qa-in {
    from {
      opacity: 0;
      transform: translateY(2px);
    }
    to {
      opacity: 1;
      transform: none;
    }
  }
  .search {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 32px;
    padding: 0 8px;
    color: var(--vscode-descriptionForeground, #9d9d9d);
    border-bottom: 1px solid var(--vscode-editorWidget-border, var(--vscode-widget-border, #454545));
    margin-bottom: 4px;
  }
  input {
    flex: 1;
    min-width: 0;
    height: 24px;
    border: 0;
    outline: none;
    background: transparent;
    color: var(--vscode-editor-foreground, #ccc);
    font: inherit;
  }
  input::placeholder {
    color: var(--vscode-input-placeholderForeground, #8a8a8a);
  }
  .list {
    display: flex;
    flex-direction: column;
    max-height: 320px;
    overflow-y: auto;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 32px;
    padding: 0 8px;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
  .row.active {
    background: var(--vscode-list-hoverBackground, rgba(90, 93, 94, 0.31));
    outline: 1px solid var(--vscode-focusBorder, #007fd4);
    outline-offset: -1px;
  }
  .group {
    padding: 8px 8px 2px;
    color: var(--vscode-descriptionForeground, #9d9d9d);
    font-size: 11px;
  }
  .glyph {
    display: grid;
    flex: none;
    width: 16px;
    color: var(--vscode-icon-foreground, var(--vscode-editor-foreground, #ccc));
  }
  .glyph.thumb {
    width: 32px;
    margin-left: -8px;
  }
  .label {
    flex: none;
  }
  .hint {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--vscode-descriptionForeground, #9d9d9d);
    font-size: 11px;
    text-align: right;
  }
  .empty {
    padding: 12px 8px;
    color: var(--vscode-descriptionForeground, #9d9d9d);
    font-size: 12px;
  }
  @media (prefers-reduced-motion: reduce) {
    .menu {
      animation: none;
    }
  }
</style>
