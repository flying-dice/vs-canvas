<script lang="ts">
  import type { Node, NodeProps } from '@xyflow/svelte';
  import type { TextNode } from '../../../src/shared/protocol';
  import type { FlowData } from '../lib/flow';
  import { post } from '../lib/vscode';
  import { useLod } from '../lib/lod.svelte';
  import { useEditRequest } from '../lib/ui.svelte';
  import { theme } from '../lib/theme.svelte';
  import FindingCard from '../ui/organisms/FindingCard.svelte';
  import Resizer from './Resizer.svelte';
  import SideHandles from './SideHandles.svelte';

  let { id, data, selected }: NodeProps<Node<FlowData, 'finding'>> = $props();
  const lod = useLod();
  const node = $derived(data.node as TextNode);
  let editing = $state(false);
  useEditRequest(() => id, () => (editing = true));
</script>

<Resizer {id} {selected} minWidth={240} minHeight={120} />
<FindingCard
  lod={lod.current}
  title={node.title}
  text={node.text}
  findingKind={node.findingKind}
  status={node.status}
  color={node.color}
  {selected}
  mode={theme.mode}
  bind:editing
  oncommit={(text) => post({ type: 'updateNode', id, patch: { text } })}
  ontitlecommit={(title) => post({ type: 'updateNode', id, patch: { title } })}
  onstatuschange={(status) => post({ type: 'updateNode', id, patch: { status } })}
/>
<SideHandles />
