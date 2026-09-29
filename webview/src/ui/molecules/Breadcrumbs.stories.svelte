<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import { fn } from 'storybook/test';
  import Breadcrumbs from './Breadcrumbs.svelte';
  const c = (t: string) => ({ path: `canvases/${t.toLowerCase().replace(/ /g, '-')}.canvas.json`, title: t });
  const { Story } = defineMeta({
    title: 'Molecules/Breadcrumbs',
    component: Breadcrumbs,
    tags: ['autodocs'],
    args: { trail: [c('acme-shop'), c('Payments')], onnavigate: fn() },
  });
</script>

<Story name="TwoLevels" />
<Story name="ThreeLevels" args={{ trail: [c('acme-shop'), c('Payments'), c('Retry internals')] }} />
<Story name="Collapsed" args={{ trail: [c('acme-shop'), c('Commerce'), c('Payments'), c('Retry'), c('Backoff'), c('Jitter')] }} />
<Story name="LongTitles" args={{ trail: [c('acme-shop architecture overview for new joiners'), c('Payments and the ledger, including refunds')] }} />
<Story name="SingleCanvas (hidden)" args={{ trail: [c('acme-shop')] }} />
