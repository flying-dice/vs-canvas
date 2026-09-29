<script lang="ts">
  import { onDestroy, untrack } from 'svelte';
  import type { CanvasFile } from '../../../src/shared/protocol';
  import { createPlayer, type PlaybackState } from '../lib/playback';
  import { reducedMotion } from '../lib/motion';
  import { ui, type LineRange } from '../lib/ui.svelte';
  import PlaybackBar from '../ui/organisms/PlaybackBar.svelte';

  // Owns the flow player. It feeds `ui` (active steps, lit lines, dimming flag) once per frame, asks the camera to
  // follow each step, and renders the transport bar. Packets and chips are drawn by CanvasEdge / Canvas.
  let {
    doc,
    edgeEnds,
    lineRange,
    hasNode,
    onfocus,
    onparticipants,
  }: {
    doc: CanvasFile | null;
    edgeEnds: (edgeId: string) => { source: string; target: string } | undefined;
    /** Displayed absolute line range of a code node. */
    lineRange: (nodeId: string) => LineRange | undefined;
    hasNode: (nodeId: string) => boolean;
    onfocus: (nodeIds: string[]) => void;
    /** Node / edge ids used by the current flow (everything else dims while it plays). */
    onparticipants: (nodes: Set<string>, edges: Set<string>) => void;
  } = $props();

  const flows = $derived(doc?.vsCanvas?.flows ?? []);
  let flowId = $state<string | undefined>();
  const flow = $derived(flows.find((f) => f.id === flowId) ?? flows[0]);
  const flowSig = $derived(flow ? JSON.stringify(flow) : '');

  const player = createPlayer(undefined);
  let pstate = $state.raw<PlaybackState>(player.state);
  let lastSig = '\0';
  let lastGroup = -2;
  let litKey = -1;
  let doneTimer: ReturnType<typeof setTimeout> | undefined;

  const EMPTY = new Map<string, readonly LineRange[]>();

  function setLit(next: ReadonlyMap<string, readonly LineRange[]>) {
    ui.activeLines = next;
  }

  /** Which node the step's `lines` belong to, and whether they light on arrival (target) or on departure. */
  function litTarget(a: PlaybackState['activeSteps'][number]): { id: string; atEnd: boolean } | null {
    if (!a.lines) return null;
    if (a.nodeId) return { id: a.nodeId, atEnd: false };
    const e = a.edgeId ? edgeEnds(a.edgeId) : undefined;
    if (!e) return null;
    const inRange = (id: string) => {
      const r = lineRange(id);
      return !!r && a.lines![0] <= r[1] && a.lines![1] >= r[0];
    };
    if (inRange(e.target)) return { id: e.target, atEnd: true };
    if (inRange(e.source)) return { id: e.source, atEnd: false };
    return { id: e.target, atEnd: true };
  }

  function onFrame(s: PlaybackState) {
    pstate = s;
    const started = s.playing || s.time > 0;
    ui.flowActive = s.playing || (started && !s.done);
    if (!started) {
      if (ui.steps.length) ui.steps = [];
      if (litKey !== -1) {
        litKey = -1;
        setLit(EMPTY);
      }
      lastGroup = -2;
      return;
    }
    if (!s.done) {
      clearTimeout(doneTimer);
      doneTimer = undefined;
    } else if (!doneTimer) {
      // Hold the last packet / chip / lit line for a beat, then restore the board.
      doneTimer = setTimeout(() => {
        ui.steps = [];
        ui.flowActive = false;
        litKey = -1;
        setLit(EMPTY);
      }, 1600);
    }
    // Reduced motion: packets jump to the end of their step instead of travelling.
    ui.steps = reducedMotion() ? s.activeSteps.map((a) => ({ ...a, progress: 0.96 })) : s.activeSteps;

    // Lit lines: only rebuilt when the set of lit steps changes.
    let bits = 0;
    for (let i = 0; i < s.activeSteps.length && i < 20; i++) {
      const a = s.activeSteps[i];
      const t = litTarget(a);
      if (t && (reducedMotion() || !t.atEnd || a.progress >= 0.85) && (a.progress > 0 || reducedMotion())) bits |= 1 << i;
    }
    const key = s.groupIndex * 1048576 + bits;
    if (key !== litKey) {
      litKey = key;
      const m = new Map<string, LineRange[]>();
      for (let i = 0; i < s.activeSteps.length && i < 20; i++) {
        if (!(bits & (1 << i))) continue;
        const a = s.activeSteps[i];
        const t = litTarget(a)!;
        (m.get(t.id) ?? m.set(t.id, []).get(t.id)!).push(a.lines!);
      }
      setLit(m);
    }

    if (s.groupIndex !== lastGroup) {
      lastGroup = s.groupIndex;
      if (s.groupIndex >= 0) follow(s);
    }
  }

  function follow(s: PlaybackState) {
    const ids: string[] = [];
    for (const a of s.activeSteps) {
      if (a.nodeId) ids.push(a.nodeId);
      else if (a.edgeId) {
        const e = edgeEnds(a.edgeId);
        if (e) ids.unshift(e.source), ids.push(e.target);
      }
    }
    const list = [...new Set(ids)].filter(hasNode);
    if (list.length) onfocus(list);
  }

  const off = player.subscribe(onFrame);
  onDestroy(() => {
    off();
    clearTimeout(doneTimer);
    player.destroy();
    ui.steps = [];
    ui.flowActive = false;
    setLit(EMPTY);
  });

  // The flow definition changed (another flow picked, or the document edited it): reset. Unrelated document
  // edits (drags) leave the signature alone and never interrupt playback.
  $effect(() => {
    const sig = flowSig;
    if (sig === lastSig) return;
    lastSig = sig;
    untrack(() => {
      player.setFlow(flow);
      announce(flow);
    });
  });

  function announce(f: (typeof flows)[number] | undefined) {
    const nodes = new Set<string>();
    const edges = new Set<string>();
    for (const st of f?.steps ?? []) {
      if (st.node) nodes.add(st.node);
      if (st.edge) {
        edges.add(st.edge);
        const e = edgeEnds(st.edge);
        if (e) nodes.add(e.source), nodes.add(e.target);
      }
    }
    onparticipants(nodes, edges);
  }

  export function play(id: string, fromStep = 0) {
    const f = flows.find((q) => q.id === id) ?? flows[0];
    if (!f) return;
    flowId = f.id;
    lastSig = JSON.stringify(f);
    player.setFlow(f);
    announce(f);
    lastGroup = -2;
    const entry = player.timeline.entries[fromStep];
    if (entry && fromStep > 0) player.seek(entry.start);
    player.play();
  }
  export const toggle = () => player.toggle();
  export const step = (d: 1 | -1) => player.step(d);
  export const hasFlows = () => flows.length > 0;
  export const isActive = () => pstate.playing || (pstate.time > 0 && !pstate.done);

  // `player.timeline` is a plain getter that changes with setFlow (which always emits a state); re-read it then.
  const ticks = $derived((void pstate, player.timeline.ticks));
  const stepCount = $derived((void pstate, player.timeline.groups.length));
  const flowOptions = $derived(flows.map((f) => ({ id: f.id, title: f.title })));
</script>

{#if flows.length}
  <PlaybackBar
    flows={flowOptions}
    flowId={flow?.id}
    playing={pstate.playing}
    progress={pstate.progress}
    {ticks}
    currentIndex={pstate.groupIndex}
    {stepCount}
    caption={pstate.caption}
    speed={pstate.speed}
    keyboard={false}
    onflowchange={(id) => (flowId = id)}
    onplaypause={() => player.toggle()}
    onstep={(d) => player.step(d)}
    onseek={(f) => player.seekFraction(f)}
    onseekstep={(i) => {
      const g = player.timeline.groups[i];
      if (g) player.seekStep(player.timeline.entries[g.entries[0]].index);
    }}
    onspeed={(v) => player.setSpeed(v)}
  />
{/if}
