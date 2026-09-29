<script lang="ts">
  import { shapeById } from '../../../../src/shared/shapes';
  import { geometryFor } from '../../lib/shapes/renderers';
  import { toneStyle } from '../../lib/shapes/tone';
  import { bracketed } from '../../lib/shapes/content';
  import Icon from '../atoms/Icon.svelte';
  import ShapeFigure from '../molecules/ShapeFigure.svelte';

  // Frame shapes: a group node that draws a diagram container behind other nodes.
  //   c4.boundary  dashed 1.5px border, name + "[sublabel]" at the bottom-left (C4 convention)
  //   uml.package  folder tab with the name
  //   bpmn.pool    vertical band on the left with the rotated name
  //   arch.region  dashed rounded region with a label chip at the top-left
  // The frame is click-through (see .group-node in app.css); the label is the drag handle (.group-label).
  let {
    shape,
    label,
    sublabel,
    color,
    selected = false,
    width,
    height,
  }: { shape: string; label?: string; sublabel?: string; color?: string; selected?: boolean; width: number; height: number } = $props();

  const def = $derived(shapeById(shape));
  const name = $derived(label?.trim() || def?.name || 'Group');
  const geo = $derived(geometryFor(shape, width, height, { label: name }));
  const box = $derived(geo.textBox);
  const sub = $derived(shape === 'c4.boundary' ? bracketed(sublabel) : (sublabel ?? ''));
</script>

<div class="frame" style={toneStyle('frame', color)} style:width={`${width}px`} style:height={`${height}px`} data-shape={shape}>
  <ShapeFigure {geo} {width} {height} {selected} />
  {#if shape === 'c4.boundary'}
    <div class="group-label boundary" title={name}>
      <span class="nm">{name}</span>
      {#if sub}<span class="sub">{sub}</span>{/if}
    </div>
  {:else if shape === 'uml.package'}
    <div
      class="group-label tab"
      title={name}
      style:left={`${box.x}px`}
      style:top={`${box.y}px`}
      style:width={`${box.w}px`}
      style:height={`${box.h}px`}
    >{name}</div>
    {#if sub}<div class="stereo">«{sub}»</div>{/if}
  {:else if shape === 'bpmn.pool'}
    <div class="group-label band" title={name}><span>{name}</span></div>
    {#if sub}<div class="stereo pool">{sub}</div>{/if}
  {:else}
    <div class="group-label chip" title={name}>
      <Icon name="cloud" size={14} />
      <span class="nm">{name}</span>
      {#if sub}<span class="sub">{sub}</span>{/if}
    </div>
  {/if}
</div>

<style>
  .frame {
    position: relative;
    box-sizing: border-box;
    color: var(--vscode-editor-foreground, #cccccc);
    font-family: var(--vscode-font-family, system-ui, sans-serif);
    font-size: 13px;
  }
  .group-label {
    position: absolute;
    box-sizing: border-box;
    pointer-events: all;
    cursor: grab;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  /* C4: bottom-left, name over "[type]" */
  .boundary {
    left: calc(12px * var(--cv-label-scale, 1));
    bottom: calc(8px * var(--cv-label-scale, 1));
    max-width: calc(100% - 24px);
    display: flex;
    flex-direction: column;
    padding: 2px 4px;
    border-radius: 4px;
    line-height: 1.3;
  }
  .boundary .nm {
    font-size: calc(13px * var(--cv-label-scale, 1));
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .boundary .sub {
    font-size: calc(11px * var(--cv-label-scale, 1));
    color: var(--vscode-descriptionForeground, #9d9d9d);
    overflow: hidden;
    text-overflow: ellipsis;
  }
  /* UML package tab */
  .tab {
    padding: 0 0 0 6px;
    line-height: 16px;
    font-size: 12px;
    font-weight: 600;
    display: flex;
    align-items: center;
  }
  .stereo {
    position: absolute;
    left: 10px;
    top: 30px;
    color: var(--vscode-descriptionForeground, #9d9d9d);
    font-size: 11px;
    pointer-events: none;
  }
  .stereo.pool {
    left: 40px;
    top: 8px;
  }
  /* BPMN pool band */
  .band {
    left: 0;
    top: 0;
    width: 32px;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 600;
  }
  .band span {
    writing-mode: vertical-rl;
    transform: rotate(180deg);
    max-height: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    padding: 8px 0;
  }
  /* arch region chip */
  .chip {
    left: 12px;
    top: 8px;
    max-width: calc(100% - 24px);
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 24px;
    padding: 0 8px;
    background: var(--vscode-editorWidget-background, #252526);
    border: 1px solid var(--vscode-editorWidget-border, var(--vscode-widget-border, #454545));
    border-radius: 4px;
    font-size: calc(12px * var(--cv-label-scale, 1));
    font-weight: 600;
    color: var(--vscode-editor-foreground, #ccc);
  }
  .chip :global(svg) {
    color: var(--vscode-descriptionForeground, #9d9d9d);
  }
  .chip .sub {
    color: var(--vscode-descriptionForeground, #9d9d9d);
    font-weight: 400;
    font-size: 11px;
  }
</style>
