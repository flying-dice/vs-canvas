<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import { fn } from 'storybook/test';
  import CommandBar from './CommandBar.svelte';
  const { Story } = defineMeta({
    title: 'Organisms/CommandBar',
    component: CommandBar,
    tags: ['autodocs'],
    parameters: { layout: 'fullscreen' },
    args: {
      open: true,
      onselect: fn(),
      nodes: [
        { id: 'a', title: 'Retry on timeout', path: 'src/payments/retry.ts', icon: 'code', text: 'retryCharge' },
        { id: 'b', title: 'Charge the card', path: 'src/payments/charge.ts', icon: 'code' },
        { id: 'c', title: 'Client double-submits', icon: 'hypothesis' },
        { id: 'd', title: 'Stack trace, order 812', icon: 'log' },
        { id: 'e', title: 'Payments', icon: 'service' },
      ],
      flows: [{ id: 'order', title: 'Order to ledger', description: 'After the shopper clicks pay' }, { id: 'refund', title: 'Refund' }],
      canvases: [{ path: 'canvases/acme-shop.canvas.json', title: 'acme-shop map' }, { path: 'canvases/payments.canvas.json', title: 'Payments internals' }],
      actions: [
        { id: 'fix', label: 'Fix layout', icon: 'layout' },
        { id: 'add', label: 'Add current file', icon: 'plus', shortcut: '⌘⇧A' },
        { id: 'pin', label: 'Pin this map', icon: 'map' },
      ],
    },
  });
</script>

{#snippet stage(args: any)}
  <div style="position:relative;width:100%;height:480px;background:var(--vscode-editor-background)"><CommandBar {...args} /></div>
{/snippet}

<Story name="Empty query (all groups)" template={stage} />
<Story name="Searching 'pay'" template={stage} play={async ({ canvasElement }) => {
  const i = canvasElement.querySelector('input');
  if (i) { i.value = 'pay'; i.dispatchEvent(new Event('input', { bubbles: true })); }
}} />
<Story name="No results" template={stage} play={async ({ canvasElement }) => {
  const i = canvasElement.querySelector('input');
  if (i) { i.value = 'zzzq'; i.dispatchEvent(new Event('input', { bubbles: true })); }
}} />
