<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import HighlightPill from './HighlightPill.svelte';

  const { Story } = defineMeta({
    title: 'Atoms/HighlightPill',
    component: HighlightPill,
    tags: ['autodocs'],
    args: { color: '3', label: 'entry point' },
    argTypes: { color: { control: 'select', options: ['1', '2', '3', '4', '5', '6', '#ff66aa'] } },
  });
</script>

<!-- The pill is absolutely positioned at the right of its row, so give it a relative box. -->
{#snippet template(args: any)}
  <div style="position:relative;width:260px;height:18px;border:1px dashed var(--vscode-editorWidget-border)">
    <HighlightPill {...args} />
  </div>
{/snippet}

<Story name="Yellow" args={{ color: '3' }} {template} />
<Story name="Red" args={{ color: '1', label: 'bug here' }} {template} />
<Story name="Orange" args={{ color: '2', label: 'TODO' }} {template} />
<Story name="Green" args={{ color: '4', label: 'happy path' }} {template} />
<Story name="Cyan" args={{ color: '5', label: 'reads state' }} {template} />
<Story name="Purple" args={{ color: '6', label: 'side effect' }} {template} />
<Story name="Hex" args={{ color: '#ff66aa', label: 'custom' }} {template} />
