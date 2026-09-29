<script module lang="ts">
  import type { FindingKind, FindingStatus } from '../../../../src/shared/canvasFile';
  import type { IconName } from '../atoms/Icon.svelte';

  export const STATUSES: { id: FindingStatus; label: string; icon: IconName }[] = [
    { id: 'open', label: 'Open', icon: 'statusOpen' },
    { id: 'investigating', label: 'Investigating', icon: 'statusInvestigating' },
    { id: 'confirmed', label: 'Confirmed', icon: 'statusConfirmed' },
    { id: 'ruled-out', label: 'Ruled out', icon: 'statusRuledOut' },
  ];
  export const KINDS: Record<FindingKind, { label: string; icon: IconName }> = {
    hypothesis: { label: 'Hypothesis', icon: 'hypothesis' },
    evidence: { label: 'Evidence', icon: 'evidence' },
    question: { label: 'Question', icon: 'question' },
    conclusion: { label: 'Conclusion', icon: 'conclusion' },
  };
</script>

<script lang="ts">
  import { canvasColor, MUTED } from '../../lib/colors';
  import Icon from '../atoms/Icon.svelte';
  import EditableText from '../molecules/EditableText.svelte';
  import MarkdownBody from '../molecules/MarkdownBody.svelte';
  import FarSummary from '../molecules/FarSummary.svelte';
  import type { Lod } from '../../lib/lod';

  let {
    title,
    text = '',
    findingKind = 'hypothesis',
    status = 'open',
    color,
    selected = false,
    mode = 'dark',
    editing = $bindable(false),
    oncommit,
    ontitlecommit,
    onstatuschange,
    lod = 'near',
  }: {
    title?: string;
    text?: string;
    findingKind?: FindingKind;
    status?: FindingStatus;
    /** Only used while the status is `open` (other statuses have their own colour). */
    color?: string;
    selected?: boolean;
    mode?: 'dark' | 'light';
    editing?: boolean;
    oncommit?: (text: string) => void;
    ontitlecommit?: (title: string) => void;
    onstatuschange?: (status: FindingStatus) => void;
    /** Semantic zoom: `far` shows the title and status large. */
    lod?: Lod;
  } = $props();

  const accent = $derived(
    status === 'investigating'
      ? canvasColor('2')!
      : status === 'confirmed'
        ? canvasColor('4')!
        : status === 'ruled-out'
          ? MUTED
          : (canvasColor(color) ?? MUTED),
  );
  const st = $derived(STATUSES.find((s) => s.id === status) ?? STATUSES[0]);
  const kind = $derived(KINDS[findingKind] ?? KINDS.hypothesis);

  let menuOpen = $state(false);
  let menuIdx = $state(0);
  let root = $state<HTMLDivElement>();
  let editingTitle = $state(false);
  let titleDraft = $state('');
  let titleInput = $state<HTMLInputElement>();

  $effect(() => {
    if (!menuOpen) return;
    const down = (e: PointerEvent) => {
      if (root && !root.contains(e.target as Node)) menuOpen = false;
    };
    window.addEventListener('pointerdown', down, true);
    return () => window.removeEventListener('pointerdown', down, true);
  });
  $effect(() => {
    if (editingTitle) titleInput?.focus();
  });

  function openMenu() {
    menuIdx = Math.max(0, STATUSES.findIndex((s) => s.id === status));
    menuOpen = !menuOpen;
  }
  function pick(id: FindingStatus) {
    menuOpen = false;
    if (id !== status) onstatuschange?.(id);
  }
  function menuKey(e: KeyboardEvent) {
    e.stopPropagation();
    if (e.key === 'ArrowDown') (e.preventDefault(), (menuIdx = (menuIdx + 1) % STATUSES.length));
    else if (e.key === 'ArrowUp') (e.preventDefault(), (menuIdx = (menuIdx - 1 + STATUSES.length) % STATUSES.length));
    else if (e.key === 'Enter' || e.key === ' ') (e.preventDefault(), pick(STATUSES[menuIdx].id));
    else if (e.key === 'Escape') (e.preventDefault(), (menuOpen = false));
  }
  function startTitle() {
    titleDraft = title ?? '';
    editingTitle = true;
  }
  function endTitle(commit: boolean) {
    if (!editingTitle) return;
    editingTitle = false;
    if (commit && titleDraft.trim() !== (title ?? '')) ontitlecommit?.(titleDraft.trim());
  }
</script>

<div
  class="card"
  class:selected
  class:ruled={status === 'ruled-out'}
  style={`--accent: ${accent}`}
  bind:this={root}
>
  <div class="head">
    <span class="kind" title={kind.label}><Icon name={kind.icon} /></span>
    <span class="kind-label">{kind.label}</span>
    <div class="chip-wrap nodrag">
      <button
        type="button"
        class="chip"
        aria-haspopup="listbox"
        aria-expanded={menuOpen}
        title="Change status"
        onclick={openMenu}
        onkeydown={(e) => {
          if (e.key === 'ArrowDown' && !menuOpen) (e.preventDefault(), openMenu());
        }}
      >
        <Icon name={st.icon} size={14} />
        <span>{st.label}</span>
        <Icon name="chevronDown" size={12} />
      </button>
      {#if menuOpen}
        <!-- svelte-ignore a11y_no_noninteractive_element_interactions, a11y_interactive_supports_focus -->
        <div class="menu" role="listbox" aria-label="Status" tabindex="-1" onkeydown={menuKey} {@attach (el) => el.focus()}>
          {#each STATUSES as s, i (s.id)}
            <button
              type="button"
              class="item"
              class:hot={i === menuIdx}
              role="option"
              aria-selected={s.id === status}
              data-status={s.id}
              onmousemove={() => (menuIdx = i)}
              onclick={() => pick(s.id)}
            >
              <Icon name={s.icon} size={14} />
              <span>{s.label}</span>
              {#if s.id === status}<span class="tick"><Icon name="check" size={12} /></span>{/if}
            </button>
          {/each}
        </div>
      {/if}
    </div>
  </div>

  <div class="content">
    {#if editingTitle}
      <input
        class="title-edit nodrag"
        bind:this={titleInput}
        bind:value={titleDraft}
        onkeydown={(e) => {
          e.stopPropagation();
          if (e.key === 'Enter') endTitle(true);
          else if (e.key === 'Escape') endTitle(false);
        }}
        onblur={() => endTitle(true)}
      />
    {:else}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="title" ondblclick={startTitle} title="Double-click to edit">{title || 'Untitled finding'}</div>
    {/if}
    <div class="body">
      <EditableText value={text} bind:editing {oncommit}>
        {#if text.trim()}
          <MarkdownBody markdown={text} {mode} />
        {:else}
          <div class="empty">Double-click to add evidence</div>
        {/if}
      </EditableText>
    </div>
  </div>
  <FarSummary
    active={lod === 'far'}
    title={title || kind.label}
    icon={kind.icon}
    accent={accent}
    muted={status === 'ruled-out'}
    chips={[{ label: st.label, color: status === 'open' ? undefined : accent }]}
  />
</div>

<style>
  .card {
    position: relative;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    background: var(--vscode-editorWidget-background, #252526);
    color: var(--vscode-editor-foreground, #d4d4d4);
    border: 1px solid var(--vscode-editorWidget-border, var(--vscode-panel-border, #454545));
    border-left: 4px solid var(--accent);
    border-radius: 6px;
    font-family: var(--vscode-font-family, system-ui, sans-serif);
    /* one colour transition, no bounce */
    transition: border-left-color 220ms ease, border-color 120ms ease;
  }
  .card.selected {
    border-color: var(--vscode-focusBorder, #007fd4);
    border-left-color: var(--accent);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--vscode-focusBorder, #007fd4) 35%, transparent);
  }
  .head {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: none;
    height: 32px;
    padding: 0 8px 0 12px;
    cursor: grab;
  }
  .kind {
    display: grid;
    color: var(--vscode-descriptionForeground, #9d9d9d);
  }
  .kind-label {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--vscode-descriptionForeground, #9d9d9d);
    font-size: 11px;
  }
  .chip-wrap {
    position: relative;
    flex: none;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    height: 24px;
    padding: 0 6px 0 6px;
    border: 1px solid color-mix(in srgb, var(--accent) 55%, transparent);
    border-radius: 4px;
    background: color-mix(in srgb, var(--accent) 16%, transparent);
    color: var(--accent);
    font: inherit;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: background-color 220ms ease, border-color 220ms ease, color 220ms ease;
  }
  .ruled .chip {
    color: var(--vscode-descriptionForeground, #9d9d9d);
  }
  .chip:hover {
    background: color-mix(in srgb, var(--accent) 26%, transparent);
  }
  .chip:focus-visible,
  .item:focus-visible {
    outline: 1px solid var(--vscode-focusBorder, #007fd4);
    outline-offset: 1px;
  }
  .menu {
    position: absolute;
    right: 0;
    top: 28px;
    z-index: 5;
    width: 160px;
    padding: 4px;
    box-sizing: border-box;
    background: var(--vscode-editorWidget-background, #252526);
    border: 1px solid var(--vscode-editorWidget-border, #454545);
    border-radius: 6px;
    box-shadow: var(--cv-shadow-float, 0 4px 16px rgb(0 0 0 / 0.28));
    outline: none;
    animation: menu-in 120ms ease-out;
  }
  .item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    height: 28px;
    padding: 0 8px;
    border: 0;
    border-radius: 4px;
    background: transparent;
    color: var(--vscode-editor-foreground, #ccc);
    font: inherit;
    font-size: 12px;
    text-align: left;
    cursor: pointer;
  }
  .item.hot {
    background: var(--vscode-list-hoverBackground, rgba(90, 93, 94, 0.31));
  }
  .item[data-status='investigating'] :global(svg) {
    color: var(--vscode-charts-orange, #d18616);
  }
  .item[data-status='confirmed'] :global(svg) {
    color: var(--vscode-charts-green, #89d185);
  }
  .tick {
    margin-left: auto;
    display: grid;
  }
  .content {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    transition: opacity 220ms ease;
  }
  .ruled .content {
    opacity: 0.6;
  }
  .title {
    flex: none;
    padding: 0 12px 2px;
    font-size: 13px;
    font-weight: 600;
    line-height: 20px;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
  }
  .ruled .title {
    text-decoration: line-through;
    text-decoration-thickness: 1px;
  }
  .title-edit {
    flex: none;
    box-sizing: border-box;
    height: 24px;
    margin: 0 8px 2px;
    padding: 0 4px;
    border: 1px solid var(--vscode-focusBorder, #007fd4);
    border-radius: 4px;
    outline: none;
    background: var(--vscode-input-background, #3c3c3c);
    color: var(--vscode-input-foreground, #ccc);
    font: inherit;
    font-size: 13px;
    font-weight: 600;
  }
  .body {
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }
  .empty {
    padding: 4px 12px;
    color: var(--vscode-descriptionForeground, #9d9d9d);
    font-size: 12px;
    font-style: italic;
  }
  @keyframes menu-in {
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
    .card,
    .chip,
    .content {
      transition: none;
    }
    .menu {
      animation: none;
    }
  }
</style>
