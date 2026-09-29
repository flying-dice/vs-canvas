<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import StickyCard from './StickyCard.svelte';

  const { Story } = defineMeta({
    title: 'Organisms/StickyCard',
    component: StickyCard,
    tags: ['autodocs'],
    args: { text: 'Remember to rate-limit this endpoint', color: '3', selected: false },
  });
</script>

{#snippet c1(args: any)}
<div style="display:grid;grid-template-columns:repeat(3,180px);gap:14px">
      {#each ['1', '2', '3', '4', '5', '6'] as c}
        <div style="height:120px"><StickyCard color={c} text={`Preset ${c}`} /></div>
      {/each}
    </div>
{/snippet}


{#snippet template(args: any)}
  <div style="width:220px;height:180px"><StickyCard {...args} /></div>
{/snippet}

<Story name="Yellow" {template} />
<Story name="Empty" args={{ text: '' }} {template} />
<Story name="LongText" args={{ text: 'A much longer sticky note that keeps going and going to show how text wraps and is clipped when it exceeds the card height. '.repeat(3) }} {template} />
<Story name="Selected" args={{ selected: true }} {template} />
<Story name="Editing" args={{ editing: true, text: 'Edit me\nCtrl/Cmd+Enter commits' }} {template} />
<Story name="HexColor" args={{ color: '#ff66aa' }} {template} />
<Story name="AllColors" template={c1} />
