<script lang="ts">
  import type { Node, NodeProps } from '@xyflow/svelte';
  import type { LinkNode } from '../../../src/shared/protocol';
  import type { FlowData } from '../lib/flow';
  import { post } from '../lib/vscode';
  import LinkCard from '../ui/organisms/LinkCard.svelte';
  import Resizer from './Resizer.svelte';
  import SideHandles from './SideHandles.svelte';

  let { id, data, selected }: NodeProps<Node<FlowData, 'link'>> = $props();
  const node = $derived(data.node as LinkNode);
</script>

<Resizer {id} {selected} minWidth={180} minHeight={50} />
<LinkCard url={node.url} title={node.title} color={node.color} {selected} onopen={() => post({ type: 'openUrl', url: node.url })} />
<SideHandles />
