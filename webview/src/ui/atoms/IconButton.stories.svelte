<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import { fn } from 'storybook/test';
  import IconButton from './IconButton.svelte';
  import Icon, { ICONS, type IconName } from './Icon.svelte';

  const { Story } = defineMeta({
    title: 'Atoms/IconButton',
    component: IconButton,
    tags: ['autodocs'],
    args: { icon: 'sticky', label: 'Sticky', onclick: fn() },
  });
  const names = Object.keys(ICONS) as IconName[];
</script>

{#snippet c1(args: any)}
<div style="display:flex;gap:14px;flex-wrap:wrap;max-width:420px;color:var(--vscode-editor-foreground)">
      {#each names as n}<span title={n}><Icon name={n} size={24} /></span>{/each}
    </div>
{/snippet}


<Story name="IconAndLabel" />
<Story name="IconOnly" args={{ label: undefined, title: 'Add sticky' }} />
<Story name="LabelOnly" args={{ icon: undefined }} />
<Story name="Active" args={{ active: true }} />
<Story name="Disabled" args={{ disabled: true }} />
<Story name="AllIcons" template={c1} />
