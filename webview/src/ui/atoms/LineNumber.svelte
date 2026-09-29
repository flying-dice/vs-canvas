<script lang="ts">
  let { n, onclick }: { n: number; onclick?: (n: number) => void } = $props();
</script>

<button class="ln" title="Open in editor" onclick={() => onclick?.(n)}>{n}</button>

<style>
  .ln {
    flex: none;
    width: 44px;
    padding: 0 10px 0 0;
    border: 0;
    background: none;
    font: inherit;
    text-align: right;
    color: var(--vscode-editorLineNumber-foreground, #858585);
    cursor: pointer;
    user-select: none;
  }
  .ln:hover {
    color: var(--vscode-editorLineNumber-activeForeground, #c6c6c6);
    text-decoration: underline;
  }
</style>
