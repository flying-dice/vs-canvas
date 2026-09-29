<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import DataChip from './DataChip.svelte';
  const { Story } = defineMeta({ title: 'Molecules/DataChip', component: DataChip, tags: ['autodocs'], args: { text: 'Order{ id: 812, total: 49.00 }' } });
  const seq = ['{ cartId }', 'Order{ id: 812, total: 49.00 }', "Charge{ status: 'pending' }", 'LedgerEntry{ … } × 2'];
</script>

{#snippet c1(args: any)}
<div style="display:flex;flex-direction:column;gap:12px;align-items:flex-start;min-height:80px">
      <button onclick={() => (i = (i + 1) % seq.length)}>Next payload</button>
      <DataChip text={seq[i]} />
    </div>
{/snippet}


<Story name="Default" />
<Story name="Long" args={{ text: 'Order{ id: 812, total: 49.00, items: [{ sku: "A-1", qty: 2 }, { sku: "B-9", qty: 1 }] }' }} />
<Story name="CrossfadeOnChange (click)" template={c1} />

<script lang="ts">
  let i = $state(0);
</script>
