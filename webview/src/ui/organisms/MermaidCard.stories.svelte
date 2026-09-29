<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import MermaidCard from './MermaidCard.svelte';

  const { Story } = defineMeta({
    title: 'Organisms/MermaidCard',
    component: MermaidCard,
    tags: ['autodocs'],
    args: { source: 'flowchart LR\n  A[Request] --> B{Auth?}\n  B -- yes --> C[Handler]\n  B -- no --> D[401]', mode: 'dark', selected: false },
  });
</script>

{#snippet c1(args: any)}
<div style="display:grid;grid-template-columns:repeat(3,260px);gap:12px">
      {#each ['1', '2', '3', '4', '5', '6'] as c}
        <div style="height:170px"><MermaidCard color={c} title={`Preset ${c}`} source="flowchart LR\n  A --> B" /></div>
      {/each}
    </div>
{/snippet}


{#snippet template(args: any)}
  <div style="width:480px;height:320px"><MermaidCard {...args} /></div>
{/snippet}

<Story name="Flowchart" args={{ title: 'Pipeline' }} {template} />
<Story name="NoTitle" {template} />
<Story name="Sequence" args={{ title: 'Sequence', color: '5', source: 'sequenceDiagram\n  Client->>Server: request\n  Server-->>Client: response' }} {template} />
<Story name="Light" args={{ mode: 'light', title: 'Light mode' }} globals={{ theme: 'light' }} {template} />
<Story name="InvalidSource" args={{ title: 'Broken', source: 'flowchart LR\n  A --> -->' }} {template} />
<Story name="Empty" args={{ source: '' }} {template} />
<Story name="Selected" args={{ selected: true, color: '6', title: 'Selected' }} {template} />
<Story name="Editing" args={{ editing: true, title: 'Editing' }} {template} />
<Story name="AllColors" template={c1} />
