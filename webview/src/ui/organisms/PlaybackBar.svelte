<script module lang="ts">
  export type FlowOption = { id: string; title: string };
  export const SPEEDS = [0.5, 1, 2] as const;
</script>

<script lang="ts">
  import Icon from '../atoms/Icon.svelte';

  let {
    flows = [],
    flowId,
    playing = false,
    progress = 0,
    ticks = [],
    currentIndex = 0,
    stepCount = 0,
    caption,
    speed = 1,
    keyboard = true,
    onflowchange,
    onplaypause,
    onstep,
    onseek,
    onseekstep,
    onspeed,
  }: {
    flows?: FlowOption[];
    flowId?: string;
    playing?: boolean;
    /** 0..1 of the whole flow. */
    progress?: number;
    /** Fractions (0..1) where steps complete, one scrubber tick each (Timeline.ticks). */
    ticks?: number[];
    /** Index (into the ticks) of the current step. */
    currentIndex?: number;
    stepCount?: number;
    caption?: string;
    speed?: number;
    /** Space plays/pauses and ←/→ step while this bar is mounted. */
    keyboard?: boolean;
    onflowchange?: (id: string) => void;
    onplaypause?: () => void;
    onstep?: (delta: 1 | -1) => void;
    onseek?: (fraction: number) => void;
    /** A scrubber tick was clicked (tick index). */
    onseekstep?: (tickIndex: number) => void;
    onspeed?: (speed: number) => void;
  } = $props();

  let track = $state<HTMLDivElement>();
  let dragging = false;

  const fromEvent = (e: PointerEvent) => {
    const r = track!.getBoundingClientRect();
    return Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
  };
  function down(e: PointerEvent) {
    if ((e.target as HTMLElement).closest('.tick')) return;
    dragging = true;
    track!.setPointerCapture(e.pointerId);
    onseek?.(fromEvent(e));
  }
  function move(e: PointerEvent) {
    if (dragging) onseek?.(fromEvent(e));
  }
  function up() {
    dragging = false;
  }

  function editable(t: EventTarget | null) {
    const el = t as HTMLElement | null;
    return !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
  }
  function key(e: KeyboardEvent) {
    if (!keyboard || editable(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === ' ' && !(e.target as HTMLElement)?.closest?.('button')) {
      e.preventDefault();
      onplaypause?.();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      onstep?.(-1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      onstep?.(1);
    }
  }

  const pct = $derived(Math.round(Math.min(1, Math.max(0, progress)) * 1000) / 10);
  const stepLabel = $derived(stepCount > 0 ? `Step ${Math.min(stepCount, currentIndex + 1)} of ${stepCount}` : 'No steps');
</script>

<svelte:window onkeydown={key} />

<div class="bar nodrag nopan nowheel" role="region" aria-label="Flow playback">
  <div class="row">
    {#if flows.length > 1}
      <select class="picker" value={flowId} aria-label="Flow" onchange={(e) => onflowchange?.(e.currentTarget.value)}>
        {#each flows as f (f.id)}<option value={f.id}>{f.title}</option>{/each}
      </select>
    {:else if flows.length === 1}
      <span class="single" title={flows[0].title}><Icon name="flow" size={14} />{flows[0].title}</span>
    {/if}
    <div class="transport">
      <button type="button" class="btn" title="Previous step (←)" aria-label="Previous step" onclick={() => onstep?.(-1)}><Icon name="stepBack" /></button>
      <button type="button" class="btn play" title={playing ? 'Pause (Space)' : 'Play (Space)'} aria-label={playing ? 'Pause' : 'Play'} onclick={onplaypause}>
        <Icon name={playing ? 'pause' : 'play'} />
      </button>
      <button type="button" class="btn" title="Next step (→)" aria-label="Next step" onclick={() => onstep?.(1)}><Icon name="stepForward" /></button>
    </div>
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="scrub"
      bind:this={track}
      role="slider"
      tabindex="0"
      aria-label="Flow position"
      aria-valuemin="0"
      aria-valuemax="100"
      aria-valuenow={Math.round(pct)}
      aria-valuetext={stepLabel}
      onpointerdown={down}
      onpointermove={move}
      onpointerup={up}
      onpointercancel={up}
    >
      <div class="rail"><div class="fill" style={`width:${pct}%`}></div></div>
      {#each ticks as t, i (i)}
        <button
          type="button"
          class="tick"
          class:done={progress >= t - 0.0005}
          class:current={i === currentIndex}
          style={`left:${t * 100}%`}
          title={`Step ${i + 1}`}
          aria-label={`Go to step ${i + 1}`}
          onclick={() => onseekstep?.(i)}
        ><span class="pip"></span></button>
      {/each}
    </div>
    <div class="speeds" role="group" aria-label="Speed">
      {#each SPEEDS as s (s)}
        <button type="button" class="sp" class:on={speed === s} aria-pressed={speed === s} onclick={() => onspeed?.(s)}>{s}×</button>
      {/each}
    </div>
  </div>
  <div class="caption" aria-live="polite">
    {#key caption}<span class="cap">{caption ?? ''}</span>{/key}
    <span class="count">{stepLabel}</span>
  </div>
</div>

<style>
  .bar {
    position: absolute;
    left: 50%;
    bottom: 16px;
    transform: translateX(-50%);
    z-index: 15;
    width: min(760px, calc(100% - 32px));
    box-sizing: border-box;
    padding: 8px 12px;
    background: var(--vscode-editorWidget-background, #252526);
    border: 1px solid var(--vscode-editorWidget-border, var(--vscode-widget-border, #454545));
    border-radius: 10px;
    box-shadow: var(--cv-shadow-float, 0 4px 16px rgb(0 0 0 / 0.28));
    color: var(--vscode-editor-foreground, #ccc);
    font-family: var(--vscode-font-family, system-ui, sans-serif);
    font-size: 13px;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 12px;
    height: 32px;
  }
  .picker,
  .single {
    flex: none;
    max-width: 180px;
    height: 24px;
    box-sizing: border-box;
    border-radius: 4px;
    font: inherit;
    font-size: 12px;
  }
  .picker {
    padding: 0 6px;
    border: 1px solid var(--vscode-dropdown-border, var(--vscode-editorWidget-border, #454545));
    background: var(--vscode-dropdown-background, #3c3c3c);
    color: var(--vscode-dropdown-foreground, #ccc);
  }
  .picker:focus-visible {
    outline: 1px solid var(--vscode-focusBorder, #007fd4);
  }
  .single {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--vscode-descriptionForeground, #9d9d9d);
  }
  .transport {
    display: flex;
    gap: 2px;
    flex: none;
  }
  .btn {
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    padding: 0;
    border: 0;
    border-radius: 4px;
    background: transparent;
    color: var(--vscode-icon-foreground, var(--vscode-editor-foreground, #ccc));
    cursor: pointer;
  }
  .btn:hover {
    background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
  }
  .btn.play {
    background: var(--vscode-button-background, #0078d4);
    color: var(--vscode-button-foreground, #fff);
  }
  .btn.play:hover {
    background: var(--vscode-button-hoverBackground, #026ec1);
  }
  .btn:focus-visible,
  .sp:focus-visible,
  .scrub:focus-visible {
    outline: 1px solid var(--vscode-focusBorder, #007fd4);
    outline-offset: 1px;
  }
  .scrub {
    position: relative;
    flex: 1;
    min-width: 80px;
    height: 24px;
    cursor: pointer;
    touch-action: none;
  }
  .rail {
    position: absolute;
    left: 0;
    right: 0;
    top: 11px;
    height: 3px;
    border-radius: 2px;
    background: var(--vscode-editorWidget-border, #454545);
    overflow: hidden;
  }
  .fill {
    height: 100%;
    background: var(--vscode-terminal-ansiCyan, #29b8db);
  }
  .tick {
    position: absolute;
    top: 0;
    width: 24px;
    height: 24px;
    margin-left: -12px;
    padding: 0;
    border: 0;
    background: transparent;
    cursor: pointer;
  }
  .pip {
    display: block;
    width: 7px;
    height: 7px;
    margin: 8.5px auto;
    box-sizing: border-box;
    border-radius: 50%;
    background: var(--vscode-editorWidget-background, #252526);
    border: 1px solid var(--vscode-descriptionForeground, #9d9d9d);
    transition: background-color 120ms ease, border-color 120ms ease;
  }
  .tick.done .pip {
    background: var(--vscode-terminal-ansiCyan, #29b8db);
    border-color: var(--vscode-terminal-ansiCyan, #29b8db);
  }
  .tick.current .pip {
    outline: 2px solid color-mix(in srgb, var(--vscode-terminal-ansiCyan, #29b8db) 40%, transparent);
  }
  .tick:focus-visible {
    outline: 1px solid var(--vscode-focusBorder, #007fd4);
    border-radius: 4px;
  }
  .speeds {
    display: flex;
    flex: none;
    gap: 2px;
  }
  .sp {
    min-width: 32px;
    height: 24px;
    padding: 0 4px;
    border: 0;
    border-radius: 4px;
    background: transparent;
    color: var(--vscode-descriptionForeground, #9d9d9d);
    font: inherit;
    font-size: 11px;
    cursor: pointer;
  }
  .sp:hover {
    background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
  }
  .sp.on {
    background: var(--vscode-toolbar-activeBackground, rgba(99, 102, 103, 0.31));
    color: var(--vscode-editor-foreground, #ccc);
  }
  .caption {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    height: 24px;
    padding-top: 2px;
  }
  .cap {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    animation: cap-in 160ms ease-out;
  }
  .count {
    flex: none;
    color: var(--vscode-descriptionForeground, #9d9d9d);
    font-size: 11px;
    font-variant-numeric: tabular-nums;
  }
  @keyframes cap-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .cap {
      animation: none;
    }
    .pip {
      transition: none;
    }
  }
</style>
