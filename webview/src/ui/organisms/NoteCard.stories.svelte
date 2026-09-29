<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import NoteCard from './NoteCard.svelte';

  const { Story } = defineMeta({
    title: 'Organisms/NoteCard',
    component: NoteCard,
    tags: ['autodocs'],
    args: { selected: false, text: 'Note' },
  });

  const long = `## Overview

The extension hosts a local **MCP server**. An LLM calls tools which mutate the canvas document; the document is pushed to the webview.

1. Tool call arrives over streamable HTTP
2. Store applies the change
3. Webview receives a \`document\` message

\`\`\`ts
panel.webview.postMessage({ type: 'document', canvas, code });
\`\`\`

- Edges are anchored to line numbers
- Highlights carry a color and label

> Keep notes short; link to code nodes instead.
`;
  const withMermaid = `Request flow:

\`\`\`mermaid
sequenceDiagram
  Client->>Server: POST /mcp
  Server-->>Client: 200
\`\`\`

Then the **store** updates.`;
</script>

{#snippet c1(args: any)}
<div style="display:grid;grid-template-columns:repeat(3,240px);gap:12px">
      {#each ['1', '2', '3', '4', '5', '6'] as c}
        <div style="height:110px"><NoteCard color={c} title={`Color ${c}`} text="Accent from preset." /></div>
      {/each}
    </div>
{/snippet}


<!-- The card fills its parent (as inside a resizable node), so give it a box. -->
{#snippet template(args: any)}
  <div style="width:360px;height:240px"><NoteCard {...args} /></div>
{/snippet}

<Story name="Short" args={{ title: 'Entry point', text: 'Everything starts in `activate()`.' }} {template} />
<Story name="NoTitle" args={{ text: 'A note with **no title**, using the default accent.' }} {template} />
<Story name="Long" args={{ title: 'How requests flow', color: '5', text: long }} {template} />
<Story name="WithMermaidFence" args={{ title: 'Diagram in markdown', color: '6', text: withMermaid }} {template} />
<Story name="Empty" args={{ text: '' }} {template} />
<Story name="Editing" args={{ title: 'Editing', text: '# Edit me\n\nCtrl/Cmd+Enter commits, Esc cancels.', editing: true }} {template} />
<Story name="Selected" args={{ selected: true, title: 'Selected', color: '6', text: 'Focus border shown.' }} {template} />
<Story name="AllColors" template={c1} />
