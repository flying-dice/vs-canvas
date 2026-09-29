import type { Meta, StoryObj } from '@storybook/svelte-vite';
import { fn } from 'storybook/test';
import type { CodeCardData } from '../types';
import type { Token } from '../atoms/CodeText.svelte';
import CodeCard from './CodeCard.svelte';

const lines = [
  "import { createServer } from 'node:http';",
  "import type { Tool } from './tools';",
  '',
  'export interface ServerOptions {',
  '  port: number;',
  '  tools: Tool[];',
  '}',
  '',
  '// Start the local MCP server and return a disposer.',
  'export async function startServer(options: ServerOptions) {',
  '  const server = createServer(async (req, res) => {',
  "    if (req.method !== 'POST') {",
  '      res.writeHead(405).end();',
  '      return;',
  '    }',
  '    const body = await readBody(req);',
  '    const result = await dispatch(options.tools, body);',
  "    res.setHeader('content-type', 'application/json');",
  '    res.end(JSON.stringify(result));',
  '  });',
  "  await new Promise<void>((ok) => server.listen(options.port, '127.0.0.1', ok));",
  '  return () => server.close();',
  '}',
];

// Hand-written tokens (dark-plus / light-plus palettes), keyed per line.
type P = 'kw' | 'str' | 'id' | 'fn' | 'ty' | 'cm' | 'pl' | 'num' | 'var';
const dark: Record<P, string> = { kw: '#569cd6', str: '#ce9178', id: '#9cdcfe', fn: '#dcdcaa', ty: '#4ec9b0', cm: '#6a9955', pl: '#d4d4d4', num: '#b5cea8', var: '#4fc1ff' };
const light: Record<P, string> = { kw: '#0000ff', str: '#a31515', id: '#001080', fn: '#795e26', ty: '#267f99', cm: '#008000', pl: '#000000', num: '#098658', var: '#0070c1' };

const spec: [P, string][][] = [
  [['kw', 'import'], ['pl', ' { '], ['id', 'createServer'], ['pl', ' } '], ['kw', 'from'], ['pl', ' '], ['str', "'node:http'"], ['pl', ';']],
  [['kw', 'import type'], ['pl', ' { '], ['ty', 'Tool'], ['pl', ' } '], ['kw', 'from'], ['pl', ' '], ['str', "'./tools'"], ['pl', ';']],
  [],
  [['kw', 'export interface'], ['pl', ' '], ['ty', 'ServerOptions'], ['pl', ' {']],
  [['pl', '  '], ['id', 'port'], ['pl', ': '], ['ty', 'number'], ['pl', ';']],
  [['pl', '  '], ['id', 'tools'], ['pl', ': '], ['ty', 'Tool'], ['pl', '[];']],
  [['pl', '}']],
  [],
  [['cm', '// Start the local MCP server and return a disposer.']],
  [['kw', 'export async function'], ['pl', ' '], ['fn', 'startServer'], ['pl', '('], ['id', 'options'], ['pl', ': '], ['ty', 'ServerOptions'], ['pl', ') {']],
  [['pl', '  '], ['kw', 'const'], ['pl', ' '], ['var', 'server'], ['pl', ' = '], ['fn', 'createServer'], ['pl', '('], ['kw', 'async'], ['pl', ' ('], ['id', 'req'], ['pl', ', '], ['id', 'res'], ['pl', ') => {']],
  [['pl', '    '], ['kw', 'if'], ['pl', ' ('], ['id', 'req'], ['pl', '.'], ['id', 'method'], ['pl', ' !== '], ['str', "'POST'"], ['pl', ') {']],
  [['pl', '      '], ['id', 'res'], ['pl', '.'], ['fn', 'writeHead'], ['pl', '('], ['num', '405'], ['pl', ').'], ['fn', 'end'], ['pl', '();']],
  [['pl', '      '], ['kw', 'return'], ['pl', ';']],
  [['pl', '    }']],
  [['pl', '    '], ['kw', 'const'], ['pl', ' '], ['var', 'body'], ['pl', ' = '], ['kw', 'await'], ['pl', ' '], ['fn', 'readBody'], ['pl', '('], ['id', 'req'], ['pl', ');']],
  [['pl', '    '], ['kw', 'const'], ['pl', ' '], ['var', 'result'], ['pl', ' = '], ['kw', 'await'], ['pl', ' '], ['fn', 'dispatch'], ['pl', '('], ['id', 'options'], ['pl', '.'], ['id', 'tools'], ['pl', ', '], ['id', 'body'], ['pl', ');']],
  [['pl', '    '], ['id', 'res'], ['pl', '.'], ['fn', 'setHeader'], ['pl', '('], ['str', "'content-type'"], ['pl', ', '], ['str', "'application/json'"], ['pl', ');']],
  [['pl', '    '], ['id', 'res'], ['pl', '.'], ['fn', 'end'], ['pl', '('], ['ty', 'JSON'], ['pl', '.'], ['fn', 'stringify'], ['pl', '('], ['id', 'result'], ['pl', '));']],
  [['pl', '  });']],
  [['pl', '  '], ['kw', 'await new'], ['pl', ' '], ['ty', 'Promise'], ['pl', '<'], ['ty', 'void'], ['pl', '>(('], ['id', 'ok'], ['pl', ') => '], ['id', 'server'], ['pl', '.'], ['fn', 'listen'], ['pl', '('], ['id', 'options'], ['pl', '.'], ['id', 'port'], ['pl', ', '], ['str', "'127.0.0.1'"], ['pl', ', '], ['id', 'ok'], ['pl', '));']],
  [['pl', '  '], ['kw', 'return'], ['pl', ' () => '], ['id', 'server'], ['pl', '.'], ['fn', 'close'], ['pl', '();']],
  [['pl', '}']],
];
const tokenize = (pal: Record<P, string>): Token[][] =>
  spec.map((row, i) => (row.length ? row.map(([k, c]) => ({ content: c, color: pal[k] })) : [{ content: lines[i] }]));

const data: CodeCardData = {
  file: 'src/server/http.ts',
  title: 'HTTP server bootstrap',
  code: {
    absPath: '/work/vs-canvas/src/server/http.ts',
    language: 'typescript',
    firstLine: 1,
    lines,
    totalLines: 180,
  },
  highlights: [
    { id: 'h1', start: 10, end: 10, color: '3', label: 'entry point' },
    { id: 'h2', start: 12, end: 15, color: '1', label: 'guard' },
    { id: 'h3', start: 16, end: 17, color: '5', label: 'dispatch' },
    { id: 'h4', start: 21, end: 21, color: '4', label: 'listens' },
    { id: 'h5', start: 9, end: 9, color: '6' },
    { id: 'h6', start: 22, end: 22, color: '2', label: 'disposer' },
    { id: 'h7', start: 5, end: 5, color: '#ff66aa', label: 'hex color' },
  ],
};

const meta = {
  title: 'Organisms/CodeCard',
  component: CodeCard,
  tags: ['autodocs'],
  args: { data, tokens: tokenize(dark), selected: false, onlineclick: fn() },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof CodeCard>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Highlighted: Story = {};
/** Newly added highlights flash once on mount (the canvas passes pulseIds for highlights that just appeared). */
export const PulseNewHighlights: Story = { args: { pulseIds: ['h1', 'h3'] } };
export const Selected: Story = { args: { selected: true } };
export const PlainText: Story = { args: { tokens: null, data: { ...data, title: undefined, highlights: [] } } };
export const PlainWithHighlights: Story = { args: { tokens: null } };
/** Uses light-plus token colors; switch the toolbar theme to Light. */
export const LightThemeFriendly: Story = { args: { tokens: tokenize(light) }, globals: { theme: 'light' } };
export const Excerpt: Story = {
  args: {
    data: { ...data, code: { ...data.code, firstLine: 10, lines: lines.slice(9, 16) }, highlights: [{ id: 'x', start: 12, end: 13, color: '3', label: 'check' }] },
    tokens: tokenize(dark).slice(9, 16),
  },
};
export const Truncated: Story = {
  args: { data: { ...data, code: { ...data.code, truncated: true } } },
};
/** The file was deleted or moved: ResolvedCode.error is set. */
export const ErrorFileMissing: Story = {
  args: {
    tokens: null,
    data: {
      file: 'src/server/removed.ts',
      code: { absPath: '/work/vs-canvas/src/server/removed.ts', language: 'typescript', firstLine: 1, lines: [], totalLines: 0, error: 'File not found: src/server/removed.ts' },
      highlights: [],
    },
  },
};
export const ErrorSelected: Story = { args: { ...ErrorFileMissing.args, selected: true } };

/** Semantic zoom: far shows the file name and highlight labels as big chips; the card keeps its size. */
export const LodFar: Story = { args: { lod: 'far' } };
export const LodFarWithTitle: Story = { args: { lod: 'far', data: { ...data, title: 'HTTP server bootstrap' } } };
export const LodMid: Story = { args: { lod: 'mid' } };
