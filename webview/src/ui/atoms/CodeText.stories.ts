import type { Meta, StoryObj } from '@storybook/svelte-vite';
import CodeText from './CodeText.svelte';

const meta = {
  title: 'Atoms/CodeText',
  component: CodeText,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
} satisfies Meta<typeof CodeText>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Tokens: Story = {
  args: {
    text: 'export const answer: number = 42;',
    tokens: [
      { content: 'export', color: '#569cd6' },
      { content: ' ', color: '#d4d4d4' },
      { content: 'const', color: '#569cd6' },
      { content: ' answer', color: '#4fc1ff' },
      { content: ': ', color: '#d4d4d4' },
      { content: 'number', color: '#4ec9b0' },
      { content: ' = ', color: '#d4d4d4' },
      { content: '42', color: '#b5cea8' },
      { content: ';', color: '#d4d4d4' },
    ],
  },
};
export const PlainText: Story = { args: { text: 'no tokens, just plain text', tokens: null } };
