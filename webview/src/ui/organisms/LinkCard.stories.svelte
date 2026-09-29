<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import { fn } from 'storybook/test';
  import LinkCard from './LinkCard.svelte';

  const { Story } = defineMeta({
    title: 'Organisms/LinkCard',
    component: LinkCard,
    tags: ['autodocs'],
    args: { url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/401', title: 'HTTP 401', selected: false, onopen: fn() },
  });
</script>

{#snippet c1(args: any)}
<div style="display:grid;gap:10px;width:340px">
      {#each ['1', '2', '3', '4', '5', '6'] as c}
        <div style="height:80px"><LinkCard color={c} url="https://example.com/docs" title={`Preset ${c}`} /></div>
      {/each}
    </div>
{/snippet}


{#snippet template(args: any)}
  <div style="width:340px;height:90px"><LinkCard {...args} /></div>
{/snippet}

<Story name="WithTitle" {template} />
<Story name="NoTitle" args={{ title: undefined }} {template} />
<Story name="InvalidUrl" args={{ url: 'not a url', title: undefined }} {template} />
<Story name="Selected" args={{ selected: true, color: '5' }} {template} />
<Story name="AllColors" template={c1} />
