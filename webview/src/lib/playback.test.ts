import { describe, expect, it } from 'vitest';
import type { Flow } from '../../../src/shared/canvasFile';
import { buildTimeline, createPlayer, stateAt } from './playback';

const flow: Flow = {
  id: 'f',
  title: 'Order',
  steps: [
    { id: 'a', edge: 'e1', caption: 'Click pay', data: '{ cartId }' },
    { id: 'b', edge: 'e2', durationMs: 1000, data: 'Order{ id: 812 }' },
    { id: 'c1', edge: 'e3', durationMs: 500, caption: 'Retry splits' },
    { id: 'c2', edge: 'e4', durationMs: 2000, parallel: true },
    { id: 'd', node: 'n5', durationMs: 400 },
  ],
};

function fakeClock() {
  let cb: ((ts: number) => void) | undefined;
  let next = 1;
  return {
    raf: (f: (ts: number) => void) => {
      cb = f;
      return next++;
    },
    caf: () => {
      cb = undefined;
    },
    tick(ts: number) {
      const f = cb;
      cb = undefined;
      f?.(ts);
    },
    get pending() {
      return !!cb;
    },
  };
}

describe('buildTimeline', () => {
  it('defaults to 1200ms and groups parallel steps', () => {
    const tl = buildTimeline(flow);
    expect(tl.entries.map((e) => [e.start, e.end])).toEqual([
      [0, 1200],
      [1200, 2200],
      [2200, 2700],
      [2200, 4200],
      [4200, 4600],
    ]);
    expect(tl.groups.map((g) => g.entries)).toEqual([[0], [1], [2, 3], [4]]);
    expect(tl.duration).toBe(4600);
    expect(tl.ticks[3]).toBe(1);
  });
  it('measures edges when asked', () => {
    const tl = buildTimeline(flow, (id) => (id === 'e1' ? 240 : undefined));
    expect(tl.entries[0].length).toBe(240);
    expect(tl.entries[1].length).toBeUndefined();
  });
  it('handles empty flows and a leading parallel flag', () => {
    expect(buildTimeline(undefined).duration).toBe(0);
    const tl = buildTimeline({ id: 'x', title: 'x', steps: [{ id: 's', parallel: true }] });
    expect(tl.groups).toHaveLength(1);
  });
});

describe('stateAt', () => {
  const tl = buildTimeline(flow);
  it('reports progress and caption', () => {
    const s = stateAt(tl, 600);
    expect(s.currentIndex).toBe(0);
    expect(s.activeSteps[0].progress).toBeCloseTo(0.5);
    expect(s.caption).toBe('Click pay');
    expect(s.data).toBe('{ cartId }');
  });
  it('runs parallel steps together and parks the short one at 1', () => {
    const s = stateAt(tl, 3200);
    expect(s.activeSteps.map((a) => a.stepId)).toEqual(['c1', 'c2']);
    expect(s.activeSteps[0].progress).toBe(1);
    expect(s.activeSteps[1].progress).toBeCloseTo(0.5);
    expect(s.currentIndex).toBe(2);
    expect(s.caption).toBe('Retry splits');
  });
  it('a boundary belongs to the next group; the end stays on the last', () => {
    expect(stateAt(tl, 1200).currentIndex).toBe(1);
    const end = stateAt(tl, 4600);
    expect(end.currentIndex).toBe(4);
    expect(end.done).toBe(true);
    expect(end.activeSteps[0].progress).toBe(1);
  });
  it('is empty for an empty flow', () => {
    const s = stateAt(buildTimeline(undefined), 0);
    expect(s.activeSteps).toEqual([]);
    expect(s.currentIndex).toBe(-1);
  });
});

describe('player', () => {
  it('plays with the injected clock, at speed, and finishes', () => {
    const c = fakeClock();
    const p = createPlayer(flow, { raf: c.raf, caf: c.caf });
    const seen: number[] = [];
    p.subscribe((s) => seen.push(s.time));
    p.play();
    c.tick(1000); // first frame anchors the clock
    c.tick(1600);
    expect(p.state.time).toBe(600);
    p.setSpeed(2);
    c.tick(2100);
    expect(p.state.time).toBe(1600);
    expect(p.state.speed).toBe(2);
    c.tick(1000000);
    expect(p.state.time).toBe(4600);
    expect(p.state.playing).toBe(false);
    expect(p.state.done).toBe(true);
    expect(c.pending).toBe(false);
  });

  it('pauses and holds the playhead', () => {
    const c = fakeClock();
    const p = createPlayer(flow, { raf: c.raf, caf: c.caf });
    p.play();
    c.tick(0);
    c.tick(500);
    p.pause();
    expect(c.pending).toBe(false);
    expect(p.state.time).toBe(500);
    expect(p.state.playing).toBe(false);
  });

  it('restarts from 0 when played after finishing', () => {
    const c = fakeClock();
    const p = createPlayer(flow, { raf: c.raf, caf: c.caf });
    p.seek(4600);
    p.play();
    expect(p.state.time).toBe(0);
    expect(p.state.playing).toBe(true);
  });

  it('seeks by fraction and by step (parked at the step end)', () => {
    const p = createPlayer(flow);
    p.seekFraction(0.5);
    expect(p.state.time).toBe(2300);
    p.seekStep(1);
    expect(p.state.groupIndex).toBe(1);
    expect(p.state.activeSteps[0].progress).toBeGreaterThan(0.999);
    p.seekStep(3); // parallel member seeks its group
    expect(p.state.groupIndex).toBe(2);
    p.destroy();
  });

  it('steps forward and back through group boundaries', () => {
    const p = createPlayer(flow);
    p.step(1);
    expect(p.state.groupIndex).toBe(0);
    expect(p.state.activeSteps[0].progress).toBeGreaterThan(0.999);
    p.step(1);
    expect(p.state.groupIndex).toBe(1);
    p.step(1);
    expect(p.state.groupIndex).toBe(2);
    p.step(-1);
    expect(p.state.groupIndex).toBe(1);
    p.step(-1);
    p.step(-1);
    expect(p.state.time).toBe(0);
    p.step(-1);
    expect(p.state.time).toBe(0);
    // mid-group forward finishes the current group first
    p.seek(600);
    p.step(1);
    expect(p.state.groupIndex).toBe(0);
    expect(p.state.activeSteps[0].progress).toBeGreaterThan(0.999);
    // mid-group back returns to the start
    p.seek(1500);
    p.step(-1);
    expect(p.state.groupIndex).toBe(0);
  });

  it('setFlow resets to the start, paused', () => {
    const p = createPlayer(flow);
    p.seek(2000);
    p.setFlow({ id: 'g', title: 'g', steps: [{ id: 'x', durationMs: 100 }] });
    expect(p.state.time).toBe(0);
    expect(p.state.duration).toBe(100);
    expect(p.state.playing).toBe(false);
  });

  it('does nothing for an empty flow', () => {
    const p = createPlayer(undefined);
    p.play();
    expect(p.state.playing).toBe(false);
  });
});
