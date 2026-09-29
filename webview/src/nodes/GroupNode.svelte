<script lang="ts">
  import type { Node, NodeProps } from '@xyflow/svelte';
  import type { GroupNode } from '../../../src/shared/protocol';
  import { shapeById } from '../../../src/shared/shapes';
  import type { FlowData } from '../lib/flow';
  import { minSizeOfShape } from '../lib/shapes/renderers';
  import GroupFrame from '../ui/organisms/GroupFrame.svelte';
  import FrameShape from '../ui/organisms/FrameShape.svelte';
  import Resizer from './Resizer.svelte';

  let { id, data, selected, width, height }: NodeProps<Node<FlowData, 'group'>> = $props();
  const node = $derived(data.node as GroupNode);
  const frame = $derived(shapeById(node.shape)?.frame ? node.shape : undefined);
  const min = $derived(frame ? minSizeOfShape(frame) : ([120, 80] as [number, number]));
</script>

<Resizer {id} {selected} minWidth={min[0]} minHeight={min[1]} />
{#if frame}
  <FrameShape
    shape={frame}
    label={node.label}
    sublabel={node.sublabel}
    color={node.color}
    {selected}
    width={width ?? node.width}
    height={height ?? node.height}
  />
{:else}
  <GroupFrame label={node.label} color={node.color} {selected} />
{/if}
