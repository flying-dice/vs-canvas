<script lang="ts">
  let { mcpUrl = null }: { mcpUrl?: string | null } = $props();
  const command = $derived(mcpUrl ? `claude mcp add --transport http vs-canvas ${mcpUrl}` : null);
</script>

<div class="empty">
  <h2>VS Canvas</h2>
  <p>The canvas is empty. Connect an LLM to the MCP server and ask it to open and explain code.</p>
  {#if mcpUrl}
    <p>MCP server: <code>{mcpUrl}</code></p>
    <pre>{command}</pre>
  {:else}
    <p>Waiting for the MCP server to start...</p>
  {/if}
</div>

<style>
  .empty {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 24px;
    pointer-events: none;
    color: var(--vscode-descriptionForeground, #9d9d9d);
    font-family: var(--vscode-font-family, system-ui, sans-serif);
    z-index: 5;
  }
  h2 {
    margin: 0 0 8px;
    color: var(--vscode-editor-foreground, #d4d4d4);
    font-weight: 500;
  }
  p {
    margin: 4px 0;
    max-width: 480px;
  }
  pre {
    margin: 8px 0 0;
    padding: 8px 12px;
    background: var(--vscode-textCodeBlock-background, #2a2a2a);
    border-radius: 4px;
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: 12px;
    color: var(--vscode-editor-foreground, #d4d4d4);
    white-space: pre-wrap;
    word-break: break-all;
    user-select: text;
  }
  code {
    font-family: var(--vscode-editor-font-family, monospace);
  }
</style>
