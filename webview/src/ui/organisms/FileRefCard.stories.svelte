<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import { fn } from 'storybook/test';
  import FileRefCard from './FileRefCard.svelte';

  const { Story } = defineMeta({
    title: 'Organisms/FileRefCard',
    component: FileRefCard,
    tags: ['autodocs'],
    args: { file: 'src/auth/index.ts', selected: false, onopen: fn() },
  });
</script>

{#snippet c1(args: any)}
<div style="display:grid;gap:10px">
      {#each ['1', '2', '3', '4', '5', '6'] as c}
        <FileRefCard color={c} file="src/auth/index.ts" lines={[1, 40]} />
      {/each}
    </div>
{/snippet}


<Story name="PathOnly" />
<Story name="WithLineRange" args={{ lines: [10, 42] }} />
<Story name="SingleLine" args={{ lines: [7, 7] }} />
<Story name="WithTitle" args={{ lines: [1, 40], title: 'authenticate()' }} />
<Story name="LongPath" args={{ file: 'packages/extension/src/server/transports/streamable-http/session-manager.ts', title: 'Session lifecycle' }} />
<Story name="Selected" args={{ selected: true, color: '4' }} />
<Story name="AllColors" template={c1} />
