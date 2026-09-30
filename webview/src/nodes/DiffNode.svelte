<script lang="ts">
  import type { Node, NodeProps } from '@xyflow/svelte';
  import type { FileNode, ResolvedCode } from '../../../src/shared/protocol';
  import type { FlowData } from '../lib/flow';
  import { post } from '../lib/vscode';
  import { theme } from '../lib/theme.svelte';
  import { tokenize, type ThemedToken } from '../lib/highlight';
  import { useLod } from '../lib/lod.svelte';
  import { ui } from '../lib/ui.svelte';
  import DiffCard from '../ui/organisms/DiffCard.svelte';
  import Resizer from './Resizer.svelte';
  import SideHandles from './SideHandles.svelte';

  let { id, data, selected }: NodeProps<Node<FlowData, 'diff'>> = $props();
  const lod = useLod();

  const node = $derived(data.node as FileNode);
  const pending = (error: string): ResolvedCode => ({ absPath: '', language: 'text', firstLine: 1, lines: [], totalLines: 0, error });
  const right = $derived<ResolvedCode>(data.code ?? pending('File not resolved yet'));
  const left = $derived<ResolvedCode>(data.diffBase ?? pending(node.diffFrom ? 'File not resolved yet' : 'No diffFrom file set'));

  let leftTokens = $state.raw<ThemedToken[][] | null>(null);
  let rightTokens = $state.raw<ThemedToken[][] | null>(null);

  function highlight(code: ResolvedCode, set: (t: ThemedToken[][] | null) => void) {
    const src = code.lines.join('\n');
    const lang = code.language;
    const mode = theme.mode;
    if (code.error) {
      set(null);
      return;
    }
    let stale = false;
    tokenize(src, lang, mode).then((t) => {
      if (!stale) set(t);
    });
    return () => {
      stale = true;
    };
  }
  $effect(() => highlight(left, (t) => (leftTokens = t)));
  $effect(() => highlight(right, (t) => (rightTokens = t)));

  const lit = $derived(ui.steps.some((s) => s.nodeId === id));
</script>

<Resizer {id} {selected} minWidth={360} minHeight={160} />
<DiffCard
  leftPath={node.diffFrom ?? ''}
  rightPath={node.file}
  title={node.title}
  {left}
  {right}
  {leftTokens}
  {rightTokens}
  {selected}
  {lit}
  lod={lod.current}
  onlineclick={(side, line) => post({ type: 'openFile', path: side === 'left' ? (node.diffFrom ?? node.file) : node.file, line })}
/>
<SideHandles />
