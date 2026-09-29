<script lang="ts">
  import { shapeById } from '../../../../src/shared/shapes';
  import { geometryFor } from '../../lib/shapes/renderers';
  import { toneStyle } from '../../lib/shapes/tone';
  import { bracketed, c4TypeLine, compartmentsOf, isTrue, linesOf, parseColumn, splitText, textOf, type Fields } from '../../lib/shapes/content';
  import type { Lod } from '../../lib/lod';
  import Icon from '../atoms/Icon.svelte';
  import ShapeFigure from '../molecules/ShapeFigure.svelte';

  // A diagram shape node: the silhouette from lib/shapes/renderers plus a label laid out by the shape's `layout`
  // (centre, top, UML compartments, ERD table, below). Double-click edits the label; double-click a compartment or
  // the column list edits that list (one entry per line). Semantic zoom: `far` shows the name only, large.
  let {
    shape,
    text = '',
    fields,
    color,
    selected = false,
    width,
    height,
    lod = 'near',
    editing = $bindable<string | null>(null),
    oncommit,
    onfields,
  }: {
    /** Shape id, e.g. "c4.container". */
    shape: string;
    /** The label. For 'top' shapes the first line is the name and the rest the description. */
    text?: string;
    fields?: Fields;
    color?: string;
    selected?: boolean;
    width: number;
    height: number;
    lod?: Lod;
    /** What is being edited: 'text', 'field:<key>' (a list) or 'text:<key>' (a one-line field); null = nothing. */
    editing?: string | null;
    oncommit?: (text: string) => void;
    /** The full fields object after an edit. */
    onfields?: (fields: Record<string, string | string[]>) => void;
  } = $props();

  const def = $derived(shapeById(shape));
  const geo = $derived(geometryFor(shape, width, height));
  const tone = $derived(def?.tone ?? 'default');
  const box = $derived(geo.textBox);
  const hasBox = $derived(box.w >= 8 && box.h >= 8);

  type Mode = 'plain' | 'titled' | 'compartments' | 'table';
  const mode = $derived.by<Mode>(() => {
    if (!def) return 'plain';
    if (def.layout === 'table') return 'table';
    if (def.layout === 'compartments') return 'compartments';
    if (def.id === 'uml.note') return 'plain';
    if (def.library === 'c4') return 'titled';
    if (def.layout === 'top') return 'titled';
    if (def.fields?.some((f) => f.key === 'technology')) return 'titled';
    return 'plain';
  });
  const centered = $derived(def?.library === 'c4' || (def ? def.layout !== 'top' : true) || mode === 'plain');
  const vcenter = $derived(def?.library === 'c4' || def?.layout === 'center' || def?.layout === 'below');
  const alignLeft = $derived(def?.id === 'uml.note');

  const parts = $derived(splitText(text));
  const name = $derived(mode === 'plain' ? text.trim() : parts.name);
  const tech = $derived(textOf(fields?.technology));
  const typeLine = $derived(def?.library === 'c4' ? c4TypeLine(shape, tech) : tech ? tech : '');
  const hasTech = $derived(def?.fields?.some((f) => f.key === 'technology') || def?.library === 'c4');

  const LH = 18;
  const nameLines = $derived(Math.min(2, Math.max(1, Math.ceil((name.length * 7.6) / Math.max(24, box.w)))));
  const descLines = $derived(Math.max(0, Math.floor((box.h - nameLines * LH - (typeLine ? 16 : 0) - 6) / 16)));
  const plainLines = $derived(Math.max(1, Math.floor(box.h / LH)));

  // ---- editing ----
  let draft = $state('');
  let area = $state<HTMLTextAreaElement | HTMLInputElement>();
  let finished = false;

  function valueFor(key: string): string {
    if (key === 'text') return text;
    if (key.startsWith('field:')) return linesOf(fields?.[key.slice(6)]).join('\n');
    if (key.startsWith('text:')) return textOf(fields?.[key.slice(5)]);
    return '';
  }
  $effect(() => {
    if (editing) {
      finished = false;
      draft = valueFor(editing);
      queueMicrotask(() => {
        area?.focus();
        if (editing === 'text') area?.select();
        else area?.setSelectionRange(area.value.length, area.value.length);
      });
    }
  });

  function commit() {
    if (finished || !editing) return;
    finished = true;
    const key = editing;
    editing = null;
    if (key === 'text') {
      const v = draft.replace(/\s+$/, '');
      if (v !== text) oncommit?.(v);
    } else if (key.startsWith('field:')) {
      const k = key.slice(6);
      const next = draft.split('\n').map((l) => l.replace(/\s+$/, '')).filter((l) => l.trim() !== '');
      if (next.join('\n') !== linesOf(fields?.[k]).join('\n')) onfields?.({ ...fields, [k]: next });
    } else if (key.startsWith('text:')) {
      const k = key.slice(5);
      const v = draft.trim();
      if (v !== textOf(fields?.[k])) onfields?.({ ...fields, [k]: v });
    }
  }
  function cancel() {
    finished = true;
    editing = null;
  }
  function onkeydown(e: KeyboardEvent, single = false) {
    e.stopPropagation(); // never reach the canvas shortcuts (Backspace would delete the node)
    if (e.key === 'Escape') {
      e.preventDefault();
      cancel();
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey || (single && !e.shiftKey))) {
      e.preventDefault();
      commit();
    }
  }
  /** Double-click starts editing `key` (an action, so the static divs stay free of interaction handlers). */
  function dbl(node: HTMLElement, key: string) {
    let k = key;
    const h = (e: MouseEvent) => {
      e.stopPropagation();
      editing = k;
    };
    node.addEventListener('dblclick', h);
    return {
      update(next: string) {
        k = next;
      },
      destroy() {
        node.removeEventListener('dblclick', h);
      },
    };
  }

  // ---- ERD / UML content ----
  const columns = $derived(linesOf(fields?.columns).map(parseColumn));
  const comp = $derived(def ? compartmentsOf(def, fields) : undefined);
  const abstract = $derived(isTrue(fields?.abstract) || /^abstract$/i.test(textOf(fields?.stereotype)));
  const stereotype = $derived(comp?.stereotype && !/^abstract$/i.test(comp.stereotype) ? comp.stereotype : undefined);
  const isObject = $derived(def?.id === 'uml.object');
  const style = $derived(`${toneStyle(tone, color)}--r:${geo.radius ?? 0}px;--ln:${plainLines};--dl:${descLines};--nl:${nameLines};`);
  const far = $derived(lod === 'far');
  const farName = $derived(mode === 'plain' ? text.trim() : parts.name || text.trim());
</script>

{#snippet editor(single = false, rows = 3)}
  <textarea
    bind:this={area}
    bind:value={draft}
    class="edit nodrag nowheel nopan"
    {rows}
    spellcheck="false"
    onkeydown={(e) => onkeydown(e, single)}
    onkeyup={(e) => e.stopPropagation()}
    onblur={commit}
  ></textarea>
{/snippet}

<div
  class="shape"
  class:selected
  style={style}
  style:width={`${width}px`}
  style:height={`${height}px`}
  data-shape={shape}
  role="group"
  aria-label={`${def?.name ?? 'Shape'}: ${farName}`}
>
  <ShapeFigure {geo} {width} {height} {selected} />

  {#if hasBox}
    <div
      class={['box', mode, centered && 'center', vcenter && 'vcenter', alignLeft && 'left', geo.labelOutside && 'outside']}
      style:left={`${box.x}px`}
      style:top={`${box.y}px`}
      style:width={`${box.w}px`}
      style:height={`${box.h}px`}
    >
      {#if far}
        <div class="far"><span>{farName || def?.name}</span></div>
      {:else if mode === 'plain'}
        {#if editing === 'text'}
          {@render editor(true, 2)}
        {:else}
          <div class="plain" use:dbl={'text'}>
            <span class="lbl" class:ph={!text.trim()}>{text.trim() || (selected ? 'Double-click to edit' : '')}</span>
          </div>
        {/if}
      {:else if mode === 'titled'}
        {#if editing === 'text'}
          {@render editor(false, 3)}
        {:else}
          <div class="titled">
            <div class="name" use:dbl={'text'}>{parts.name || (selected ? 'Name' : '')}</div>
            {#if editing === 'text:technology'}
              <input
                bind:this={area}
                bind:value={draft}
                class="edit line nodrag nowheel nopan"
                spellcheck="false"
                placeholder="Technology"
                onkeydown={(e) => onkeydown(e, true)}
                onkeyup={(e) => e.stopPropagation()}
                onblur={commit}
              />
            {:else if typeLine || (hasTech && selected)}
              <div class="type" use:dbl={'text:technology'} title={hasTech ? 'Double-click to edit technology' : undefined}>
                {typeLine || 'Technology'}
              </div>
            {/if}
            {#if parts.description && descLines > 0}
              <div class="desc" use:dbl={'text'}>{parts.description}</div>
            {/if}
          </div>
        {/if}
      {:else if mode === 'compartments' && comp}
        <div class="uml">
          {#if editing === 'text'}
            <div class="head">{@render editor(true, 1)}</div>
          {:else}
            <div class="head" use:dbl={'text'}>
              {#if stereotype}<div class="st">«{stereotype}»</div>{/if}
              <div class="nm" class:abstract class:und={isObject}>{text.trim() || (selected ? 'Name' : '')}</div>
            </div>
          {/if}
          {#each comp.lists as l (l.key)}
            {@const items = linesOf(fields?.[l.key])}
            {#if items.length || editing === `field:${l.key}` || comp.divideEmpty || selected}
              <div class="list" class:grow={comp.divideEmpty} use:dbl={`field:${l.key}`} title={`Double-click to edit ${l.label.toLowerCase()}`}>
                {#if editing === `field:${l.key}`}
                  {@render editor(false, 3)}
                {:else}
                  {#each items as it, i (i)}<div class="member">{it}</div>{/each}
                  {#if !items.length && selected}<div class="hint">Double-click to add {l.label.toLowerCase()}</div>{/if}
                {/if}
              </div>
            {/if}
          {/each}
        </div>
      {:else if mode === 'table'}
        <div class="table">
          {#if editing === 'text'}
            <div class="thead">{@render editor(true, 1)}</div>
          {:else}
            <div class="thead" use:dbl={'text'}>{text.trim() || (selected ? 'Entity' : '')}</div>
          {/if}
          <div class="tbody" use:dbl={'field:columns'} title="Double-click to edit columns">
            {#if editing === 'field:columns'}
              {@render editor(false, 4)}
            {:else}
              {#each columns as c, i (i)}
                <div class="tr">
                  <span class="keys">
                    {#if c.pk}<span class="badge pk"><Icon name="key" size={10} />PK</span>{/if}
                    {#if c.fk}<span class="badge">FK</span>{/if}
                    {#if c.unique && !c.pk}<span class="badge">UQ</span>{/if}
                  </span>
                  <span class="cn" class:pkname={c.pk}>{c.name}</span>
                  <span class="ct">{c.type}</span>
                </div>
              {/each}
              {#if !columns.length && selected}<div class="hint">Double-click to add columns</div>{/if}
            {/if}
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .shape {
    position: relative;
    box-sizing: border-box;
    color: var(--vscode-editor-foreground, #cccccc);
    font-family: var(--vscode-font-family, system-ui, sans-serif);
    font-size: 13px;
    line-height: 18px;
  }
  .box {
    position: absolute;
    box-sizing: border-box;
    container-type: size;
    overflow: hidden;
  }
  .box.uml,
  .box.table {
    border-radius: var(--r, 0);
  }
  .box.outside {
    font-size: 12px;
    text-align: center;
    overflow: visible;
  }

  /* centre / plain label */
  .plain {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    text-align: center;
  }
  .left .plain {
    align-items: flex-start;
    justify-content: flex-start;
    text-align: left;
  }
  .outside .plain {
    align-items: flex-start;
  }
  .lbl {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: var(--ln, 2);
    line-clamp: var(--ln, 2);
    max-width: 100%;
    overflow: hidden;
    overflow-wrap: anywhere;
    white-space: pre-wrap;
  }
  .ph {
    color: var(--vscode-input-placeholderForeground, var(--vscode-descriptionForeground, #9d9d9d));
    font-style: italic;
  }

  /* far: the name only, big (semantic zoom; --cv-far-scale is set on the canvas wrapper) */
  .far {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    text-align: center;
    font-weight: 600;
    line-height: 1.15;
    font-size: max(13px, min(calc(20px * var(--cv-far-scale, 1)), 30cqh));
  }
  .far span {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    max-width: 100%;
    overflow: hidden;
    overflow-wrap: anywhere;
  }

  /* titled: name, type / technology line, description */
  .titled {
    display: flex;
    flex-direction: column;
    gap: 0;
    width: 100%;
    height: 100%;
    min-width: 0;
  }
  .vcenter .titled {
    justify-content: center;
  }
  .center .titled {
    text-align: center;
    align-items: center;
  }
  .name {
    max-width: 100%;
    font-weight: 600;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    overflow: hidden;
    overflow-wrap: anywhere;
    flex: none;
  }
  .type {
    flex: none;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--vscode-descriptionForeground, #9d9d9d);
    font-size: 11px;
    line-height: 16px;
  }
  .desc {
    flex: none;
    max-width: 100%;
    margin-top: 4px;
    font-size: 12px;
    line-height: 16px;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: var(--dl, 2);
    line-clamp: var(--dl, 2);
    overflow: hidden;
    overflow-wrap: anywhere;
    white-space: pre-wrap;
  }

  /* UML compartments */
  .uml {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
  }
  .head {
    flex: none;
    position: relative;
    padding: 6px 8px;
    text-align: center;
    min-width: 0;
  }
  .st {
    color: var(--vscode-descriptionForeground, #9d9d9d);
    font-size: 11px;
    line-height: 14px;
  }
  .nm {
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .nm.abstract {
    font-style: italic;
  }
  .nm.und {
    text-decoration: underline;
  }
  .list {
    position: relative;
    flex: none;
    min-height: 24px;
    padding: 4px 8px;
    box-sizing: border-box;
    border-top: 1px solid var(--sc-stroke);
    overflow: hidden;
    font-family: var(--vscode-editor-font-family, Menlo, Monaco, monospace);
    font-size: 12px;
  }
  .list.grow {
    flex: 1 1 0;
    min-height: 24px;
  }
  .member {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: pre;
  }
  .hint {
    color: var(--vscode-input-placeholderForeground, var(--vscode-descriptionForeground, #9d9d9d));
    font-family: var(--vscode-font-family, system-ui, sans-serif);
    font-size: 11px;
    font-style: italic;
  }

  /* ERD table */
  .table {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
  }
  .thead {
    position: relative;
    flex: none;
    height: 28px;
    box-sizing: border-box;
    padding: 0 10px;
    line-height: 28px;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    background: color-mix(in srgb, var(--vscode-editor-foreground, #ccc) 7%, transparent);
    border-bottom: 1px solid var(--sc-stroke);
  }
  .tbody {
    position: relative;
    flex: 1 1 0;
    min-height: 0;
    padding: 4px 0;
    overflow: hidden;
    font-family: var(--vscode-editor-font-family, Menlo, Monaco, monospace);
    font-size: 12px;
  }
  .tr {
    display: grid;
    grid-template-columns: 52px minmax(0, 1fr) auto;
    align-items: center;
    height: 20px;
    padding-right: 10px;
  }
  .keys {
    display: inline-flex;
    gap: 2px;
    padding-left: 8px;
  }
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    height: 14px;
    padding: 0 3px;
    box-sizing: border-box;
    border: 1px solid var(--vscode-descriptionForeground, #9d9d9d);
    border-radius: 3px;
    color: var(--vscode-descriptionForeground, #9d9d9d);
    font-family: var(--vscode-font-family, system-ui, sans-serif);
    font-size: 9px;
    font-weight: 600;
    line-height: 12px;
    letter-spacing: 0.02em;
  }
  .badge.pk {
    color: var(--vscode-editor-foreground, #ccc);
    border-color: var(--vscode-editor-foreground, #ccc);
  }
  .cn {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .cn.pkname {
    font-weight: 600;
  }
  .ct {
    padding-left: 12px;
    color: var(--vscode-descriptionForeground, #9d9d9d);
    white-space: nowrap;
  }

  /* inline editors */
  .edit {
    display: block;
    box-sizing: border-box;
    width: 100%;
    min-height: 24px;
    margin: 0;
    padding: 3px 6px;
    resize: none;
    border: 1px solid var(--vscode-focusBorder, #007fd4);
    border-radius: 4px;
    outline: none;
    background: var(--vscode-input-background, #3c3c3c);
    color: var(--vscode-input-foreground, #ccc);
    font-family: inherit;
    font-size: 12px;
    line-height: 18px;
    user-select: text;
    cursor: text;
  }
  .box.plain > .edit,
  .box.titled > .edit {
    height: 100%;
  }
  .list > .edit,
  .tbody > .edit {
    height: 100%;
    min-height: 56px;
    font-family: var(--vscode-editor-font-family, Menlo, Monaco, monospace);
    white-space: pre;
  }
  .edit.line {
    height: 22px;
    min-height: 0;
    font-size: 11px;
    line-height: 16px;
    padding: 0 4px;
  }
</style>
