<script module lang="ts">
  import type { ResolvedCode } from '../../../../src/shared/protocol';
  import type { Token } from '../atoms/CodeText.svelte';

  /** Resolved snippet of one entry point (parallel to `entryPoints`). */
  export type EntrySnippet = { code: ResolvedCode; tokens?: Token[][] | null };

  /** Markdown to one plain line of text, for the 2-line summary. */
  export function plainText(md: string): string {
    return md
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/[#>*_`~-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
</script>

<script lang="ts">
  import type { EntryPoint } from '../../../../src/shared/canvasFile';
  import { canvasColor } from '../../lib/colors';
  import type { Lod } from '../../lib/lod';
  import Icon from '../atoms/Icon.svelte';
  import CodeLine from '../molecules/CodeLine.svelte';

  let {
    title,
    description = '',
    tags = [],
    entryPoints = [],
    snippets = [],
    canvas,
    color,
    lod = 'mid',
    selected = false,
    onentryclick,
    onopencanvas,
  }: {
    title: string;
    /** Markdown description. */
    description?: string;
    tags?: string[];
    entryPoints?: EntryPoint[];
    /** Code for each entry point (same index), shown at `near`. */
    snippets?: (EntrySnippet | undefined)[];
    /** Drill-down canvas path; enables "Open canvas". */
    canvas?: string;
    /** Domain colour (default purple). */
    color?: string;
    lod?: Lod;
    selected?: boolean;
    onentryclick?: (file: string, line?: number) => void;
    onopencanvas?: () => void;
  } = $props();

  const accent = $derived(canvasColor(color ?? '6'));
  const summary = $derived(plainText(description));
  const MAX_MID = 4;
  const range = (ep: EntryPoint) => (ep.lines ? (ep.lines[0] === ep.lines[1] ? `:${ep.lines[0]}` : `:${ep.lines[0]}–${ep.lines[1]}`) : '');
  const base = (f: string) => f.split('/').pop() ?? f;
</script>

<div class="card lod-{lod}" class:selected style={`--accent: ${accent}`}>
  <div class="band"></div>

  <!-- far: title, colour, tag count. Large type so it reads at 0.25 zoom. -->
  <div class="layer far" class:on={lod === 'far'} aria-hidden={lod !== 'far'}>
    <div class="far-title">{title}</div>
    <div class="far-meta">
      <span class="far-glyph"><Icon name="tag" size={28} /></span>
      <span class="far-count">{tags.length}</span>
    </div>
  </div>

  <!-- mid: summary -->
  <div class="layer mid" class:on={lod === 'mid'} aria-hidden={lod !== 'mid'}>
    <div class="row-head">
      <span class="glyph"><Icon name="service" /></span>
      <span class="title">{title}</span>
      {#if canvas}<span class="glyph portal" title="Has a drill-down canvas"><Icon name="portal" size={14} /></span>{/if}
    </div>
    {#if summary}<p class="desc">{summary}</p>{/if}
    {#if tags.length}
      <div class="tags">
        {#each tags.slice(0, 6) as t (t)}<span class="tag">{t}</span>{/each}
        {#if tags.length > 6}<span class="tag more">+{tags.length - 6}</span>{/if}
      </div>
    {/if}
    {#if entryPoints.length}
      <ul class="entries">
        {#each entryPoints.slice(0, MAX_MID) as ep, i (i)}
          <li>
            <button type="button" class="entry nodrag" disabled={lod !== 'mid'} tabindex={lod === 'mid' ? 0 : -1} onclick={() => onentryclick?.(ep.file, ep.lines?.[0])} title={`${ep.file}${range(ep)}`}>
              <span class="e-label">{ep.label}</span>
              <span class="e-file">{base(ep.file)}{range(ep)}</span>
            </button>
          </li>
        {/each}
        {#if entryPoints.length > MAX_MID}<li class="more-entries">+{entryPoints.length - MAX_MID} more</li>{/if}
      </ul>
    {/if}
  </div>

  <!-- near: entry points with code -->
  <div class="layer near" class:on={lod === 'near'} aria-hidden={lod !== 'near'}>
    <div class="row-head">
      <span class="glyph"><Icon name="service" /></span>
      <span class="title">{title}</span>
      {#if canvas}
        <button type="button" class="open nodrag" disabled={lod !== 'near'} tabindex={lod === 'near' ? 0 : -1} onclick={onopencanvas}>
          <Icon name="portal" size={14} /><span>Open canvas</span>
        </button>
      {/if}
    </div>
    {#if lod !== 'far'}
      <div class="scroll nodrag nowheel nopan">
        {#if summary}<p class="desc full">{summary}</p>{/if}
        {#if tags.length}
          <div class="tags">{#each tags as t (t)}<span class="tag">{t}</span>{/each}</div>
        {/if}
        {#each entryPoints as ep, i (i)}
          {@const sn = snippets[i]}
          <section class="entry-block">
            <button type="button" class="entry-head" disabled={lod !== 'near'} tabindex={lod === 'near' ? 0 : -1} onclick={() => onentryclick?.(ep.file, ep.lines?.[0])} title={`Open ${ep.file}`}>
              <span class="e-label">{ep.label}</span>
              <span class="e-file">{ep.file}{range(ep)}</span>
            </button>
            {#if sn && !sn.code.error}
              <div class="code">
                {#each sn.code.lines as text, j (j)}
                  {@const n = sn.code.firstLine + j}
                  <CodeLine {n} {text} tokens={sn.tokens?.[j] ?? null} onlineclick={(ln) => onentryclick?.(ep.file, ln)} />
                {/each}
              </div>
            {:else if sn?.code.error}
              <div class="code-err">{sn.code.error}</div>
            {/if}
          </section>
        {/each}
        {#if !entryPoints.length}<p class="empty">No entry points yet. Ask an agent to add some.</p>{/if}
      </div>
    {/if}
  </div>
</div>

<style>
  .card {
    position: relative;
    box-sizing: border-box;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: var(--vscode-editorWidget-background, #252526);
    color: var(--vscode-editor-foreground, #d4d4d4);
    border: 1px solid var(--vscode-editorWidget-border, var(--vscode-panel-border, #454545));
    border-radius: 6px;
    font-family: var(--vscode-font-family, system-ui, sans-serif);
  }
  .card.selected {
    border-color: var(--vscode-focusBorder, #007fd4);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--vscode-focusBorder, #007fd4) 35%, transparent);
  }
  .band {
    position: absolute;
    left: 0;
    top: 0;
    right: 0;
    height: 4px;
    background: var(--accent);
    transition: height 180ms ease;
    z-index: 1;
  }
  .lod-far .band {
    height: 16px;
  }
  /* Layers share the card's fixed box and crossfade; hidden ones cannot be hit or focused. */
  .layer {
    position: absolute;
    inset: 0;
    box-sizing: border-box;
    padding: 12px 16px 12px;
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
    transition: opacity 180ms ease, visibility 0s linear 180ms;
  }
  .layer.on {
    opacity: 1;
    visibility: visible;
    pointer-events: auto;
    transition: opacity 180ms ease, visibility 0s;
  }
  .layer.mid,
  .layer.near {
    padding-top: 16px;
  }
  .layer.far {
    container-type: size;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 32px 24px 20px;
  }
  .far-title {
    font-size: min(calc(36px * var(--cv-far-scale, 1)), max(36px, 12cqw));
    font-weight: 700;
    line-height: 1.15;
    letter-spacing: -0.01em;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow-wrap: anywhere;
  }
  .far-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--vscode-descriptionForeground, #9d9d9d);
  }
  .far-glyph {
    display: grid;
  }
  .far-count {
    font-size: min(calc(28px * var(--cv-far-scale, 1)), max(28px, 8cqw));
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  .row-head {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 24px;
    cursor: grab;
  }
  .glyph {
    display: grid;
    flex: none;
    color: var(--vscode-descriptionForeground, #9d9d9d);
  }
  .title {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 14px;
    font-weight: 600;
  }
  .desc {
    margin: 8px 0 0;
    color: var(--vscode-descriptionForeground, #9d9d9d);
    font-size: 12px;
    line-height: 16px;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .desc.full {
    display: block;
    margin: 0 0 8px;
    -webkit-line-clamp: unset;
    line-clamp: unset;
  }
  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 8px;
    max-height: 24px;
    overflow: hidden;
  }
  .scroll .tags {
    max-height: none;
    margin: 0 0 8px;
  }
  .tag {
    height: 20px;
    line-height: 18px;
    box-sizing: border-box;
    padding: 0 8px;
    border-radius: 4px;
    border: 1px solid var(--vscode-editorWidget-border, #454545);
    color: var(--vscode-descriptionForeground, #9d9d9d);
    font-size: 11px;
    white-space: nowrap;
  }
  .entries {
    list-style: none;
    margin: 8px 0 0;
    padding: 8px 0 0;
    border-top: 1px solid var(--vscode-editorWidget-border, #454545);
  }
  .entry {
    display: flex;
    align-items: baseline;
    gap: 8px;
    width: 100%;
    height: 24px;
    padding: 0 4px;
    margin: 0 -4px;
    box-sizing: content-box;
    border: 0;
    border-radius: 4px;
    background: transparent;
    color: inherit;
    font: inherit;
    font-size: 12px;
    text-align: left;
    cursor: pointer;
    align-items: center;
  }
  .entry:hover:not(:disabled),
  .entry-head:hover:not(:disabled) {
    background: var(--vscode-list-hoverBackground, rgba(90, 93, 94, 0.31));
  }
  .entry:focus-visible,
  .entry-head:focus-visible,
  .open:focus-visible {
    outline: 1px solid var(--vscode-focusBorder, #007fd4);
  }
  .e-label {
    flex: none;
    max-width: 55%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .e-file {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-align: right;
    color: var(--vscode-textLink-foreground, #3794ff);
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: 11px;
  }
  .more-entries {
    height: 20px;
    color: var(--vscode-descriptionForeground, #9d9d9d);
    font-size: 11px;
  }
  .open {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    height: 24px;
    padding: 0 8px;
    border: 0;
    border-radius: 4px;
    background: var(--vscode-button-secondaryBackground, #3a3d41);
    color: var(--vscode-button-secondaryForeground, #ccc);
    font: inherit;
    font-size: 12px;
    cursor: pointer;
  }
  .open:hover:not(:disabled) {
    background: var(--vscode-button-secondaryHoverBackground, #45494e);
  }
  .scroll {
    position: absolute;
    left: 0;
    right: 0;
    top: 44px;
    bottom: 0;
    padding: 4px 16px 12px;
    overflow-y: auto;
  }
  .entry-block {
    margin-top: 8px;
  }
  .entry-head {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    height: 24px;
    padding: 0 4px;
    box-sizing: border-box;
    border: 0;
    border-radius: 4px;
    background: transparent;
    color: inherit;
    font: inherit;
    font-size: 12px;
    font-weight: 600;
    text-align: left;
    cursor: pointer;
  }
  .code {
    margin-top: 4px;
    padding: 4px 0;
    background: var(--vscode-editor-background, #1e1e1e);
    border: 1px solid var(--vscode-editorWidget-border, #454545);
    border-radius: 4px;
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: var(--vscode-editor-font-size, 12px);
    line-height: 18px;
    white-space: pre;
    overflow: hidden;
    user-select: text;
  }
  .code-err,
  .empty {
    margin: 4px 0 0;
    color: var(--vscode-descriptionForeground, #9d9d9d);
    font-size: 12px;
  }
  @media (prefers-reduced-motion: reduce) {
    .layer,
    .layer.on,
    .band {
      transition: none;
    }
  }
</style>
