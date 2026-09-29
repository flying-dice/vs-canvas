<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import { fn } from 'storybook/test';
  import ColorSwatch from './ColorSwatch.svelte';

  const { Story } = defineMeta({
    title: 'Atoms/ColorSwatch',
    component: ColorSwatch,
    tags: ['autodocs'],
    args: { color: '1', size: 16, selected: false, onclick: fn() },
  });
</script>

{#snippet c1(args: any)}
<div style="display:flex;gap:8px">
      {#each ['1', '2', '3', '4', '5', '6'] as c}<ColorSwatch color={c} size={18} />{/each}
    </div>
{/snippet}


<Story name="Red" />
<Story name="Selected" args={{ selected: true, color: '4' }} />
<Story name="NoColor" args={{ color: undefined, title: 'No color' }} />
<Story name="Hex" args={{ color: '#ff66aa' }} />
<Story name="AllPresets" template={c1} />
