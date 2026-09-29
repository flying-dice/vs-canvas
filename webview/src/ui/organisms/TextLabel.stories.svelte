<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import TextLabel from './TextLabel.svelte';

  const { Story } = defineMeta({
    title: 'Organisms/TextLabel',
    component: TextLabel,
    tags: ['autodocs'],
    args: { text: '# Server walkthrough', selected: false },
  });
</script>

{#snippet c1(args: any)}
<div style="display:grid;gap:4px;width:360px">
      {#each ['1', '2', '3', '4', '5', '6'] as c}
        <div style="height:44px"><TextLabel color={c} text={`## Preset ${c}`} /></div>
      {/each}
    </div>
{/snippet}


{#snippet template(args: any)}
  <div style="width:420px;height:90px"><TextLabel {...args} /></div>
{/snippet}

<Story name="Heading" {template} />
<Story name="Paragraph" args={{ text: 'Free text with **bold**, *italic* and `code`.' }} {template} />
<Story name="Selected" args={{ selected: true }} {template} />
<Story name="Editing" args={{ editing: true, text: '## Editing' }} {template} />
<Story name="Empty" args={{ text: '' }} {template} />
<Story name="AllColors" template={c1} />
