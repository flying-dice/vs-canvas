<script lang="ts">
  import type { ResolvedCode } from '../../../../src/shared/protocol';
  import type { Lod } from '../../lib/lod';
  import { diffLines, diffStats, foldRows, type DiffRow } from '../../lib/diff';
  import Icon from '../atoms/Icon.svelte';
  import type { Token } from '../atoms/CodeText.svelte';
  import FarSummary from '../molecules/FarSummary.svelte';

  const ADDED = 'var(--vscode-gitDecoration-addedResourceForeground, #81b88b)';
  const REMOVED = 'var(--vscode-gitDecoration-deletedResourceForeground, #c74e39)';

  let {
    leftPath,
    rightPath,
    title,
    left,
    right,
    leftTokens = null,
    rightTokens = null,
    selected = false,
    lod = 'near',
    context = 3,
    onlineclick,
  }: {
    /** Workspace-relative paths (`diffFrom` / `file`). */
    leftPath: string;
    rightPath: string;
    title?: string;
    /** Whole left (before) / right (after) files. */
    left: ResolvedCode;
    right: ResolvedCode;
    /** Per-line tokens (index = line - 1); null while loading. */
    leftTokens?: Token[][] | null;
    rightTokens?: Token[][] | null;
    selected?: boolean;
    /** `far`: header and big +N / -M only. `mid` and `near` show the folded diff. */
    lod?: Lod;
    /** Unchanged lines kept around each change. */
    context?: number;
    onlineclick?: (side: 'left' | 'right', line: number) => void;
  } = $props();

  const base = (p: string) => p.split('/').pop() ?? p;
  const heading = $derived(title ?? `${base(leftPath)} → ${base(rightPath)}`);
  const errors = $derived(
    [left.error && { path: leftPath, message: left.error }, right.error && { path: rightPath, message: right.error }].filter(
      (e): e is { path: string; message: string } => !!e,
    ),
  );

  const rows = $derived<DiffRow[]>(errors.length ? [] : diffLines(left.lines, right.lines));
  const stats = $derived(diffStats(rows));
  const identical = $derived(!errors.length && stats.added === 0 && stats.removed === 0);
  const folded = $derived(foldRows(rows, context));

  let expanded = $state<Record<string, boolean>>({});
  const rowsOf = (id: string, count: number) => {
    const start = Number(id.slice(1));
    return rows.slice(start, start + count);
  };

  const truncated = $derived(!!(left.truncated || right.truncated));

  function tokensFor(r: DiffRow): Token[] | null {
    if (r.kind === 'del') return leftTokens?.[(r.left ?? 1) - left.firstLine] ?? null;
    return rightTokens?.[(r.right ?? 1) - right.firstLine] ?? null;
  }
  const marker = (k: DiffRow['kind']) => (k === 'add' ? '+' : k === 'del' ? '−' : '');

  const farChips = $derived(
    errors.length
      ? [{ label: 'unreadable', color: REMOVED }]
      : identical
        ? [{ label: 'identical' }]
        : [
            ...(stats.added ? [{ label: `+${stats.added}`, color: ADDED }] : []),
            ...(stats.removed ? [{ label: `−${stats.removed}`, color: REMOVED }] : []),
          ],
  );
</script>

{#snippet line(r: DiffRow)}
  {@const t = tokensFor(r)}
  <div class={['row', r.kind]}>
    <button type="button" class="ln" tabindex="-1" disabled={r.left === undefined} title={r.left !== undefined ? `Open ${leftPath}:${r.left}` : undefined} onclick={() => r.left !== undefined && onlineclick?.('left', r.left)}>{r.left ?? ''}</button>
    <button type="button" class="ln" tabindex="-1" disabled={r.right === undefined} title={r.right !== undefined ? `Open ${rightPath}:${r.right}` : undefined} onclick={() => r.right !== undefined && onlineclick?.('right', r.right)}>{r.right ?? ''}</button>
    <span class="mark" aria-hidden="true">{marker(r.kind)}</span>
    <span class="txt">{#if t}{#each t as tk, i (i)}<span style={tk.color ? `color:${tk.color}` : ''}>{tk.content}</span>{/each}{:else}{r.text}{/if}</span>
  </div>
{/snippet}

<div class="card" class:selected class:far={lod === 'far'}>
  <div class="head node-drag-handle">
    <span class="glyph"><Icon name="diff" /></span>
    <span class="title" title={`${leftPath} → ${rightPath}`}>{heading}</span>
    {#if !errors.length}
      <span class="stat" aria-label={`${stats.added} added, ${stats.removed} removed`}>
        <span class="add">+{stats.added}</span>
        <span class="del">−{stats.removed}</span>
      </span>
    {/if}
  </div>
  {#if errors.length}
    <div class="error" role="alert">
      <Icon name="warning" size={16} />
      <div>
        {#each errors as e (e.path)}<div><b>{e.path}</b>: {e.message}</div>{/each}
      </div>
    </div>
  {:else}
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <div class="body nodrag nowheel nopan" tabindex="0" role="group" aria-label={`Diff ${leftPath} to ${rightPath}`}>
      {#if identical}<div class="note">Files are identical</div>{/if}
      {#each folded as r, i (r.kind === 'fold' ? r.id : `${i}`)}
        {#if r.kind === 'fold'}
          {#if expanded[r.id]}
            {#each rowsOf(r.id, r.count) as x, j (j)}{@render line(x)}{/each}
          {:else}
            <button type="button" class="fold" onclick={() => (expanded[r.id] = true)}>
              <span class="dots" aria-hidden="true">⋯</span>{r.count} unchanged {r.count === 1 ? 'line' : 'lines'}
            </button>
          {/if}
        {:else}
          {@render line(r)}
        {/if}
      {/each}
      {#if truncated}<div class="note">File truncated</div>{/if}
    </div>
  {/if}
  <FarSummary active={lod === 'far'} title={heading} subtitle={`${leftPath} → ${rightPath}`} icon="diff" chips={farChips} />
</div>

<style>
  .card {
    position: relative;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: var(--vscode-editor-background, #1e1e1e);
    color: var(--vscode-editor-foreground, #d4d4d4);
    border: 1px solid var(--vscode-editorWidget-border, var(--vscode-panel-border, #454545));
    border-radius: 6px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }
  .card.selected {
    border-color: var(--vscode-focusBorder, #007fd4);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--vscode-focusBorder, #007fd4) 35%, transparent);
  }
  .card > :not(:global(.far)) {
    transition: opacity 180ms ease;
  }
  .card.far > :not(:global(.far)) {
    opacity: 0;
    pointer-events: none;
  }
  @media (prefers-reduced-motion: reduce) {
    .card > :not(:global(.far)) {
      transition: none;
    }
  }
  .head {
    display: flex;
    flex: none;
    align-items: center;
    gap: 8px;
    height: 31px;
    box-sizing: border-box;
    padding: 0 12px;
    background: var(--vscode-editorWidget-background, #252526);
    border-bottom: 1px solid var(--vscode-panel-border, var(--vscode-editorWidget-border, #454545));
    font-family: var(--vscode-font-family, system-ui, sans-serif);
    font-size: 12px;
    cursor: grab;
  }
  .glyph {
    display: grid;
    color: var(--vscode-descriptionForeground, #9d9d9d);
  }
  .title {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 600;
  }
  .stat {
    display: flex;
    flex: none;
    gap: 6px;
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: 11px;
    font-weight: 600;
  }
  .add {
    color: var(--vscode-gitDecoration-addedResourceForeground, #81b88b);
  }
  .del {
    color: var(--vscode-gitDecoration-deletedResourceForeground, #c74e39);
  }
  .body {
    flex: 1;
    min-height: 0;
    padding: 4px 0;
    overflow: auto;
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: var(--vscode-editor-font-size, 13px);
    line-height: 18px;
    user-select: text;
    cursor: text;
    outline: none;
  }
  .body:focus-visible {
    outline: 1px solid var(--vscode-focusBorder, #007fd4);
    outline-offset: -1px;
  }
  .row {
    display: flex;
    min-width: max-content;
    height: 18px;
  }
  .row.add {
    background: var(--vscode-diffEditor-insertedLineBackground, rgba(155, 185, 85, 0.2));
  }
  .row.del {
    background: var(--vscode-diffEditor-removedLineBackground, rgba(255, 0, 0, 0.2));
  }
  .ln {
    flex: none;
    width: 36px;
    padding: 0 8px 0 0;
    box-sizing: border-box;
    border: 0;
    background: none;
    font: inherit;
    text-align: right;
    color: var(--vscode-editorLineNumber-foreground, #858585);
    user-select: none;
    cursor: pointer;
  }
  .ln:disabled {
    cursor: default;
  }
  .ln:not(:disabled):hover {
    color: var(--vscode-editorLineNumber-activeForeground, #c6c6c6);
    text-decoration: underline;
  }
  .mark {
    flex: none;
    width: 16px;
    text-align: center;
    user-select: none;
    font-weight: 700;
  }
  .add .mark {
    color: var(--vscode-gitDecoration-addedResourceForeground, #81b88b);
  }
  .del .mark {
    color: var(--vscode-gitDecoration-deletedResourceForeground, #c74e39);
  }
  .txt {
    padding-right: 12px;
    white-space: pre;
  }
  .fold {
    display: flex;
    align-items: center;
    gap: 8px;
    box-sizing: border-box;
    width: 100%;
    min-width: max-content;
    height: 18px;
    padding: 0 12px;
    border: 0;
    background: color-mix(in srgb, var(--vscode-editorWidget-background, #252526) 70%, transparent);
    color: var(--vscode-descriptionForeground, #9d9d9d);
    font-family: var(--vscode-font-family, system-ui, sans-serif);
    font-size: 11px;
    text-align: left;
    cursor: pointer;
  }
  .fold:hover {
    color: var(--vscode-editor-foreground, #d4d4d4);
    background: var(--vscode-list-hoverBackground, #2a2d2e);
  }
  .fold:focus-visible {
    outline: 1px solid var(--vscode-focusBorder, #007fd4);
    outline-offset: -1px;
  }
  .note {
    padding: 2px 12px;
    color: var(--vscode-descriptionForeground, #9d9d9d);
    font-family: var(--vscode-font-family, system-ui, sans-serif);
    font-size: 11px;
    white-space: normal;
  }
  .error {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 12px;
    color: var(--vscode-errorForeground, #f48771);
    font-family: var(--vscode-font-family, system-ui, sans-serif);
    font-size: 12px;
    user-select: text;
  }
</style>
