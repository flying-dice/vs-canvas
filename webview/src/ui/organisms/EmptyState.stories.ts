import type { Meta, StoryObj } from '@storybook/svelte-vite';
import EmptyState from './EmptyState.svelte';

const meta = {
  title: 'Organisms/EmptyState',
  component: EmptyState,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof EmptyState>;
export default meta;
type Story = StoryObj<typeof meta>;

export const WithMcpUrl: Story = { args: { mcpUrl: 'http://127.0.0.1:3777/mcp' } };
export const WaitingForServer: Story = { args: { mcpUrl: null } };
