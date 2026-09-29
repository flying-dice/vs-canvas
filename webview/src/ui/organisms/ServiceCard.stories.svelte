<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import { fn } from 'storybook/test';
  import ServiceCard from './ServiceCard.svelte';
  import { snippets } from '../storyData';

  const { Story } = defineMeta({
    title: 'Organisms/ServiceCard',
    component: ServiceCard,
    tags: ['autodocs'],
    argTypes: { lod: { control: 'inline-radio', options: ['far', 'mid', 'near'] } },
    args: {
      title: 'Payments',
      description: 'Charges cards through the gateway, retries on timeout and writes the ledger.',
      tags: ['gateway', 'retry', 'ledger', 'pci'],
      entryPoints: [
        { file: 'src/payments/charge.ts', lines: [28, 34], label: 'chargeCard' },
        { file: 'src/payments/retry.ts', lines: [44, 51], label: 'retryCharge' },
        { file: 'src/payments/refund.ts', lines: [10, 12], label: 'refund' },
      ],
      snippets: snippets(),
      canvas: 'canvases/payments.canvas.json',
      lod: 'mid',
      selected: false,
      onentryclick: fn(),
      onopencanvas: fn(),
    },
  });
  const lods = ['far', 'mid', 'near'] as const;
</script>

{#snippet c1(args: any)}
<div style="display:flex;gap:24px">
      {#each lods as l}
        <div style="width:360px;height:280px"><ServiceCard lod={l} title="Payments" description="Charges cards through the gateway, retries on timeout and writes the ledger." tags={['gateway', 'retry', 'ledger', 'pci']} entryPoints={[{ file: 'src/payments/charge.ts', lines: [28, 34], label: 'chargeCard' }, { file: 'src/payments/retry.ts', lines: [44, 51], label: 'retryCharge' }]} snippets={snippets()} canvas="canvases/p.canvas.json" /></div>
      {/each}
    </div>
{/snippet}

{#snippet c2(args: any)}
<div style="display:flex;flex-direction:column;gap:12px;align-items:flex-start">
      <div style="display:flex;gap:8px">
        {#each lods as l}<button onclick={() => (cur = l)}>{l}</button>{/each}
      </div>
      <div style="width:360px;height:280px"><ServiceCard lod={cur} title="Payments" description="Charges cards through the gateway." tags={['gateway', 'ledger']} entryPoints={[{ file: 'src/payments/charge.ts', lines: [28, 34], label: 'chargeCard' }]} snippets={snippets()} canvas="c.canvas.json" /></div>
    </div>
{/snippet}


{#snippet template(args: any)}
  <div style="width:360px;height:280px"><ServiceCard {...args} /></div>
{/snippet}

<Story name="Far" args={{ lod: 'far' }} {template} />
<Story name="Mid" args={{ lod: 'mid' }} {template} />
<Story name="Near" args={{ lod: 'near' }} {template} />
<Story name="NearWithoutCanvas" args={{ lod: 'near', canvas: undefined }} {template} />
<Story name="MidSelected" args={{ selected: true }} {template} />
<Story name="LongTitleFar" args={{ lod: 'far', title: 'Notification delivery and preferences' }} {template} />
<Story name="ManyEntryPoints" args={{ entryPoints: Array.from({ length: 7 }, (_, i) => ({ file: `src/svc/handler${i}.ts`, lines: [10, 20], label: `handler${i}` })), snippets: [] }} {template} />
<Story name="Minimal" args={{ description: '', tags: [], entryPoints: [], canvas: undefined }} {template} />
<Story name="AllLevels" parameters={{ layout: 'padded' }} template={c1} />
<Story name="CrossfadeDemo (click)" template={c2} />

<script lang="ts">
  let cur = $state<'far' | 'mid' | 'near'>('mid');
</script>
