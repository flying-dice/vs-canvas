// Flow playback scheduler. Pure and framework-free: no DOM, no Svelte. The clock (requestAnimationFrame) is
// injectable so tests can drive it by hand.
//
// A Flow is a list of steps. Consecutive steps flagged `parallel` start together with the step before them and
// form one *group*; groups run one after another. A group lasts as long as its longest step.
import type { Flow, FlowStep } from '../../../src/shared/canvasFile';

export const DEFAULT_STEP_MS = 1200;
/** Stepping parks the playhead this many ms before a group's end so the group still counts as current. */
const EPS = 0.01;

export type TimelineEntry = {
  step: FlowStep;
  /** Index into flow.steps. */
  index: number;
  /** Index into timeline.groups. */
  group: number;
  start: number;
  end: number;
  durationMs: number;
  /** SVG path length of the step's edge, when the caller could measure it (used by the packet, not for timing). */
  length?: number;
};

export type TimelineGroup = { index: number; start: number; end: number; entries: number[] };

export type Timeline = {
  entries: TimelineEntry[];
  groups: TimelineGroup[];
  /** Total length in ms. */
  duration: number;
  /** Fractions (0..1) where each group completes, for scrubber ticks. */
  ticks: number[];
};

export type PathMeasure = (edgeId: string) => number | undefined;

export function buildTimeline(flow: Flow | undefined, measure?: PathMeasure): Timeline {
  const entries: TimelineEntry[] = [];
  const groups: TimelineGroup[] = [];
  let cursor = 0;
  (flow?.steps ?? []).forEach((step, index) => {
    const durationMs = Math.max(0, step.durationMs ?? DEFAULT_STEP_MS);
    let g = groups[groups.length - 1];
    if (!step.parallel || !g) {
      g = { index: groups.length, start: cursor, end: cursor, entries: [] };
      groups.push(g);
    }
    const entry: TimelineEntry = {
      step,
      index,
      group: g.index,
      start: g.start,
      end: g.start + durationMs,
      durationMs,
      length: step.edge ? measure?.(step.edge) : undefined,
    };
    g.entries.push(entries.length);
    entries.push(entry);
    g.end = Math.max(g.end, entry.end);
    cursor = g.end;
  });
  const duration = cursor;
  return { entries, groups, duration, ticks: groups.map((g) => (duration > 0 ? g.end / duration : 1)) };
}

export type ActiveStep = {
  stepId: string;
  /** Index into flow.steps. */
  index: number;
  edgeId?: string;
  nodeId?: string;
  lines?: [number, number];
  data?: string;
  caption?: string;
  /** 0..1 along the step (clamped; steps shorter than their group park at 1). */
  progress: number;
  length?: number;
};

export type PlaybackState = {
  playing: boolean;
  /** Playhead in ms (0..duration). */
  time: number;
  duration: number;
  /** time / duration, 0..1. */
  progress: number;
  speed: number;
  /** Index into flow.steps of the first step of the current group; -1 for an empty flow. */
  currentIndex: number;
  /** Index of the current group; -1 for an empty flow. */
  groupIndex: number;
  activeSteps: ActiveStep[];
  /** Caption of the current group (first active step that has one). */
  caption?: string;
  /** Payload at the current point (first active step that has data). */
  data?: string;
  /** Reached the end. Pressing play again restarts. */
  done: boolean;
  stepCount: number;
};

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Pure: playback state at `time`. */
export function stateAt(tl: Timeline, time: number, extra: { playing?: boolean; speed?: number } = {}): PlaybackState {
  const t = Math.min(tl.duration, Math.max(0, time));
  let gi = -1;
  for (let i = 0; i < tl.groups.length; i++) if (tl.groups[i].start <= t) gi = i;
  const g = gi >= 0 ? tl.groups[gi] : undefined;
  const activeSteps: ActiveStep[] = g
    ? g.entries.map((ei) => {
        const e = tl.entries[ei];
        return {
          stepId: e.step.id,
          index: e.index,
          edgeId: e.step.edge,
          nodeId: e.step.node,
          lines: e.step.lines,
          data: e.step.data,
          caption: e.step.caption,
          progress: e.durationMs > 0 ? clamp01((t - e.start) / e.durationMs) : 1,
          length: e.length,
        };
      })
    : [];
  return {
    playing: extra.playing ?? false,
    time: t,
    duration: tl.duration,
    progress: tl.duration > 0 ? t / tl.duration : 0,
    speed: extra.speed ?? 1,
    currentIndex: activeSteps[0]?.index ?? -1,
    groupIndex: gi,
    activeSteps,
    caption: activeSteps.find((s) => s.caption)?.caption,
    data: activeSteps.find((s) => s.data)?.data,
    done: tl.groups.length > 0 && t >= tl.duration,
    stepCount: tl.entries.length,
  };
}

export type PlayerOptions = {
  /** Frame scheduler; defaults to requestAnimationFrame. The callback receives a timestamp in ms. */
  raf?: (cb: (ts: number) => void) => number;
  caf?: (id: number) => void;
  /** Clock used when a frame passes no timestamp. Defaults to performance.now. */
  now?: () => number;
  /** Measures an edge's SVG path length (`path.getTotalLength()`), exposed per active step. */
  measure?: PathMeasure;
  speed?: number;
};

export type Player = {
  readonly state: PlaybackState;
  readonly timeline: Timeline;
  /** Called immediately with the current state, then on every change. Returns unsubscribe. */
  subscribe(fn: (s: PlaybackState) => void): () => void;
  play(): void;
  pause(): void;
  toggle(): void;
  /** Move the playhead to `ms` (clamped). Keeps playing if it was playing. */
  seek(ms: number): void;
  seekFraction(f: number): void;
  /** Park at the end of the group containing `flow.steps[index]` (the step shown completed). */
  seekStep(index: number): void;
  /** Move to the previous (-1) / next (+1) step boundary; a boundary is where a group completes (or 0). */
  step(delta: 1 | -1): void;
  setSpeed(speed: number): void;
  /** Replace the flow (resets to the start, paused). */
  setFlow(flow: Flow | undefined): void;
  destroy(): void;
};

export function createPlayer(initial: Flow | undefined, opts: PlayerOptions = {}): Player {
  const raf = opts.raf ?? ((cb) => requestAnimationFrame(cb));
  const caf = opts.caf ?? ((id) => cancelAnimationFrame(id));
  const clock = opts.now ?? (() => performance.now());

  let flow = initial;
  let tl = buildTimeline(flow, opts.measure);
  let time = 0;
  let speed = opts.speed ?? 1;
  let playing = false;
  let handle: number | undefined;
  let last: number | undefined;
  let st = stateAt(tl, 0, { speed });
  const subs = new Set<(s: PlaybackState) => void>();

  const emit = () => {
    st = stateAt(tl, time, { playing, speed });
    for (const fn of subs) fn(st);
  };
  const stop = () => {
    if (handle !== undefined) caf(handle);
    handle = undefined;
    last = undefined;
  };
  const frame = (ts?: number) => {
    handle = undefined;
    if (!playing) return;
    const now = ts ?? clock();
    if (last !== undefined) time += (now - last) * speed;
    last = now;
    if (time >= tl.duration) {
      time = tl.duration;
      playing = false;
      stop();
      emit();
      return;
    }
    emit();
    handle = raf(frame);
  };

  const positions = () => [0, ...tl.groups.map((g) => g.end)];

  const player: Player = {
    get state() {
      return st;
    },
    get timeline() {
      return tl;
    },
    subscribe(fn) {
      subs.add(fn);
      fn(st);
      return () => subs.delete(fn);
    },
    play() {
      if (playing || tl.duration === 0) return;
      if (time >= tl.duration) time = 0;
      playing = true;
      last = undefined;
      emit();
      handle = raf(frame);
    },
    pause() {
      if (!playing) return;
      playing = false;
      stop();
      emit();
    },
    toggle() {
      if (playing) player.pause();
      else player.play();
    },
    seek(ms) {
      time = Math.min(tl.duration, Math.max(0, ms));
      last = undefined;
      emit();
    },
    seekFraction(f) {
      player.seek(clamp01(f) * tl.duration);
    },
    seekStep(index) {
      const e = tl.entries[index];
      if (e) player.seek(tl.groups[e.group].end - EPS);
    },
    step(delta) {
      const p = positions();
      if (delta > 0) {
        const next = p.find((v) => v > time + 2 * EPS);
        if (next !== undefined) player.seek(next - EPS);
      } else {
        const prev = [...p].reverse().find((v) => v < time - 2 * EPS);
        player.seek(prev === undefined ? 0 : prev === 0 ? 0 : prev - EPS);
      }
    },
    setSpeed(s) {
      speed = s > 0 ? s : 1;
      emit();
    },
    setFlow(f) {
      stop();
      playing = false;
      flow = f;
      tl = buildTimeline(flow, opts.measure);
      time = 0;
      emit();
    },
    destroy() {
      stop();
      playing = false;
      subs.clear();
    },
  };
  return player;
}
