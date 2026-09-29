<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import GroupFrame from './GroupFrame.svelte';

  const { Story } = defineMeta({
    title: 'Organisms/GroupFrame',
    component: GroupFrame,
    tags: ['autodocs'],
    args: { label: 'Request path', selected: false },
  });
</script>

{#snippet c1(args: any)}
<div style="display:grid;grid-template-columns:repeat(3,220px);gap:14px">
      {#each ['1', '2', '3', '4', '5', '6'] as c}
        <div style="height:130px"><GroupFrame color={c} label={`Preset ${c}`} /></div>
      {/each}
    </div>
{/snippet}


{#snippet template(args: any)}
  <div style="width:400px;height:240px"><GroupFrame {...args} /></div>
{/snippet}

<Story name="Neutral" {template} />
<Story name="NoLabel" args={{ label: undefined }} {template} />
<Story name="LongLabel" args={{ label: 'A very long group label that has to be truncated with an ellipsis' }} {template} />
<Story name="Selected" args={{ selected: true, color: '5' }} {template} />
<Story name="AllColors" template={c1} />
