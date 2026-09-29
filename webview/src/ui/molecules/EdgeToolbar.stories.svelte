<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import { fn } from 'storybook/test';
  import EdgeToolbar, { endsOf } from './EdgeToolbar.svelte';
  const { Story } = defineMeta({
    title: 'Molecules/EdgeToolbar',
    component: EdgeToolbar,
    tags: ['autodocs'],
    args: { ends: 'end', animated: false, oncolor: fn(), onends: fn(), onrouting: fn(), onlinestyle: fn(), onrelation: fn(), onanimated: fn(), oneditlabel: fn(), ondelete: fn() },
  });
  void endsOf;
</script>

<Story name="Default" />
<Story name="Colored" args={{ color: '5', animated: true }} />
<Story name="NoArrows" args={{ ends: 'none' }} />
<Story name="BothEnds" args={{ ends: 'both' }} />
<Story name="DiagramEdge (relation)" args={{ showEnds: false, relation: 'uml.realization', fromMarker: 'none', toMarker: 'triangle', lineStyle: 'dashed', routing: 'orthogonal' }} />
<Story name="ErdRelation" args={{ showEnds: false, relation: 'erd.one-to-many', fromMarker: 'crow-one', toMarker: 'crow-many', routing: 'orthogonal' }} />
