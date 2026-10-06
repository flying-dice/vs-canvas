<script module lang="ts">
  // Codicon-like 16x16 glyphs, drawn inline so no icon font is needed.
  export const ICONS = {
    sticky: 'M2.5 2h11a.5.5 0 0 1 .5.5V10l-4 4H2.5a.5.5 0 0 1-.5-.5v-11A.5.5 0 0 1 2.5 2zM3 3v10h6v-3.5a.5.5 0 0 1 .5-.5H13V3H3zm7 7v2.3L12.3 10H10z',
    text: 'M3 3h10v2h-1V4H8.5v8H10v1H6v-1h1.5V4H4v1H3V3z',
    note: 'M3 1.5h7.5L14 5v9.5H3v-13zM4 2.5v11h9V6h-3V2.5H4zm7 .7V5h1.8L11 3.2zM5.5 8h6v1h-6V8zm0 2h6v1h-6v-1z',
    mermaid: 'M2 2h4v3H4.5v2h7V5H10V2h4v3h-1.5v3H8.5v1.5H10V13H6V9.5h1.5V8h-4V5H2V2zm1 1v1h2V3H3zm7 0v1h3V3h-3zM7 10.5v1.5h2v-1.5H7z',
    group: 'M2 3.5A1.5 1.5 0 0 1 3.5 2H6l1 1.5h5.5A1.5 1.5 0 0 1 14 5v7.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 12.5v-9zM3.5 3a.5.5 0 0 0-.5.5v9a.5.5 0 0 0 .5.5h9a.5.5 0 0 0 .5-.5V5a.5.5 0 0 0-.5-.5H6.5L5.5 3h-2z',
    file: 'M3.5 1h6l3.5 3.5V15h-9.5V1zm1 1v12h7.5V5H9V2H4.5zM10 2.4V4h1.6L10 2.4z',
    link: 'M7.5 4.5l1-1a3 3 0 0 1 4.2 4.2l-1.5 1.5a3 3 0 0 1-4.2 0l.7-.7a2 2 0 0 0 2.8 0l1.5-1.5a2 2 0 0 0-2.8-2.8l-.3.3-.4-.9v-.1zM8.5 11.5l-1 1a3 3 0 0 1-4.2-4.2l1.5-1.5a3 3 0 0 1 4.2 0l-.7.7a2 2 0 0 0-2.8 0L4 9a2 2 0 0 0 2.8 2.8l.3-.3.4.9v.1z',
    code: 'M5.7 4.3L2 8l3.7 3.7-.7.7L.6 8 5 3.6l.7.7zm4.6 0l.7-.7L15.4 8 11 12.4l-.7-.7L14 8l-3.7-3.7z',
    error: 'M8 1a7 7 0 1 1 0 14A7 7 0 0 1 8 1zM8 2a6 6 0 1 0 0 12A6 6 0 0 0 8 2zM5.4 4.7 8 7.3l2.6-2.6.7.7L8.7 8l2.6 2.6-.7.7L8 8.7l-2.6 2.6-.7-.7L7.3 8 4.7 5.4z',
    info: 'M8 1a7 7 0 1 1 0 14A7 7 0 0 1 8 1zM8 2a6 6 0 1 0 0 12A6 6 0 0 0 8 2zM7.5 7h1v4.5h-1zM7.5 4.5h1v1.2h-1z',
    close: 'M8 7.3l3.6-3.6.7.7L8.7 8l3.6 3.6-.7.7L8 8.7l-3.6 3.6-.7-.7L7.3 8 3.7 4.4l.7-.7L8 7.3z',
    warning: 'M8 1.5l7 12.5H1L8 1.5zm0 2.3L3 13h10L8 3.8zM7.5 7h1v3h-1V7zm0 4h1v1h-1v-1z',
    zap: 'M9.2 1.5L3.8 9h3.6l-.6 5.5L12.2 7H8.6z',
    pinFilled: 'M9.6 1.5l4.9 4.9-.9.9-1.2-.4-2.6 2.6.4 2.5-.9.9-2.6-2.6-3.6 3.6-.7-.7 3.6-3.6-2.6-2.6.9-.9 2.5.4 2.6-2.6-.4-1.2z',
  } as const;

  // Stroked 16x16 glyphs (1.25px round strokes), for the finding/log/service/portal kinds and toolbars.
  export const STROKE_ICONS = {
    hypothesis: 'M6 12.5h4M6.5 14h3M5 9.2a4 4 0 1 1 6 0c-.6.5-1 1.1-1 1.8H6c0-.7-.4-1.3-1-1.8z',
    evidence: 'M7 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM10 10l3.5 3.5',
    question: 'M6 6a2 2 0 1 1 3 1.7c-.6.4-1 .8-1 1.6M8 12.2v.2',
    conclusion: 'M4 14V2.5M4 3h8l-1.5 2.5L12 8H4',
    statusOpen: 'M8 2.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11z',
    statusInvestigating: 'M8 2.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11zM8 5v3.2l2 1.3',
    statusConfirmed: 'M8 2.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11zM5.3 8.3l1.9 1.9 3.6-4',
    statusRuledOut: 'M8 2.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11zM4.2 11.8l7.6-7.6',
    log: 'M2.5 3h11v10h-11zM5 6.5l2 1.5-2 1.5M8.5 10h2.5',
    diff: 'M2.5 2.5h11v11h-11zM8 4.5v4M6 6.5h4M6 11h4',
    service: 'M2.5 3.5h11v3h-11zM2.5 9.5h11v3h-11zM4.8 5h.01M4.8 11h.01',
    portal: 'M6.5 3.5H3.5v9h9V9.5M9.5 2.5h4v4M13.5 2.5l-6 6',
    map: 'M2 4l4-1.5 4 1.5 4-1.5v9.5l-4 1.5-4-1.5-4 1.5zM6 2.5v9.5M10 4v9.5',
    flow: 'M2.5 4.5h4a2 2 0 0 1 2 2v3a2 2 0 0 0 2 2h3M11 9l2.5 2.5L11 14',
    chevronRight: 'M6 3.5L10.5 8 6 12.5',
    chevronDown: 'M3.5 6L8 10.5 12.5 6',
    check: 'M3.5 8.5l3 3 6-7',
    search: 'M7 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM10 10l3.5 3.5',
    plus: 'M8 3v10M3 8h10',
    trash: 'M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5M7 7v4M9 7v4',
    duplicate: 'M5.5 5.5h7v8h-7zM3.5 10.5v-8h7',
    edit: 'M3 13l.6-3L10.5 3.1a1.4 1.4 0 0 1 2 2L5.6 12.4zM9.5 4.1l2.4 2.4',
    external: 'M6.5 3.5H3.5v9h9V9.5M9.5 2.5h4v4M13.5 2.5l-6 6',
    arrowNone: 'M2.5 8h11',
    arrowEnd: 'M2.5 8h11M10.5 5l3 3-3 3',
    arrowBoth: 'M2.5 8h11M10.5 5l3 3-3 3M5.5 5l-3 3 3 3',
    callers: 'M2.5 8h7M6.5 5l-3 3 3 3M12 4v8',
    callees: 'M13.5 8h-7M9.5 5l3 3-3 3M4 4v8',
    moreLines: 'M3 4h10M3 8h6M3 12h5M12 9.5v4M10 11.5h4',
    layout: 'M2.5 2.5h4.5v4.5H2.5zM9 2.5h4.5v4.5H9zM2.5 9H7v4.5H2.5zM9 9h4.5v4.5H9z',
    tag: 'M2.5 2.5h5l6 6-5 5-6-6zM5.5 5.5h.01',
    command: 'M5.5 3.5a2 2 0 1 0-2 2h9a2 2 0 1 0-2-2v9a2 2 0 1 0 2-2h-9a2 2 0 1 0 2 2z',
    minus: 'M3 8h10',
    pin: 'M9.6 1.5l4.9 4.9-.9.9-1.2-.4-2.6 2.6.4 2.5-.9.9-2.6-2.6-3.6 3.6-.7-.7 3.6-3.6-2.6-2.6.9-.9 2.5.4 2.6-2.6-.4-1.2z',
    fit: 'M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10',
    alignLeft: 'M2.5 2v12M5 4h8v3H5zM5 9h5v3H5z',
    alignCenterH: 'M8 2v12M3.5 4h9v3h-9zM5 9h6v3H5z',
    alignTop: 'M2 2.5h12M4 5h3v8H4zM9 5h3v5H9z',
    alignCenterV: 'M2 8h12M4 3.5h3v9H4zM9 5h3v6H9z',
    distributeH: 'M2.5 2v12M13.5 2v12M6.5 4.5h3v7h-3z',
    distributeV: 'M2 2.5h12M2 13.5h12M4.5 6.5h7v3h-7z',
    wand: 'M3 13l7-7M9.5 3.5v2M8.5 4.5h2M12.5 7.5v2M11.5 8.5h2M6 2.5v1.5M5.2 3.2h1.6',
    more: 'M3.5 8h.01M8 8h.01M12.5 8h.01',
    cloud: 'M4.5 12.5C2.5 12.5 1.5 11 1.5 9.5C1.5 8 2.7 6.9 4.2 6.8C4.6 4.8 6.2 3.5 8.2 3.5C10.3 3.5 11.9 4.9 12.2 6.9C13.8 7.1 14.5 8.2 14.5 9.6C14.5 11.2 13.3 12.5 11.7 12.5Z',
    shapes: 'M2.5 2.5h4.5v4.5H2.5zM11.25 2.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM5 9.5l2.6 4.5H2.4z M10 9.5h3.5V13H10z',
    key: 'M10.5 2.5a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM8.4 8.6L2.5 14.5M4.5 12.5l1.8 1.8M6.4 10.6l1.4 1.4',
    routeCurved: 'M2.5 12.5C7 12.5 9 3.5 13.5 3.5',
    routeElbow: 'M2.5 12.5H8V3.5h5.5',
    routeStraight: 'M2.5 12.5l11-9',
    lineSolid: 'M2 8h12',
    lineDashed: 'M2 8h3M6.5 8h3M11 8h3',
    lineDotted: 'M2 8h.01M5 8h.01M8 8h.01M11 8h.01M14 8h.01',
  } as const;

  export type IconName = keyof typeof ICONS | keyof typeof STROKE_ICONS;
</script>

<script lang="ts">
  let { name, size = 16 }: { name: IconName; size?: number } = $props();
</script>

{#if name in STROKE_ICONS}
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d={STROKE_ICONS[name as keyof typeof STROKE_ICONS]} />
  </svg>
{:else}
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
    <path d={ICONS[name as keyof typeof ICONS]} />
  </svg>
{/if}

<style>
  svg {
    flex: none;
    display: block;
  }
</style>
