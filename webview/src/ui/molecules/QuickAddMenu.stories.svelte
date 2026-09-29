<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import { fn } from 'storybook/test';
  import QuickAddMenu from './QuickAddMenu.svelte';
  const { Story } = defineMeta({
    title: 'Molecules/QuickAddMenu',
    component: QuickAddMenu,
    tags: ['autodocs'],
    parameters: { layout: 'fullscreen' },
    args: { x: 48, y: 32, onselect: fn(), onclose: fn() },
  });
</script>

{#snippet stage(args: any)}
  <div style="position:relative;width:100%;height:440px;background:var(--vscode-editor-background)"><QuickAddMenu {...args} /></div>
{/snippet}

<Story name="Default" template={stage} />
<Story name="NearRightEdge (flips inside)" args={{ x: 900, y: 300 }} template={stage} />
<Story name="Filtered (type 'log')" template={stage} play={async ({ canvasElement }) => {
  const input = canvasElement.querySelector('input');
  if (input) { input.value = 'log'; input.dispatchEvent(new Event('input', { bubbles: true })); }
}} />
<Story name="FewItems" args={{ items: [{ id: 'sticky', label: 'Sticky', hint: 'A short coloured note', icon: 'sticky' }, { id: 'code', label: 'Code file…', hint: 'Pick a file', icon: 'code' }] }} template={stage} />
