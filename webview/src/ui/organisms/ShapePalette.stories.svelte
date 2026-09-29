<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import { fn } from 'storybook/test';
  import ShapePalette from './ShapePalette.svelte';

  const { Story } = defineMeta({
    title: 'Organisms/ShapePalette',
    component: ShapePalette,
    tags: ['autodocs'],
    parameters: { layout: 'fullscreen' },
    args: { onadd: fn(), onclose: fn() },
  });
</script>

{#snippet template(args: any)}
  <div style="position:relative;width:100%;height:640px;background:var(--vscode-editor-background)">
    <ShapePalette {...args} />
  </div>
{/snippet}

<Story name="Default" {template} />
<Story
  name="Searching (type 'decision')"
  {template}
  play={async ({ canvasElement }) => {
    const input = canvasElement.querySelector('input');
    if (input) {
      input.value = 'decision';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }}
/>
<Story
  name="Searching (c4 container)"
  {template}
  play={async ({ canvasElement }) => {
    const input = canvasElement.querySelector('input');
    if (input) {
      input.value = 'c4 container';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }}
/>
