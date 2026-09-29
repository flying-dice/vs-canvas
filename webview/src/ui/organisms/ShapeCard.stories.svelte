<script module lang="ts">
  import { defineMeta } from '@storybook/addon-svelte-csf';
  import { fn } from 'storybook/test';
  import ShapeCard from './ShapeCard.svelte';
  import { shapesIn, shapeById } from '../../../../src/shared/shapes';
  import { sampleFor, themeVars } from '../storyShapes';

  const { Story } = defineMeta({
    title: 'Organisms/ShapeCard',
    component: ShapeCard,
    tags: ['autodocs'],
    parameters: { layout: 'padded' },
    argTypes: { lod: { control: 'inline-radio', options: ['far', 'mid', 'near'] } },
    args: { shape: 'c4.container', text: 'Orders API\nCreates orders and charges cards', fields: { technology: 'Node.js, Express' }, width: 256, height: 152, lod: 'near', selected: false, oncommit: fn(), onfields: fn() },
  });
</script>

{#snippet gallery(libId: string)}
  <div class="themes">
    {#each ['dark', 'light'] as th}
      <div class="panel" style={`${themeVars(th as 'dark' | 'light')}`}>
        <div class="grid">
          {#each shapesIn(libId as any).filter((s) => !s.frame) as s (s.id)}
            {@const smp = sampleFor(s)}
            <div class="cell">
              <div class="stage" style:width={`${Math.max(s.size[0], 136)}px`} style:height={`${s.size[1] + (shapeById(s.id)?.layout === 'below' ? 48 : 0)}px`}>
                <ShapeCard shape={s.id} text={smp.text} fields={smp.fields} width={s.size[0]} height={s.size[1]} />
              </div>
              <code>{s.id}</code>
            </div>
          {/each}
        </div>
      </div>
    {/each}
  </div>
{/snippet}

{#snippet template(args: any)}
  <div style="width:{args.width}px;height:{args.height}px;position:relative"><ShapeCard {...args} /></div>
{/snippet}

{#snippet tones(args: any)}
  <div class="row">
    {#each [['flowchart.process', 'Default'], ['c4.container', 'Accent\nInternal element'], ['c4.system-external', 'External\nSystem we do not own'], ['flowchart.process', 'Meaning: failure']] as [id, t], i}
      <div style="width:224px;height:112px;position:relative"><ShapeCard shape={id} text={t} width={224} height={112} color={i === 3 ? '1' : undefined} fields={id === 'c4.container' ? { technology: 'Go' } : undefined} /></div>
    {/each}
    <div style="width:224px;height:112px;position:relative"><ShapeCard shape="flowchart.process" text="Selected" width={224} height={112} selected /></div>
  </div>
{/snippet}

{#snippet lods(args: any)}
  <div class="row">
    {#each ['far', 'mid', 'near'] as l}
      <div class="col">
        <div style="width:256px;height:152px;position:relative"><ShapeCard shape="c4.container" text="Orders API\nCreates orders and charges cards" fields={{ technology: 'Node.js' }} width={256} height={152} lod={l as any} /></div>
        <div style="width:224px;height:160px;position:relative"><ShapeCard shape="uml.class" text="Order" fields={{ attributes: ['- id: string', '- total: Money'], methods: ['+ pay(): Charge'] }} width={224} height={160} lod={l as any} /></div>
        <div style="width:176px;height:112px;position:relative"><ShapeCard shape="flowchart.decision" text="Timed out?" width={176} height={112} lod={l as any} /></div>
        <code>{l}</code>
      </div>
    {/each}
  </div>
{/snippet}

{#snippet editable(args: any)}
  <div class="row">
    <div style="width:256px;height:152px;position:relative"><ShapeCard shape="c4.container" text={txt} fields={flds} width={256} height={152} selected oncommit={(t) => (txt = t)} onfields={(f) => (flds = f)} /></div>
    <div style="width:224px;height:176px;position:relative"><ShapeCard shape="uml.class" text="Order" fields={{ attributes: ['- id: string'], methods: ['+ pay(): Charge'] }} width={224} height={176} selected /></div>
    <div style="width:240px;height:176px;position:relative"><ShapeCard shape="erd.entity" text="orders" fields={{ columns: ['id uuid PK', 'customer_id uuid FK', 'total numeric(12,2)'] }} width={240} height={176} selected /></div>
  </div>
  <p>Double-click a label, a compartment or the column list to edit. Ctrl/Cmd+Enter or blur commits, Escape cancels.</p>
{/snippet}

{#snippet flowchart(args: any)}{@render gallery('flowchart')}{/snippet}
{#snippet uml(args: any)}{@render gallery('uml')}{/snippet}
{#snippet c4(args: any)}{@render gallery('c4')}{/snippet}
{#snippet erd(args: any)}{@render gallery('erd')}{/snippet}
{#snippet arch(args: any)}{@render gallery('arch')}{/snippet}
{#snippet bpmn(args: any)}{@render gallery('bpmn')}{/snippet}
<Story name="Gallery Flowchart" template={flowchart} parameters={{ layout: 'fullscreen' }} />
<Story name="Gallery UML" template={uml} parameters={{ layout: 'fullscreen' }} />
<Story name="Gallery C4" template={c4} parameters={{ layout: 'fullscreen' }} />
<Story name="Gallery ERD" template={erd} parameters={{ layout: 'fullscreen' }} />
<Story name="Gallery Architecture" template={arch} parameters={{ layout: 'fullscreen' }} />
<Story name="Gallery BPMN" template={bpmn} parameters={{ layout: 'fullscreen' }} />
<Story name="Tones" template={tones} />
<Story name="LevelsOfDetail" template={lods} />
<Story name="Editing" template={editable} />
<Story name="Container" {template} />
<Story name="Selected" args={{ selected: true }} {template} />
<Story name="EditingText" args={{ editing: 'text', selected: true }} {template} />
<Story name="NoTechnology" args={{ fields: undefined }} {template} />
<Story name="LongText" args={{ text: 'A component with an extremely long name that has to wrap and clamp\nAnd a description that is long enough to need clamping once it has filled the space available inside the box which is limited' }} {template} />

<script lang="ts">
  let txt = $state('Web app\nLets shoppers browse and check out');
  let flds = $state<Record<string, string | string[]>>({ technology: 'React' });
</script>

<style>
  .themes {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0;
  }
  .panel {
    padding: 24px;
    background: var(--vscode-editor-background);
    color: var(--vscode-editor-foreground);
    font-family: var(--vscode-font-family);
    font-size: var(--vscode-font-size);
  }
  .grid {
    display: flex;
    flex-wrap: wrap;
    gap: 32px 24px;
    align-items: flex-start;
  }
  .cell {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .stage {
    position: relative;
  }
  code {
    color: var(--vscode-descriptionForeground);
    font-family: var(--vscode-editor-font-family);
    font-size: 11px;
  }
  .row {
    display: flex;
    gap: 24px;
    flex-wrap: wrap;
    align-items: flex-start;
  }
  .col {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
</style>
