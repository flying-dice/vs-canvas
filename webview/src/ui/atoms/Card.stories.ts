import type { Meta, StoryObj } from '@storybook/svelte-vite';
import { createRawSnippet } from 'svelte';
import Card from './Card.svelte';

const body = createRawSnippet(() => ({
  render: () => `<div style="padding:12px 16px;width:280px;font-family:var(--vscode-font-family)">Card content goes here.</div>`,
}));

const meta = {
  title: 'Atoms/Card',
  component: Card,
  tags: ['autodocs'],
  args: { children: body },
  argTypes: { accent: { control: 'text' } },
} satisfies Meta<typeof Card>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Selected: Story = { args: { selected: true } };
export const Accented: Story = { args: { accent: 'var(--vscode-charts-green)' } };
export const AccentedSelected: Story = { args: { accent: 'var(--vscode-charts-purple)', selected: true } };
