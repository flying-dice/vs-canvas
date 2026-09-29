<script lang="ts">
  import type { Node, NodeProps } from '@xyflow/svelte';
  import type { FileNode } from '../../../src/shared/protocol';
  import type { FlowData } from '../lib/flow';
  import { post } from '../lib/vscode';
  import FileRefCard from '../ui/organisms/FileRefCard.svelte';
  import SideHandles from './SideHandles.svelte';

  let { data, selected }: NodeProps<Node<FlowData, 'fileRef'>> = $props();
  const node = $derived(data.node as FileNode);
</script>

<FileRefCard
  file={node.file}
  lines={node.lines}
  title={node.title}
  color={node.color}
  {selected}
  onopen={() => post({ type: 'openFile', path: node.file, line: node.lines?.[0] })}
/>
<SideHandles />
