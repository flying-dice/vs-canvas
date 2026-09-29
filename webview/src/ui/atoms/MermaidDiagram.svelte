<script module lang="ts">
  let counter = 0;
  // mermaid.render is not re-entrant safe on a shared instance, so serialise renders.
  let chain: Promise<unknown> = Promise.resolve();

  function renderMermaid(source: string, mode: 'dark' | 'light'): Promise<string> {
    const run = async () => {
      const { default: mermaid } = await import('mermaid');
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        theme: mode === 'dark' ? 'dark' : 'default',
      });
      const id = `mmd-${++counter}`;
      try {
        return (await mermaid.render(id, source)).svg;
      } finally {
        // On a syntax error mermaid can leave a temporary error element in <body>.
        document.getElementById(id)?.remove();
        document.getElementById(`d${id}`)?.remove();
      }
    };
    const p = chain.then(run, run);
    chain = p.catch(() => {});
    return p;
  }
</script>

<script lang="ts">
  let {
    source,
    mode = 'dark',
    natural = false,
  }: {
    source: string;
    mode?: 'dark' | 'light';
    /** Natural aspect height (for inline use in flowing content) instead of filling the parent. */
    natural?: boolean;
  } = $props();

  let svg = $state('');
  let error = $state<string | null>(null);

  $effect(() => {
    const src = source;
    const m = mode;
    let stale = false;
    if (!src.trim()) {
      svg = '';
      error = null;
      return;
    }
    renderMermaid(src, m).then(
      (out) => {
        if (stale) return;
        svg = out;
        error = null;
      },
      (e) => {
        if (stale) return;
        svg = '';
        error = String(e?.message ?? e).replace(/^Error:\s*/, '');
      },
    );
    return () => {
      stale = true;
    };
  });
</script>

{#if error}
  <div class="error" role="alert">
    <strong>Invalid Mermaid diagram</strong>
    <pre>{error}</pre>
  </div>
{:else if svg}
  <div class="diagram" class:natural>{@html svg}</div>
{:else}
  <div class="placeholder">{source.trim() ? 'Rendering...' : 'Empty diagram'}</div>
{/if}

<style>
  .diagram {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .diagram :global(svg) {
    width: 100%;
    height: 100%;
    max-width: none !important;
  }
  .diagram.natural {
    height: auto;
  }
  .diagram.natural :global(svg) {
    height: auto;
    max-width: 100% !important;
  }
  .placeholder {
    padding: 12px;
    color: var(--vscode-descriptionForeground, #9d9d9d);
    font-family: var(--vscode-font-family, system-ui, sans-serif);
    font-size: 12px;
  }
  .error {
    box-sizing: border-box;
    width: 100%;
    padding: 8px 10px;
    border: 1px solid var(--vscode-inputValidation-errorBorder, #be1100);
    background: var(--vscode-inputValidation-errorBackground, #5a1d1d);
    color: var(--vscode-editor-foreground, #ccc);
    border-radius: 4px;
    font-family: var(--vscode-font-family, system-ui, sans-serif);
    font-size: 12px;
    overflow: auto;
    user-select: text;
  }
  .error pre {
    margin: 4px 0 0;
    white-space: pre-wrap;
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: 11px;
  }
</style>
