<script lang="ts">
  import type { Snippet } from 'svelte';
  import { canvasColor } from '../../lib/colors';
  import LineNumber from '../atoms/LineNumber.svelte';
  import CodeText, { type Token } from '../atoms/CodeText.svelte';
  import HighlightPill from '../atoms/HighlightPill.svelte';

  let {
    n,
    text,
    tokens = null,
    color,
    pulse = false,
    pills = [],
    onlineclick,
    handles,
  }: {
    n: number;
    text: string;
    tokens?: Token[] | null;
    /** Canvas color for this line, if highlighted. */
    color?: string;
    /** Flash the line background once (a highlight was just added). */
    pulse?: boolean;
    /** Labels to show at the right end of the row. */
    pills?: { id: string; color?: string; label: string }[];
    onlineclick?: (n: number) => void;
    /** Rendered inside the (position: relative) row, e.g. graph handles. */
    handles?: Snippet;
  } = $props();
</script>

<div class="row" class:hl={!!color} class:pulse style={color ? `--hl: ${canvasColor(color)}` : ''}>
  <LineNumber {n} onclick={onlineclick} />
  <CodeText {text} {tokens} />
  {#each pills as p (p.id)}<HighlightPill color={p.color} label={p.label} />{/each}
  {@render handles?.()}
</div>

<style>
  .row {
    position: relative;
    display: flex;
    height: 18px;
    border-left: 3px solid transparent;
  }
  .row.hl {
    border-left-color: var(--hl);
    background: color-mix(in srgb, var(--hl) 22%, transparent);
  }
  .row.pulse {
    animation: line-pulse 700ms ease-out;
  }
  @keyframes line-pulse {
    0% {
      background: color-mix(in srgb, var(--hl) 70%, transparent);
    }
    100% {
      background: color-mix(in srgb, var(--hl) 22%, transparent);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .row.pulse {
      animation: none;
    }
  }
</style>
