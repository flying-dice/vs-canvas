<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import { fn } from 'storybook/test';
  import ZoomIndicator from './ZoomIndicator.svelte';
  const { Story } = defineMeta({ title: 'Atoms/ZoomIndicator', component: ZoomIndicator, tags: ['autodocs'], args: { zoom: 0.62, onreset: fn() } });
</script>

<Story name="Zoomed out" />
<Story name="Default (100%)" args={{ zoom: 1 }} />
<Story name="Far" args={{ zoom: 0.25 }} />
