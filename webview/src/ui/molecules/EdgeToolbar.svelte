<script module lang="ts">
  import type { EdgeEnd } from '../../../../src/shared/canvasFile';
  export type ArrowEnds = 'none' | 'end' | 'both';

  /** Which arrowheads an edge has, from its fromEnd/toEnd (toEnd defaults to an arrow). */
  export function endsOf(fromEnd?: EdgeEnd, toEnd?: EdgeEnd): ArrowEnds {
    const from = fromEnd === 'arrow';
    const to = (toEnd ?? 'arrow') === 'arrow';
    return from && to ? 'both' : to ? 'end' : from ? 'both' : 'none';
  }
  /** Edge patch for a chosen arrowhead setting. */
  export function endsPatch(ends: ArrowEnds): { fromEnd: EdgeEnd; toEnd: EdgeEnd } {
    return { fromEnd: ends === 'both' ? 'arrow' : 'none', toEnd: ends === 'none' ? 'none' : 'arrow' };
  }
</script>

<script lang="ts">
  import { LIBRARIES, RELATIONS, relationById, type RelationDef } from '../../../../src/shared/shapes';
  import type { EdgeMarker } from '../../../../src/shared/canvasFile';
  import ColorPicker from './ColorPicker.svelte';
  import ToolbarButton from './ToolbarButton.svelte';
  import EdgeMarkerPreview from '../atoms/EdgeMarkerPreview.svelte';
  import Icon from '../atoms/Icon.svelte';

  type Routing = 'bezier' | 'orthogonal' | 'straight';
  type LineStyle = 'solid' | 'dashed' | 'dotted';

  let {
    color,
    ends = 'end',
    showEnds = true,
    animated = false,
    routing = 'bezier',
    lineStyle = 'solid',
    relation,
    fromMarker = 'none',
    toMarker = 'arrow',
    oncolor,
    onends,
    onrouting,
    onlinestyle,
    onrelation,
    onanimated,
    oneditlabel,
    ondelete,
  }: {
    color?: string;
    ends?: ArrowEnds;
    /** The arrowhead segment is for plain edges; diagram edges (relations / markers) pick a relation instead. */
    showEnds?: boolean;
    animated?: boolean;
    routing?: Routing;
    lineStyle?: LineStyle;
    /** Current relation preset id, if any. */
    relation?: string;
    fromMarker?: EdgeMarker;
    toMarker?: EdgeMarker;
    oncolor?: (color: string | undefined) => void;
    onends?: (ends: ArrowEnds) => void;
    onrouting?: (routing: Routing) => void;
    onlinestyle?: (style: LineStyle) => void;
    /** A relation preset, or undefined to clear the relation (markers stay as they are). */
    onrelation?: (relation: RelationDef | undefined) => void;
    onanimated?: (animated: boolean) => void;
    oneditlabel?: () => void;
    ondelete?: () => void;
  } = $props();

  let open = $state(false);
  /** Popover direction: up by default (keeps the edge visible), down when the toolbar is near the top of the view. */
  let down = $state(false);
  let root = $state<HTMLDivElement>();
  const current = $derived(relationById(relation));

  $effect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => {
      if (root && !root.contains(e.target as Node)) open = false;
    };
    window.addEventListener('pointerdown', down, true);
    return () => window.removeEventListener('pointerdown', down, true);
  });

  function pick(r: RelationDef | undefined) {
    open = false;
    onrelation?.(r);
  }
  function onkeydown(e: KeyboardEvent) {
    if (open && e.key === 'Escape') {
      e.stopPropagation();
      open = false;
    }
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div class="bar nodrag nopan nowheel" role="toolbar" aria-label="Edge actions" tabindex="-1" bind:this={root} {onkeydown}>
  <ColorPicker value={color} onchange={oncolor} />
  <span class="sep"></span>
  <div class="rel">
    <button
      type="button"
      class="relbtn"
      class:on={open}
      title="Relation: sets markers, line style and routing"
      aria-haspopup="listbox"
      aria-expanded={open}
      onclick={() => {
        down = (root?.getBoundingClientRect().top ?? 999) < 380;
        open = !open;
      }}
    >
      <EdgeMarkerPreview {fromMarker} {toMarker} {lineStyle} width={48} height={14} />
      <span class="relname">{current?.name ?? 'Relation'}</span>
      <Icon name="chevronDown" size={12} />
    </button>
    {#if open}
      <div class="pop" class:down role="listbox" aria-label="Relation">
        {#each LIBRARIES as lib (lib.id)}
          {@const list = RELATIONS.filter((r) => r.library === lib.id)}
          {#if list.length}
            <div class="grp">{lib.name}</div>
            {#each list as r (r.id)}
              <button type="button" class="opt" class:sel={r.id === relation} role="option" aria-selected={r.id === relation} title={r.description} onclick={() => pick(r)}>
                <EdgeMarkerPreview fromMarker={r.fromMarker} toMarker={r.toMarker} lineStyle={r.lineStyle} width={64} height={16} />
                <span class="oname">{r.name}</span>
              </button>
            {/each}
          {/if}
        {/each}
        {#if relation}
          <div class="grp">Other</div>
          <button type="button" class="opt" role="option" aria-selected="false" onclick={() => pick(undefined)}>
            <span class="none"></span><span class="oname">No relation</span>
          </button>
        {/if}
      </div>
    {/if}
  </div>
  <span class="sep"></span>
  <div class="seg" role="group" aria-label="Routing">
    <ToolbarButton icon="routeCurved" label="Curved" active={routing === 'bezier'} onclick={() => onrouting?.('bezier')} />
    <ToolbarButton icon="routeElbow" label="Right angles" active={routing === 'orthogonal'} onclick={() => onrouting?.('orthogonal')} />
    <ToolbarButton icon="routeStraight" label="Straight" active={routing === 'straight'} onclick={() => onrouting?.('straight')} />
  </div>
  <span class="sep"></span>
  <div class="seg" role="group" aria-label="Line style">
    <ToolbarButton icon="lineSolid" label="Solid line" active={lineStyle === 'solid'} onclick={() => onlinestyle?.('solid')} />
    <ToolbarButton icon="lineDashed" label="Dashed line" active={lineStyle === 'dashed'} onclick={() => onlinestyle?.('dashed')} />
    <ToolbarButton icon="lineDotted" label="Dotted line" active={lineStyle === 'dotted'} onclick={() => onlinestyle?.('dotted')} />
  </div>
  {#if showEnds}
    <span class="sep"></span>
    <div class="seg" role="group" aria-label="Arrowheads">
      <ToolbarButton icon="arrowNone" label="No arrowheads" active={ends === 'none'} onclick={() => onends?.('none')} />
      <ToolbarButton icon="arrowEnd" label="Arrowhead at end" active={ends === 'end'} onclick={() => onends?.('end')} />
      <ToolbarButton icon="arrowBoth" label="Arrowheads at both ends" active={ends === 'both'} onclick={() => onends?.('both')} />
    </div>
  {/if}
  <span class="sep"></span>
  <ToolbarButton icon="zap" label={animated ? 'Stop animating' : 'Animate'} active={animated} onclick={() => onanimated?.(!animated)} />
  <ToolbarButton icon="text" label="Edit label" onclick={oneditlabel} />
  <span class="sep"></span>
  <ToolbarButton icon="trash" label="Delete" shortcut="⌫" danger onclick={ondelete} />
</div>

<style>
  .bar {
    position: relative;
    display: inline-flex;
    align-items: center;
    padding: 4px;
    box-sizing: border-box;
    background: var(--vscode-editorWidget-background, #252526);
    border: 1px solid var(--vscode-editorWidget-border, var(--vscode-widget-border, #454545));
    border-radius: 6px;
    box-shadow: var(--cv-shadow-float, 0 4px 16px rgb(0 0 0 / 0.28));
    color: var(--vscode-editor-foreground, #ccc);
    font-family: var(--vscode-font-family, system-ui, sans-serif);
    white-space: nowrap;
  }
  .seg {
    display: inline-flex;
    gap: 0;
  }
  .sep {
    width: 1px;
    height: 16px;
    margin: 0 4px;
    background: var(--vscode-editorWidget-border, var(--vscode-widget-border, #454545));
  }
  .rel {
    position: relative;
  }
  .relbtn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 24px;
    padding: 0 6px;
    border: 0;
    border-radius: 4px;
    background: transparent;
    color: inherit;
    font: inherit;
    font-size: 12px;
    cursor: pointer;
  }
  .relbtn:hover,
  .relbtn.on {
    background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
  }
  .relbtn:focus-visible,
  .opt:focus-visible {
    outline: 1px solid var(--vscode-focusBorder, #007fd4);
    outline-offset: -1px;
  }
  .relname {
    max-width: 96px;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  /* Opens upwards so the edge being edited stays visible. */
  .pop {
    position: absolute;
    left: 0;
    bottom: calc(100% + 8px);
    z-index: 10;
    display: flex;
    flex-direction: column;
    width: 232px;
    max-height: 336px;
    overflow-y: auto;
    box-sizing: border-box;
    padding: 4px;
    background: var(--vscode-editorWidget-background, #252526);
    border: 1px solid var(--vscode-editorWidget-border, var(--vscode-widget-border, #454545));
    border-radius: 6px;
    box-shadow: var(--cv-shadow-float, 0 4px 16px rgb(0 0 0 / 0.28));
  }
  .pop.down {
    bottom: auto;
    top: calc(100% + 8px);
  }
  .grp {
    padding: 6px 8px 2px;
    color: var(--vscode-descriptionForeground, #9d9d9d);
    font-size: 11px;
  }
  .opt {
    display: flex;
    align-items: center;
    gap: 10px;
    height: 28px;
    padding: 0 8px;
    border: 0;
    border-radius: 4px;
    background: transparent;
    color: inherit;
    font: inherit;
    font-size: 12px;
    text-align: left;
    cursor: pointer;
  }
  .opt:hover {
    background: var(--vscode-list-hoverBackground, rgba(90, 93, 94, 0.31));
  }
  .opt.sel {
    background: var(--vscode-list-activeSelectionBackground, rgba(0, 120, 212, 0.3));
    color: var(--vscode-list-activeSelectionForeground, inherit);
  }
  .none {
    width: 64px;
    flex: none;
  }
</style>
