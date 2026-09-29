<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import EdgeMarkerPreview from './EdgeMarkerPreview.svelte';
  import { EDGE_MARKERS, RELATIONS } from '../../../../src/shared/shapes';
  import { MARKER_NAMES } from '../../lib/shapes/markers';

  const { Story } = defineMeta({
    title: 'Atoms/EdgeMarkerPreview',
    component: EdgeMarkerPreview,
    tags: ['autodocs'],
    args: { fromMarker: 'none', toMarker: 'arrow', lineStyle: 'solid' },
  });
</script>

{#snippet markers(args: any)}
  <div class="grid">
    {#each EDGE_MARKERS as m}
      <span class="cell"><EdgeMarkerPreview toMarker={m} /> <code>to: {MARKER_NAMES[m]}</code></span>
      <span class="cell"><EdgeMarkerPreview fromMarker={m} toMarker="none" /> <code>from: {MARKER_NAMES[m]}</code></span>
    {/each}
  </div>
{/snippet}

{#snippet relations(args: any)}
  <div class="grid">
    {#each RELATIONS as r}
      <span class="cell"><EdgeMarkerPreview fromMarker={r.fromMarker} toMarker={r.toMarker} lineStyle={r.lineStyle} width={96} /> <code>{r.id}</code></span>
    {/each}
  </div>
{/snippet}

{#snippet template(args: any)}
  <EdgeMarkerPreview {...args} width={120} height={24} />
{/snippet}

<Story name="Default" {template} />
<Story name="AllMarkers (both ends)" template={markers} />
<Story name="AllRelations" template={relations} />
<Story name="Dashed" args={{ toMarker: 'triangle', lineStyle: 'dashed' }} {template} />
<Story name="Dotted" args={{ toMarker: 'arrow', lineStyle: 'dotted' }} {template} />

<style>
  .grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(260px, 1fr));
    gap: 10px 32px;
    color: var(--vscode-editor-foreground, #ccc);
    font-family: var(--vscode-font-family, system-ui, sans-serif);
  }
  .cell {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 12px;
  }
  code {
    color: var(--vscode-descriptionForeground, #9d9d9d);
    font-family: var(--vscode-editor-font-family, monospace);
  }
</style>
