<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import { fn } from 'storybook/test';
  import PlaybackBar from './PlaybackBar.svelte';
  import DataChip from '../molecules/DataChip.svelte';
  import FlowPacket from '../atoms/FlowPacket.svelte';
  import { createPlayer, type PlaybackState } from '../../lib/playback';
  import type { Flow } from '../../../../src/shared/canvasFile';

  const flow: Flow = {
    id: 'order', title: 'Order to ledger',
    steps: [
      { id: 's1', edge: 'e1', caption: 'Shopper clicks pay', data: '{ cartId }' },
      { id: 's2', edge: 'e2', caption: 'The API creates the order', data: 'Order{ id: 812, total: 49.00 }' },
      { id: 's3', edge: 'e3', caption: 'The card is charged', data: "Charge{ status: 'pending' }" },
      { id: 's4', edge: 'e4', caption: 'Timeout: the retry fires', data: 'Charge{ attempt: 1 }' },
      { id: 's5', edge: 'e5', parallel: true, data: 'Charge{ attempt: 2 }' },
    ],
  };
  const ticks = [0.2, 0.4, 0.6, 1];

  const { Story } = defineMeta({
    title: 'Organisms/PlaybackBar',
    component: PlaybackBar,
    tags: ['autodocs'],
    parameters: { layout: 'fullscreen' },
    args: {
      flows: [{ id: 'order', title: 'Order to ledger' }, { id: 'refund', title: 'Refund' }],
      flowId: 'order', playing: false, progress: 0.4, ticks, currentIndex: 1, stepCount: 4, speed: 1,
      caption: 'The API creates the order',
      onplaypause: fn(), onstep: fn(), onseek: fn(), onseekstep: fn(), onspeed: fn(), onflowchange: fn(), keyboard: false,
    },
  });
</script>

{#snippet c1(args: any)}
<div style="position:relative;width:100%;height:360px;background:var(--vscode-editor-background)">
      <svg width="100%" height="280" viewBox="0 0 700 280">
        <path bind:this={p1} d="M 40 200 C 200 200, 200 80, 360 80 S 520 200, 660 200" fill="none" stroke="var(--vscode-descriptionForeground,#888)" stroke-width="2" />
        {#each st.activeSteps as a (a.stepId)}
          {#if a.progress > 0 && a.progress < 1}<FlowPacket path={p1} progress={a.progress} />{/if}
        {/each}
      </svg>
      <div style="position:absolute;left:24px;top:24px"><DataChip text={st.data} /></div>
      <PlaybackBar
        flows={[{ id: 'order', title: flow.title }]} flowId="order" playing={st.playing} progress={st.progress}
        ticks={player.timeline.ticks} currentIndex={st.groupIndex} stepCount={player.timeline.groups.length}
        caption={st.caption} speed={st.speed}
        onplaypause={() => player.toggle()} onstep={(d) => player.step(d)} onseek={(f) => player.seekFraction(f)}
        onseekstep={(i) => player.seekStep(player.timeline.entries[player.timeline.groups[i].entries[0]].index)}
        onspeed={(s) => player.setSpeed(s)}
      />
    </div>
{/snippet}


{#snippet stage(args: any)}
  <div style="position:relative;width:100%;height:220px;background:var(--vscode-editor-background)"><PlaybackBar {...args} /></div>
{/snippet}

<Story name="Paused" template={stage} />
<Story name="Playing" args={{ playing: true }} template={stage} />
<Story name="SingleFlow" args={{ flows: [{ id: 'order', title: 'Order to ledger' }] }} template={stage} />
<Story name="Done" args={{ progress: 1, currentIndex: 3, caption: 'The ledger is written twice' }} template={stage} />
<Story name="Speed2x" args={{ speed: 2 }} template={stage} />
<Story name="LongCaption" args={{ caption: 'The gateway times out after three seconds but has already charged the card, so the retry sends a second request' }} template={stage} />
<Story name="Narrow" template={narrow} />
<Story name="Live (Space, arrows, drag)" parameters={{ layout: 'fullscreen' }} template={c1} />

{#snippet narrow(args: any)}
  <div style="position:relative;width:420px;height:220px;background:var(--vscode-editor-background)"><PlaybackBar {...args} /></div>
{/snippet}

<script lang="ts">
  import { onDestroy } from 'svelte';
  let p1 = $state<SVGPathElement>();
  const player = createPlayer(flow);
  let st = $state.raw<PlaybackState>(player.state);
  const off = player.subscribe((s) => (st = s));
  onDestroy(() => (off(), player.destroy()));
</script>
