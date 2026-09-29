<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import MermaidDiagram from './MermaidDiagram.svelte';

  const { Story } = defineMeta({
    title: 'Atoms/MermaidDiagram',
    component: MermaidDiagram,
    tags: ['autodocs'],
    args: { source: 'flowchart LR\n  A[Request] --> B{Auth?}\n  B -- yes --> C[Handler]\n  B -- no --> D[401]', mode: 'dark' },
    argTypes: { mode: { control: 'radio', options: ['dark', 'light'] } },
  });
</script>

{#snippet template(args: any)}
  <div style="width:480px;height:280px"><MermaidDiagram {...args} /></div>
{/snippet}

<Story name="Flowchart" {template} />
<Story name="Sequence" args={{ source: 'sequenceDiagram\n  Client->>Server: request\n  Server-->>Client: response' }} {template} />
<Story name="Light" args={{ mode: 'light' }} globals={{ theme: 'light' }} {template} />
<Story name="InvalidSource" args={{ source: 'flowchart LR\n  A --> -->' }} {template} />
<Story name="Empty" args={{ source: '' }} {template} />
<Story name="NaturalHeight" args={{ natural: true }} {template} />
