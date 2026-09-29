<script lang="ts">
  /** Minimal token shape (structurally compatible with shiki's ThemedToken). */
  export type Token = { content: string; color?: string };
  let { text, tokens }: { text: string; tokens?: Token[] | null } = $props();
</script>

<span class="code">{#if tokens}{#each tokens as t}<span style={t.color ? `color:${t.color}` : ''}>{t.content}</span>{/each}{:else}{text}{/if}</span>

<style>
  .code {
    flex: 1;
    min-width: 0;
    padding-right: 12px;
    overflow: hidden;
  }
</style>
