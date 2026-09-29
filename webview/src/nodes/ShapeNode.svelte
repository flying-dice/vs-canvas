<script lang="ts">
  import type { Node, NodeProps } from '@xyflow/svelte';
  import type { TextNode } from '../../../src/shared/protocol';
  import { shapeById } from '../../../src/shared/shapes';
  import type { FlowData } from '../lib/flow';
  import { post } from '../lib/vscode';
  import { useEditRequest } from '../lib/ui.svelte';
  import { useLod } from '../lib/lod.svelte';
  import { minSizeOfShape } from '../lib/shapes/renderers';
  import ShapeCard from '../ui/organisms/ShapeCard.svelte';
  import Resizer from './Resizer.svelte';
  import SideHandles from './SideHandles.svelte';

  // A diagram shape (text node, variant 'shape'). Four side handles sit on the bounding-box midpoints, which are
  // also the outline midpoints of every shape (diamonds, circles, pills...).
  let { id, data, selected, width, height }: NodeProps<Node<FlowData, 'shape'>> = $props();
  const node = $derived(data.node as TextNode);
  const def = $derived(shapeById(node.shape));
  const min = $derived(minSizeOfShape(node.shape));
  const lod = useLod();
  let editing = $state<string | null>(null);
  useEditRequest(() => id, () => (editing = 'text'));
</script>

<Resizer {id} {selected} minWidth={min[0]} minHeight={min[1]} keepAspect={!!def?.keepAspect} />
<ShapeCard
  shape={node.shape ?? 'flowchart.process'}
  text={node.text}
  fields={node.fields}
  color={node.color}
  {selected}
  width={width ?? node.width}
  height={height ?? node.height}
  lod={lod.current}
  bind:editing
  oncommit={(text) => post({ type: 'updateNode', id, patch: { text } })}
  onfields={(fields) => post({ type: 'updateNode', id, patch: { fields } })}
/>
<SideHandles />
