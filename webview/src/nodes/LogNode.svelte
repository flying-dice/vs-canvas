<script lang="ts">
  import type { Node, NodeProps } from '@xyflow/svelte';
  import type { TextNode } from '../../../src/shared/protocol';
  import type { FlowData } from '../lib/flow';
  import { post } from '../lib/vscode';
  import { useLod } from '../lib/lod.svelte';
  import LogCard from '../ui/organisms/LogCard.svelte';
  import Resizer from './Resizer.svelte';
  import SideHandles from './SideHandles.svelte';

  let { id, data, selected }: NodeProps<Node<FlowData, 'log'>> = $props();
  const lod = useLod();
  const node = $derived(data.node as TextNode);
</script>

<Resizer {id} {selected} minWidth={280} minHeight={120} />
<LogCard
  lod={lod.current}
  text={node.text}
  title={node.title}
  errorLines={node.errorLines}
  color={node.color}
  {selected}
  onframeclick={(path, line) => post({ type: 'openFile', path, line })}
/>
<SideHandles />
