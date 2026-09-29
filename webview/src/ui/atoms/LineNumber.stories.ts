import type { Meta, StoryObj } from '@storybook/svelte-vite';
import { fn } from 'storybook/test';
import LineNumber from './LineNumber.svelte';

const meta = {
  title: 'Atoms/LineNumber',
  component: LineNumber,
  tags: ['autodocs'],
  args: { n: 42, onclick: fn() },
} satisfies Meta<typeof LineNumber>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const ThreeDigits: Story = { args: { n: 128 } };
