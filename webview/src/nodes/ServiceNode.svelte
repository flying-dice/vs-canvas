<script lang="ts">
  import type { Node, NodeProps } from '@xyflow/svelte';
  import type { TextNode } from '../../../src/shared/protocol';
  import type { FlowData } from '../lib/flow';
  import { post } from '../lib/vscode';
  import { theme } from '../lib/theme.svelte';
  import { tokenize } from '../lib/highlight';
  import { useLod } from '../lib/lod.svelte';
  import ServiceCard, { type EntrySnippet } from '../ui/organisms/ServiceCard.svelte';
  import Resizer from './Resizer.svelte';
  import SideHandles from './SideHandles.svelte';

  let { id, data, selected }: NodeProps<Node<FlowData, 'service'>> = $props();
  const node = $derived(data.node as TextNode);
  const lod = useLod();

  let snippets = $state.raw<(EntrySnippet | undefined)[]>([]);

  // Tokenise entry-point code only once the card is zoomed in.
  $effect(() => {
    const eps = node.entryPoints ?? [];
    const codes = data.entryCode ?? {};
    const mode = theme.mode;
    if (lod.current !== 'near') return;
    let stale = false;
    Promise.all(
      eps.map(async (_, i): Promise<EntrySnippet | undefined> => {
        const code = codes[i];
        if (!code) return undefined;
        if (code.error) return { code };
        return { code, tokens: await tokenize(code.lines.join('\n'), code.language, mode).catch(() => null) };
      }),
    ).then((s) => {
      if (!stale) snippets = s;
    });
    return () => {
      stale = true;
    };
  });
</script>

<Resizer {id} {selected} minWidth={280} minHeight={200} />
<ServiceCard
  title={node.title ?? 'Service'}
  description={node.text}
  tags={node.tags}
  entryPoints={node.entryPoints}
  {snippets}
  canvas={node.canvas}
  color={node.color}
  lod={lod.current}
  {selected}
  onentryclick={(file, line) => post({ type: 'openFile', path: file, line })}
  onopencanvas={() => node.canvas && post({ type: 'openCanvas', path: node.canvas })}
/>
<SideHandles />
