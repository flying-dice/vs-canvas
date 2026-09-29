<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import { fn } from 'storybook/test';
  import EditableText from './EditableText.svelte';

  const { Story } = defineMeta({
    title: 'Molecules/EditableText',
    component: EditableText,
    tags: ['autodocs'],
    args: { value: 'Double-click me to edit', editing: false, mono: false, oncommit: fn() },
  });
</script>

<!-- View mode renders the children snippet; double-click switches to a textarea (blur / Ctrl+Enter commit, Esc cancels). -->
{#snippet template(args: any)}
  <div style="width:280px;height:120px">
    <EditableText {...args}>
      <div style="padding:8px 10px;white-space:pre-wrap;font-family:var(--vscode-font-family)">{args.value}</div>
    </EditableText>
  </div>
{/snippet}

<Story name="View" {template} />
<Story name="Editing" args={{ editing: true }} {template} />
<Story name="Monospace" args={{ editing: true, mono: true, value: 'flowchart LR\n  A --> B' }} {template} />
<Story name="EmptyPlaceholder" args={{ editing: true, value: '' }} {template} />
