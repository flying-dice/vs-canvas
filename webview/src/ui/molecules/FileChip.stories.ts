import type { Meta, StoryObj } from '@storybook/svelte-vite';
import { fn } from 'storybook/test';
import FileChip from './FileChip.svelte';

const meta = {
  title: 'Molecules/FileChip',
  component: FileChip,
  tags: ['autodocs'],
  args: { file: 'src/auth/index.ts', onclick: fn() },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof FileChip>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const RootFile: Story = { args: { file: 'package.json' } };
export const WithRange: Story = { args: { lines: [10, 42] } };
export const SingleLine: Story = { args: { lines: [7, 7] } };
export const WithTitle: Story = { args: { title: 'authenticate()', lines: [1, 40] } };
