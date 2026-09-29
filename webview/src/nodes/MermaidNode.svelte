<script lang="ts">
  import type { Node, NodeProps } from '@xyflow/svelte';
  import type { TextNode } from '../../../src/shared/protocol';
  import type { FlowData } from '../lib/flow';
  import { post } from '../lib/vscode';
  import { useEditRequest } from '../lib/ui.svelte';
  import { theme } from '../lib/theme.svelte';
  import MermaidCard from '../ui/organisms/MermaidCard.svelte';
  import Resizer from './Resizer.svelte';
  import SideHandles from './SideHandles.svelte';

  let { id, data, selected }: NodeProps<Node<FlowData, 'mermaid'>> = $props();
  const node = $derived(data.node as TextNode);
  let editing = $state(false);
  useEditRequest(() => id, () => (editing = true));
</script>

<Resizer {id} {selected} minWidth={200} minHeight={120} />
<MermaidCard
  source={node.text}
  title={node.title}
  color={node.color}
  {selected}
  mode={theme.mode}
  bind:editing
  oncommit={(text) => post({ type: 'updateNode', id, patch: { text } })}
/>
<SideHandles />
