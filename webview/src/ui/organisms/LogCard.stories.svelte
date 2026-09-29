<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import { fn } from 'storybook/test';
  import LogCard from './LogCard.svelte';
  import { stackTrace } from '../storyData';

  const { Story } = defineMeta({
    title: 'Organisms/LogCard',
    component: LogCard,
    tags: ['autodocs'],
    args: { text: stackTrace, title: 'Stack trace, order 812', errorLines: [1, 3, 6], selected: false, onframeclick: fn() },
  });
  const py = [
    'Traceback (most recent call last):',
    '  File "app/payments/retry.py", line 48, in retry_charge',
    '    return charge(order)',
    '  File "app/payments/charge.py", line 31, in charge',
    '    gateway.post("/charges", body)',
    'TimeoutError: gateway did not answer in 3s',
  ].join('\n');
  const go = [
    'panic: charge created twice',
    'goroutine 7 [running]:',
    'payments.Charge(0xc000123)',
    '\t/srv/payments/charge.go:48 +0x1d',
    'main.main()',
    '\t/srv/main.go:21 +0x5a',
  ].join('\n');
  const long = Array.from({ length: 40 }, (_, i) => `[12:0${i % 10}:${10 + i}] info  request ${i} handled in ${20 + i}ms (src/api/orders.ts:57:5)`).join('\n');
</script>

{#snippet template(args: any)}
  <div style="width:520px;height:232px"><LogCard {...args} /></div>
{/snippet}

<Story name="StackTrace" {template} />
<Story name="Selected" args={{ selected: true }} {template} />
<Story name="NoErrors" args={{ errorLines: [] }} {template} />
<Story name="Python" args={{ text: py, errorLines: [6], title: 'Traceback' }} {template} />
<Story name="Go" args={{ text: go, errorLines: [1], title: 'Panic' }} {template} />
<Story name="LongLogScrolls" args={{ text: long, errorLines: [], title: 'Server log' }} {template} />
<Story name="Untitled" args={{ title: undefined }} {template} />
