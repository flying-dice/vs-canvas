<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import { fn } from 'storybook/test';
  import type { ResolvedCode } from '../../../../src/shared/protocol';
  import DiffCard from './DiffCard.svelte';
  import { tokenizeAll } from '../storyData';

  const rc = (file: string, lines: string[], language = 'json'): ResolvedCode => ({
    absPath: `/demo/${file}`, language, firstLine: 1, lines, totalLines: lines.length,
  });
  const json0 = ['{', '  "id": 812,', '  "status": "pending",', '  "items": [', '    { "sku": "A-1", "qty": 2 },', '    { "sku": "B-7", "qty": 1 }', '  ],', '  "total": 4200', '}'];
  const json1 = ['{', '  "id": 812,', '  "status": "paid",', '  "items": [', '    { "sku": "A-1", "qty": 2 },', '    { "sku": "B-7", "qty": 1 }', '  ],', '  "total": 4200,', '  "chargeId": "ch_91x"', '}'];
  const ts0 = ['export async function retryCharge(order: Order, attempt = 1) {', '  try {', '    return await charge(order);', '  } catch (err) {', '    throw err;', '  }', '}'];
  const ts1 = ['export async function retryCharge(order: Order, attempt = 1) {', '  try {', '    return await charge(order);', '  } catch (err) {', '    if (attempt >= 3) throw err;', '    return retryCharge(order, attempt + 1);', '  }', '}'];
  const big0 = Array.from({ length: 60 }, (_, i) => `  "field${i}": ${i},`);
  const big1 = big0.slice();
  big1[8] = '  "field8": "changed",';
  big1[44] = '  "field44": null,';

  const { Story } = defineMeta({
    title: 'Organisms/DiffCard',
    component: DiffCard,
    tags: ['autodocs'],
    args: {
      leftPath: 'data/order.0.json', rightPath: 'data/order.1.json',
      left: rc('order.0.json', json0), right: rc('order.1.json', json1),
      leftTokens: null, rightTokens: null, selected: false, lit: false, lod: 'near', onlineclick: fn(),
    },
  });
</script>

{#snippet template(args: any)}
  <div style="width:560px;height:280px"><DiffCard {...args} /></div>
{/snippet}

<Story name="JsonChange" {template} />
<Story name="Selected" args={{ selected: true }} {template} />
<Story name="Lit" args={{ lit: true }} {template} />
<Story
  name="CodeChange"
  args={{
    leftPath: 'src/retry.old.ts', rightPath: 'src/retry.ts', title: 'Retry with backoff',
    left: rc('retry.old.ts', ts0, 'typescript'), right: rc('retry.ts', ts1, 'typescript'),
    leftTokens: tokenizeAll(ts0), rightTokens: tokenizeAll(ts1),
  }}
  {template}
/>
<Story name="FoldedLongFile" args={{ left: rc('big.0.json', big0), right: rc('big.1.json', big1) }} {template} />
<Story name="Identical" args={{ right: rc('order.1.json', json0) }} {template} />
<Story name="ErrorMissingFile" args={{ right: { ...rc('order.1.json', []), error: 'File not found' } }} {template} />
<Story name="FarLod" args={{ lod: 'far' }} {template} />
<Story name="MidLod" args={{ lod: 'mid' }} {template} />
