<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import FlowPacket from './FlowPacket.svelte';
  const { Story } = defineMeta({
    title: 'Atoms/FlowPacket',
    component: FlowPacket,
    tags: ['autodocs'],
    parameters: { docs: { description: { component: 'The signal: the only glowing element in the product.' } } },
  });
  const D = 'M 20 120 C 140 120, 140 40, 260 40 S 380 120, 500 120';
</script>

{#snippet c1(args: any)}
{@render frame(0.45)}
{/snippet}

{#snippet c2(args: any)}
{@render frame(0.02)}
{/snippet}

{#snippet c3(args: any)}
{@render frame(0.6, 0.3)}
{/snippet}

{#snippet c4(args: any)}
<svg width="520" height="160" style="background:var(--vscode-editor-background)">
      <path bind:this={pathEl2} d={D} fill="none" stroke="var(--vscode-descriptionForeground, #888)" stroke-width="2" />
      <FlowPacket path={pathEl2} progress={t} />
    </svg>
{/snippet}


{#snippet frame(progress: number, zoom = 1)}
  <svg width="520" height="160" style="background:var(--vscode-editor-background)">
    <path bind:this={pathEl} d={D} fill="none" stroke="var(--vscode-descriptionForeground, #888)" stroke-width="2" />
    <FlowPacket path={pathEl} {progress} {zoom} />
  </svg>
{/snippet}

<Story name="MidPath" template={c1} />
<Story name="StartFading" template={c2} />
<Story name="ZoomedOut (0.3)" template={c3} />
<Story name="Animated" template={c4} />

<script lang="ts">
  import { onMount } from 'svelte';
  let pathEl = $state<SVGPathElement>();
  let pathEl2 = $state<SVGPathElement>();
  let t = $state(0);
  onMount(() => {
    let raf = 0;
    const start = performance.now();
    const loop = (now: number) => {
      t = ((now - start) % 2400) / 2400;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  });
</script>
