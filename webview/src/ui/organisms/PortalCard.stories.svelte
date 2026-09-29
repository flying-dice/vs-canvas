<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import { fn } from 'storybook/test';
  import PortalCard from './PortalCard.svelte';

  const r = (x: number, y: number, width: number, height: number, type = 'file', color?: string) => ({ x, y, width, height, type, color });
  const rects = [
    r(0, 0, 900, 520, 'group', '6'),
    r(40, 60, 240, 160), r(340, 60, 240, 160, 'file', '1'), r(640, 60, 220, 160),
    r(40, 300, 240, 160, 'text'), r(340, 300, 240, 160, 'file', '3'), r(640, 300, 220, 160, 'text', '4'),
    r(1000, 60, 240, 160), r(1000, 300, 240, 160, 'text', '2'),
  ];

  const { Story } = defineMeta({
    title: 'Organisms/PortalCard',
    component: PortalCard,
    tags: ['autodocs'],
    args: { preview: { title: 'Payments internals', kind: 'map', nodeCount: 9, rects }, selected: false, onopen: fn() },
  });
</script>

{#snippet template(args: any)}
  <div style="width:336px;height:256px"><PortalCard {...args} /></div>
{/snippet}

<Story name="Map" {template} />
<Story name="Selected" args={{ selected: true }} {template} />
<Story name="Investigation" args={{ preview: { title: 'Double charge', kind: 'investigation', nodeCount: 7, rects: rects.slice(1, 6) } }} {template} />
<Story name="Flow" args={{ preview: { title: 'Order to ledger', kind: 'flow', nodeCount: 5, rects: [r(0, 0, 400, 200), r(520, 0, 400, 200), r(1040, 0, 400, 200, 'file', '5'), r(1560, 0, 400, 200), r(2080, 0, 400, 200)] } }} {template} />
<Story name="NodeTitleOverride" args={{ title: 'Payments (drill down)' }} {template} />
<Story name="Empty" args={{ preview: { title: 'New canvas', nodeCount: 0, rects: [] } }} {template} />
<Story name="Error" args={{ preview: { title: 'Payments', nodeCount: 0, rects: [], error: 'File not found: canvases/payments.canvas.json' } }} {template} />
