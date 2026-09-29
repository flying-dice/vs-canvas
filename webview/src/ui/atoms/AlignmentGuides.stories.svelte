<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import AlignmentGuides from './AlignmentGuides.svelte';
  import { snapRect } from '../../lib/snapping';
  const { Story } = defineMeta({ title: 'Atoms/AlignmentGuides', component: AlignmentGuides, tags: ['autodocs'] });
  const others = [
    { x: 40, y: 40, w: 200, h: 96 },
    { x: 360, y: 200, w: 200, h: 96 },
  ];
  const box = (r: { x: number; y: number; w: number; h: number }, fill = 'var(--vscode-editorWidget-background)') =>
    `position:absolute;left:${r.x}px;top:${r.y}px;width:${r.w}px;height:${r.h}px;box-sizing:border-box;border:1px solid var(--vscode-editorWidget-border);border-radius:6px;background:${fill}`;
  const snapped = snapRect({ x: 44, y: 204, w: 200, h: 96 }, others);
  const centred = snapRect({ x: 361, y: 60, w: 120, h: 64 }, others);
</script>

{#snippet c1(args: any)}
{@render stage([...others, { x: 44, y: 204, w: 200, h: 96 }], snapped)}
{/snippet}

{#snippet c2(args: any)}
{@render stage([...others, { x: 361, y: 60, w: 120, h: 64 }], centred)}
{/snippet}

{#snippet c3(args: any)}
{@render stage([...others, { x: 44, y: 204, w: 200, h: 96 }], snapped, 0.5)}
{/snippet}


{#snippet stage(rects: any[], res: ReturnType<typeof snapRect>, zoom = 1)}
  <div style="position:relative;width:620px;height:340px;background:var(--vscode-editor-background);transform-origin:0 0">
    {#each rects as r}<div style={box(r)}></div>{/each}
    <div style={box({ x: res.x, y: res.y, w: rects[rects.length - 1]?.w ?? 200, h: rects[rects.length - 1]?.h ?? 96 }, 'color-mix(in srgb, var(--vscode-focusBorder) 15%, transparent)')}></div>
    <AlignmentGuides guides={res.guides} distances={res.distances} {zoom} />
  </div>
{/snippet}

<Story name="EdgeAlignment (left edges + gap)" template={c1} />
<Story name="CentreAlignment" template={c2} />
<Story name="ZoomedOut (labels stay 11px)" template={c3} />
