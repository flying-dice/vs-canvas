<script module lang="ts">
  export type MdSegment = { kind: 'md'; text: string } | { kind: 'mermaid'; source: string };

  /** Split markdown on ```mermaid fences so the diagrams can be rendered as components. */
  export function splitMermaid(markdown: string): MdSegment[] {
    const out: MdSegment[] = [];
    const re = /^[ \t]*```mermaid[^\n]*\n([\s\S]*?)^[ \t]*```[ \t]*$/gm;
    let last = 0;
    for (let m = re.exec(markdown); m; m = re.exec(markdown)) {
      if (m.index > last) out.push({ kind: 'md', text: markdown.slice(last, m.index) });
      out.push({ kind: 'mermaid', source: m[1] });
      last = m.index + m[0].length;
    }
    if (last < markdown.length) out.push({ kind: 'md', text: markdown.slice(last) });
    return out;
  }
</script>

<script lang="ts">
  import { marked } from 'marked';
  import MermaidDiagram from '../atoms/MermaidDiagram.svelte';

  let {
    markdown,
    mode = 'dark',
    nodrag = true,
    class: cls = '',
  }: {
    markdown: string;
    mode?: 'dark' | 'light';
    /** Keep pointer drags for text selection (default); false lets the node be dragged from the text. */
    nodrag?: boolean;
    class?: string;
  } = $props();

  const segments = $derived(
    splitMermaid(markdown ?? '').map((s) =>
      s.kind === 'md' ? { ...s, html: marked.parse(s.text, { async: false, gfm: true }) as string } : s,
    ),
  );
</script>

<!-- `nowheel nodrag` are no-op class names outside Svelte Flow; inside it they keep scroll/selection working. -->
<div class={['md', 'nowheel', nodrag && 'nodrag', nodrag && 'selectable', cls]}>
  {#each segments as seg, i (i)}
    {#if seg.kind === 'md'}
      <div class="seg">{@html seg.html}</div>
    {:else}
      <div class="mmd"><MermaidDiagram source={seg.source} {mode} natural /></div>
    {/if}
  {/each}
</div>

<style>
  .md {
    box-sizing: border-box;
    max-height: 100%;
    overflow-y: auto;
    padding: 8px 12px 10px;
    font-family: var(--vscode-font-family, system-ui, sans-serif);
    font-size: 13px;
    line-height: 1.5;
  }
  .md.selectable {
    user-select: text;
    cursor: text;
  }
  .mmd {
    margin: 6px 0;
  }
  .seg:first-child > :global(:first-child) { margin-top: 0; }
  .seg:last-child > :global(:last-child) { margin-bottom: 0; }
  .md :global(h1), .md :global(h2), .md :global(h3), .md :global(h4) {
    margin: 12px 0 6px;
    line-height: 1.25;
  }
  .md :global(h1) { font-size: 1.35em; }
  .md :global(h2) { font-size: 1.2em; }
  .md :global(h3) { font-size: 1.05em; }
  .md :global(p), .md :global(ul), .md :global(ol) { margin: 6px 0; }
  .md :global(ul), .md :global(ol) { padding-left: 20px; }
  .md :global(a) { color: var(--vscode-textLink-foreground, #3794ff); }
  .md :global(code) {
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: 0.92em;
    background: var(--vscode-textCodeBlock-background, #2a2a2a);
    padding: 1px 4px;
    border-radius: 3px;
  }
  .md :global(pre) {
    background: var(--vscode-textCodeBlock-background, #2a2a2a);
    padding: 8px 10px;
    border-radius: 4px;
    overflow-x: auto;
  }
  .md :global(pre code) { padding: 0; background: none; }
  .md :global(blockquote) {
    margin: 6px 0;
    padding-left: 10px;
    border-left: 3px solid var(--vscode-editorWidget-border, #454545);
    color: var(--vscode-descriptionForeground, #9d9d9d);
  }
</style>
