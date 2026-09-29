<script lang="ts">
  import { PRESET_IDS, SEMANTIC_NAMES, canvasColor } from '../../lib/colors';

  let {
    value,
    onchange,
  }: {
    /** Current canvas colour ("1"-"6" or hex); undefined = none. */
    value?: string;
    /** Called with a preset id, or undefined for "None". */
    onchange?: (color: string | undefined) => void;
  } = $props();
</script>

<div class="picker" role="group" aria-label="Colour">
  {#each PRESET_IDS as id (id)}
    <button
      type="button"
      class="sw"
      class:on={value === id}
      style={`--c: ${canvasColor(id)}`}
      title={SEMANTIC_NAMES[id]}
      aria-label={SEMANTIC_NAMES[id]}
      aria-pressed={value === id}
      onclick={() => onchange?.(value === id ? undefined : id)}
    ><span class="dot"></span></button>
  {/each}
  <button
    type="button"
    class="sw"
    class:on={!value}
    title="None"
    aria-label="None"
    aria-pressed={!value}
    onclick={() => onchange?.(undefined)}
  ><span class="dot none"></span></button>
</div>

<style>
  .picker {
    display: flex;
    align-items: center;
    gap: 0;
  }
  /* 24px hit target around a 12px dot */
  .sw {
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    padding: 0;
    border: 0;
    border-radius: 4px;
    background: transparent;
    cursor: pointer;
  }
  .sw:hover {
    background: var(--vscode-toolbar-hoverBackground, rgba(90, 93, 94, 0.31));
  }
  .sw:focus-visible {
    outline: 1px solid var(--vscode-focusBorder, #007fd4);
    outline-offset: -1px;
  }
  .dot {
    width: 12px;
    height: 12px;
    box-sizing: border-box;
    border-radius: 50%;
    background: var(--c);
  }
  .dot.none {
    background: transparent;
    border: 1px dashed var(--vscode-descriptionForeground, #9d9d9d);
  }
  .sw.on .dot {
    box-shadow: 0 0 0 2px var(--vscode-editorWidget-background, #252526), 0 0 0 3px var(--vscode-focusBorder, #007fd4);
  }
</style>
