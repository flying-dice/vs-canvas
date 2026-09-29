<script lang="ts">
  import { NodeResizer } from '@xyflow/svelte';
  import { post } from '../lib/vscode';
  import { resizing } from '../lib/interaction';

  let {
    id,
    selected,
    minWidth = 80,
    minHeight = 40,
    keepAspect = false,
  }: { id: string; selected: boolean; minWidth?: number; minHeight?: number; keepAspect?: boolean } = $props();
</script>

<NodeResizer
  isVisible={selected}
  {minWidth}
  {minHeight}
  keepAspectRatio={keepAspect}
  onResizeStart={() => resizing.add(id)}
  onResizeEnd={(_e, p) => {
    resizing.delete(id);
    post({
      type: 'nodesChanged',
      reason: 'user',
      changes: [{ id, x: Math.round(p.x), y: Math.round(p.y), width: Math.round(p.width), height: Math.round(p.height) }],
    });
  }}
/>
