import type { Meta, StoryObj } from '@storybook/svelte-vite';
import { createRawSnippet } from 'svelte';
import Badge from './Badge.svelte';

const text = (t: string) => createRawSnippet(() => ({ render: () => `<span>${t}</span>` }));

const meta = { title: 'Atoms/Badge', component: Badge, tags: ['autodocs'] } satisfies Meta<typeof Badge>;
export default meta;
type Story = StoryObj<typeof meta>;

export const LineRange: Story = { args: { children: text('L12–34 of 210') } };
export const Short: Story = { args: { children: text('TS') } };
export const Count: Story = { args: { children: text('3') } };
