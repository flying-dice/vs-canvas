<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import { fn } from 'storybook/test';
  import NodeToolbar from './NodeToolbar.svelte';
  const code = [
    { id: 'open', label: 'Open in editor', icon: 'external', shortcut: '⌘O' },
    { id: 'callers', label: 'Trace callers', icon: 'callers' },
    { id: 'callees', label: 'Trace callees', icon: 'callees' },
    { id: 'more', label: 'Show more lines', icon: 'moreLines' },
    { id: 'dup', label: 'Duplicate', icon: 'duplicate', shortcut: '⌘D' },
    { id: 'del', label: 'Delete', icon: 'trash', shortcut: '⌫', danger: true },
  ] as const;
  const { Story } = defineMeta({
    title: 'Molecules/NodeToolbar',
    component: NodeToolbar,
    tags: ['autodocs'],
    args: { color: undefined, actions: [...code], oncolor: fn(), onaction: fn() },
  });
</script>

<Story name="CodeNode" />
<Story name="WithColor" args={{ color: '1' }} />
<Story name="ColorsOnly" args={{ actions: [] }} />
<Story name="ActionsOnly" args={{ showColors: false, actions: [{ id: 'layout', label: 'Fix layout', icon: 'layout' }, { id: 'del', label: 'Delete', icon: 'trash', danger: true }] }} />
<Story name="Disabled action" args={{ actions: [{ id: 'callers', label: 'Trace callers', icon: 'callers', disabled: true }, { id: 'dup', label: 'Duplicate', icon: 'duplicate' }] }} />
