<script lang="ts">
  import type { Node, NodeProps } from '@xyflow/svelte';
  import type { TextNode } from '../../../src/shared/protocol';
  import type { FlowData } from '../lib/flow';
  import { post } from '../lib/vscode';
  import { useEditRequest } from '../lib/ui.svelte';
  import StickyCard from '../ui/organisms/StickyCard.svelte';
  import Resizer from './Resizer.svelte';
  import SideHandles from './SideHandles.svelte';

  let { id, data, selected }: NodeProps<Node<FlowData, 'sticky'>> = $props();
  const node = $derived(data.node as TextNode);
  let editing = $state(false);
  useEditRequest(() => id, () => (editing = true));
</script>

<Resizer {id} {selected} minWidth={100} minHeight={80} />
<StickyCard
  text={node.text}
  color={node.color}
  {selected}
  bind:editing
  oncommit={(text) => post({ type: 'updateNode', id, patch: { text } })}
/>
<SideHandles />
