<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import FrameShape from './FrameShape.svelte';
  import ShapeCard from './ShapeCard.svelte';
  import { themeVars } from '../storyShapes';

  const { Story } = defineMeta({
    title: 'Organisms/FrameShape',
    component: FrameShape,
    tags: ['autodocs'],
    args: { shape: 'c4.boundary', label: 'Acme shop', sublabel: 'Software System', width: 480, height: 280, selected: false },
  });
  const frames = [
    { shape: 'c4.boundary', label: 'Acme shop', sublabel: 'Software System' },
    { shape: 'uml.package', label: 'payments', sublabel: 'domain' },
    { shape: 'bpmn.pool', label: 'Checkout', sublabel: undefined },
    { shape: 'arch.region', label: 'eu-west-1', sublabel: 'AWS region' },
  ];
</script>

{#snippet all(args: any)}
  <div class="themes">
    {#each ['dark', 'light'] as th}
      <div class="panel" style={themeVars(th as 'dark' | 'light')}>
        {#each frames as f}
          <div style="width:480px;height:240px;position:relative">
            <FrameShape {...f} width={480} height={240} />
            <div style="position:absolute;left:{f.shape === 'bpmn.pool' ? 72 : 32}px;top:{f.shape === 'c4.boundary' ? 40 : 64}px;width:160px;height:64px">
              <ShapeCard shape="flowchart.process" text="Inside" width={160} height={64} />
            </div>
          </div>
        {/each}
      </div>
    {/each}
  </div>
{/snippet}

{#snippet template(args: any)}
  <div style="width:{args.width}px;height:{args.height}px;position:relative"><FrameShape {...args} /></div>
{/snippet}

<Story name="C4 boundary" {template} />
<Story name="UML package" args={{ shape: 'uml.package', label: 'payments', sublabel: 'domain' }} {template} />
<Story name="BPMN pool" args={{ shape: 'bpmn.pool', label: 'Checkout', sublabel: undefined, height: 200 }} {template} />
<Story name="Arch region" args={{ shape: 'arch.region', label: 'eu-west-1', sublabel: 'AWS region' }} {template} />
<Story name="Selected" args={{ selected: true }} {template} />
<Story name="Colored (domain)" args={{ color: '6' }} {template} />
<Story name="All frames, dark and light" parameters={{ layout: 'fullscreen' }} template={all} />

<style>
  .themes {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }
  .panel {
    display: flex;
    flex-direction: column;
    gap: 24px;
    padding: 24px;
    background: var(--vscode-editor-background);
    color: var(--vscode-editor-foreground);
  }
</style>
