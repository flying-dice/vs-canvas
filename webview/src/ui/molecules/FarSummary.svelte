<script lang="ts">
  import Icon, { type IconName } from '../atoms/Icon.svelte';

  export type FarChip = { label: string; color?: string };

  // Semantic zoom `far` level for cards: an overlay with a large title, an optional line underneath and a few
  // big chips, so a card stays legible when the canvas is zoomed out. Parent must be position: relative.
  let {
    active,
    title,
    subtitle,
    icon,
    accent,
    chips = [],
    muted = false,
  }: {
    active: boolean;
    title: string;
    subtitle?: string;
    icon?: IconName;
    /** Colour of the left rule (e.g. finding status); omit for none. */
    accent?: string;
    chips?: FarChip[];
    /** Ruled-out / inactive: strike the title and dim. */
    muted?: boolean;
  } = $props();
</script>

<div class="far" class:active class:muted aria-hidden={!active} style={accent ? `--accent: ${accent}` : ''}>
  <div class="title">
    {#if icon}<span class="icon"><Icon name={icon} size={28} /></span>{/if}
    <span class="text">{title}</span>
  </div>
  {#if subtitle}<div class="subtitle">{subtitle}</div>{/if}
  {#if chips.length}
    <div class="chips">
      {#each chips.slice(0, 4) as c, i (i)}
        <span class="chip" style={c.color ? `--hc: ${c.color}` : ''}>{c.label}</span>
      {/each}
    </div>
  {/if}
</div>

<style>
  .far {
    container-type: size;
    position: absolute;
    inset: 0;
    z-index: 2;
    box-sizing: border-box;
    padding: 20px 24px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    overflow: hidden;
    background: var(--vscode-editorWidget-background, #252526);
    color: var(--vscode-editor-foreground, #d4d4d4);
    font-family: var(--vscode-font-family, system-ui, sans-serif);
    border-radius: inherit;
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
    transition: opacity 180ms ease, visibility 0s linear 180ms;
  }
  .far[style*='--accent'] {
    box-shadow: inset 6px 0 0 var(--accent);
    padding-left: 30px;
  }
  .far.active {
    opacity: 1;
    visibility: visible;
    transition: opacity 180ms ease, visibility 0s;
  }
  .title {
    font-size: min(calc(30px * var(--cv-far-scale, 1)), max(30px, 11cqw));
    font-weight: 700;
    line-height: 1.15;
    overflow-wrap: anywhere;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
  }
  .icon {
    display: inline-flex;
    margin-right: 10px;
    vertical-align: -4px;
    color: var(--accent, var(--vscode-descriptionForeground, #9d9d9d));
  }
  .muted .text {
    text-decoration: line-through;
    text-decoration-thickness: 2px;
  }
  .muted {
    color: var(--vscode-descriptionForeground, #9d9d9d);
  }
  .subtitle {
    color: var(--vscode-descriptionForeground, #9d9d9d);
    font-size: min(calc(20px * var(--cv-far-scale, 1)), max(20px, 6cqw));
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: auto;
  }
  .chip {
    padding: 4px 12px;
    border-radius: 4px;
    border: 2px solid var(--hc, var(--vscode-widget-border, #454545));
    background: color-mix(in srgb, var(--hc, transparent) 22%, transparent);
    font-size: min(calc(20px * var(--cv-far-scale, 1)), max(20px, 6cqw));
    font-weight: 600;
    white-space: nowrap;
  }
  @media (prefers-reduced-motion: reduce) {
    .far,
    .far.active {
      transition: none;
    }
  }
</style>
