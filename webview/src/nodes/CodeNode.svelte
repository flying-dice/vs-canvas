<script lang="ts">
  import { Handle, Position, useUpdateNodeInternals, type Node, type NodeProps } from '@xyflow/svelte';
  import type { FileNode, ResolvedCode } from '../../../src/shared/protocol';
  import type { FlowData } from '../lib/flow';
  import { post } from '../lib/vscode';
  import { MOTION } from '../lib/motion';
  import { theme } from '../lib/theme.svelte';
  import { tokenize, type ThemedToken } from '../lib/highlight';
  import CodeCard from '../ui/organisms/CodeCard.svelte';
  import { useLod } from '../lib/lod.svelte';
  import { ui } from '../lib/ui.svelte';
  import SideHandles from './SideHandles.svelte';

  let { id, data, selected }: NodeProps<Node<FlowData, 'code'>> = $props();

  const updateNodeInternals = useUpdateNodeInternals();
  const lod = useLod();

  const node = $derived(data.node as FileNode);
  const code = $derived<ResolvedCode>(
    data.code ?? { absPath: '', language: 'text', firstLine: 1, lines: [], totalLines: 0, error: 'File not resolved yet' },
  );

  let tokens = $state.raw<ThemedToken[][] | null>(null);

  $effect(() => {
    const src = code.lines.join('\n');
    const lang = code.language;
    const mode = theme.mode;
    if (code.error) {
      tokens = null;
      return;
    }
    let stale = false;
    tokenize(src, lang, mode).then((t) => {
      if (!stale) tokens = t;
    });
    return () => {
      stale = true;
    };
  });

  // Highlights that appear after this node mounted flash once. Ids present at mount are not pulsed.
  let seen: Set<string> | null = null;
  let pulseIds = $state<string[]>([]);
  let pulseTimer: ReturnType<typeof setTimeout> | undefined;

  $effect(() => {
    const ids = (node.highlights ?? []).map((h) => h.id);
    if (!seen) {
      seen = new Set(ids);
      return;
    }
    const fresh = ids.filter((i) => !seen!.has(i));
    seen = new Set(ids);
    if (!fresh.length) return;
    pulseIds = fresh;
    clearTimeout(pulseTimer);
    pulseTimer = setTimeout(() => (pulseIds = []), MOTION.pulseMs + 100);
  });
  $effect(() => () => clearTimeout(pulseTimer));

  /** Every line gets a drag-out handle while the node is hovered, selected or the source of a drag. */
  const dragOut = $derived(selected || ui.hoverNodeId === id || ui.connectFrom === id);

  const inSet = $derived(new Set(data.anchors?.in ?? []));
  const outSet = $derived(new Set(data.anchors?.out ?? []));

  $effect(() => {
    void [...inSet].join(',');
    void [...outSet].join(',');
    void code.lines.length;
    void dragOut;
    updateNodeInternals(id);
  });
</script>

<CodeCard
  data={{ file: node.file, title: node.title, code, highlights: node.highlights ?? [] }}
  {tokens}
  {selected}
  lod={lod.current}
  {pulseIds}
  onlineclick={(line) => post({ type: 'openFile', path: node.file, line })}
>
  {#snippet lineHandles(n: number)}
    {#if inSet.has(n)}<Handle type="target" position={Position.Left} id={`in-L${n}`} class="h-line anchored" />{/if}
    {#if outSet.has(n)}
      <Handle type="source" position={Position.Right} id={`out-L${n}`} class="h-line anchored" />
    {:else if dragOut}
      <Handle type="source" position={Position.Right} id={`out-L${n}`} class="h-line" />
    {/if}
  {/snippet}
</CodeCard>
<SideHandles />
