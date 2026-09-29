<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import { fn } from 'storybook/test';
  import FindingCard from './FindingCard.svelte';

  const { Story } = defineMeta({
    title: 'Organisms/FindingCard',
    component: FindingCard,
    tags: ['autodocs'],
    args: {
      title: 'Retry on timeout re-sends the charge',
      text: 'The gateway timed out at 3s but had already charged. `retryCharge` sends a second request with no idempotency key.',
      findingKind: 'hypothesis',
      status: 'investigating',
      selected: false,
      onstatuschange: fn(),
      oncommit: fn(),
      ontitlecommit: fn(),
    },
  });
  const statuses = ['open', 'investigating', 'confirmed', 'ruled-out'] as const;
  const kinds = ['hypothesis', 'evidence', 'question', 'conclusion'] as const;
</script>

{#snippet c1(args: any)}
<div style="display:grid;grid-template-columns:repeat(2,336px);gap:24px">
      {#each statuses as s}
        <div style="height:168px"><FindingCard status={s} title={s === 'ruled-out' ? 'Client double-submits' : 'Retry re-sends the charge'} text="The pay button is disabled after the first click." /></div>
      {/each}
    </div>
{/snippet}

{#snippet c2(args: any)}
<div style="display:grid;grid-template-columns:repeat(2,336px);gap:24px">
      {#each kinds as k}
        <div style="height:152px"><FindingCard findingKind={k} status="open" title={`A ${k}`} text="Short supporting text." /></div>
      {/each}
    </div>
{/snippet}

{#snippet c3(args: any)}
<div style="width:336px;height:184px">
      <FindingCard title="Does the ledger dedupe entries?" findingKind="question" text="Two rows exist for order 812." status={interactive} onstatuschange={(s) => (interactive = s)} />
    </div>
{/snippet}


{#snippet template(args: any)}
  <div style="width:336px;height:184px"><FindingCard {...args} /></div>
{/snippet}

<Story name="Open" args={{ status: 'open' }} {template} />
<Story name="Investigating" args={{ status: 'investigating' }} {template} />
<Story name="Confirmed" args={{ status: 'confirmed' }} {template} />
<Story name="RuledOut" args={{ status: 'ruled-out', title: 'Client double-submits' }} {template} />
<Story name="Selected" args={{ selected: true }} {template} />
<Story name="Editing" args={{ editing: true }} {template} />
<Story name="EmptyBody" args={{ text: '', status: 'open' }} {template} />
<Story name="LongTitle" args={{ title: 'The retry path in the payments service re-sends the charge request without an idempotency key when the gateway times out' }} {template} />
<Story name="OpenWithColor" args={{ status: 'open', color: '1' }} {template} />

<Story name="AllStatuses" parameters={{ layout: 'padded' }} template={c1} />

<Story name="AllKinds" parameters={{ layout: 'padded' }} template={c2} />

<Story name="ChangeStatus (interactive)" template={c3} />

<script lang="ts">
  let interactive = $state<'open' | 'investigating' | 'confirmed' | 'ruled-out'>('investigating');
</script>
