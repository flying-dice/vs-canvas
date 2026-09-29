<script lang="ts">
  import type { Node, NodeProps } from '@xyflow/svelte';
  import type { FileNode, PortalPreview } from '../../../src/shared/protocol';
  import type { FlowData } from '../lib/flow';
  import { post } from '../lib/vscode';
  import PortalCard from '../ui/organisms/PortalCard.svelte';
  import Resizer from './Resizer.svelte';
  import SideHandles from './SideHandles.svelte';

  let { id, data, selected }: NodeProps<Node<FlowData, 'portal'>> = $props();
  const node = $derived(data.node as FileNode);
  const preview = $derived<PortalPreview>(
    data.portal ?? { title: node.title ?? node.file, nodeCount: 0, rects: [], error: undefined },
  );
</script>

<Resizer {id} {selected} minWidth={200} minHeight={140} />
<PortalCard {preview} title={node.title} {selected} onopen={() => post({ type: 'openCanvas', path: node.file })} />
<SideHandles />
