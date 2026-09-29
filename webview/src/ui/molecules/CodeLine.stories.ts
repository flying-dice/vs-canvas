import type { Meta, StoryObj } from '@storybook/svelte-vite';
import { fn } from 'storybook/test';
import CodeLine from './CodeLine.svelte';

const tokens = [
  { content: 'const', color: '#569cd6' },
  { content: ' server', color: '#4fc1ff' },
  { content: ' = ', color: '#d4d4d4' },
  { content: 'createServer', color: '#dcdcaa' },
  { content: '(', color: '#d4d4d4' },
  { content: 'options', color: '#9cdcfe' },
  { content: ');', color: '#d4d4d4' },
];

const meta = {
  title: 'Molecules/CodeLine',
  component: CodeLine,
  tags: ['autodocs'],
  args: { n: 12, text: 'const server = createServer(options);', onlineclick: fn() },
  argTypes: { color: { control: 'select', options: [undefined, '1', '2', '3', '4', '5', '6', '#ff66aa'] } },
  parameters: {
    layout: 'padded',
  },
} satisfies Meta<typeof CodeLine>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Plain: Story = {};
export const Tokenized: Story = { args: { tokens } };
export const Highlighted: Story = { args: { tokens, color: '3' } };
export const WithPill: Story = {
  args: { tokens, color: '4', pills: [{ id: 'p1', color: '4', label: 'creates server' }] },
};
export const MultiplePills: Story = {
  args: {
    tokens,
    color: '1',
    pills: [
      { id: 'p1', color: '1', label: 'bug' },
      { id: 'p2', color: '5', label: 'see #4' },
    ],
  },
};
/** Flashes once on mount; used when a highlight has just been added. */
export const Pulse: Story = { args: { tokens, color: '3', pulse: true } };
