import type { Meta, StoryObj } from '@storybook/svelte-vite';
import NodeHeader from './NodeHeader.svelte';

const meta = {
  title: 'Molecules/NodeHeader',
  component: NodeHeader,
  tags: ['autodocs'],
  args: { relPath: 'src/server/mcp.ts', path: '/work/vs-canvas/src/server/mcp.ts' },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof NodeHeader>;
export default meta;
type Story = StoryObj<typeof meta>;

export const PathOnly: Story = {};
export const WithTitle: Story = { args: { title: 'MCP server bootstrap' } };
export const WithTitleAndBadge: Story = { args: { title: 'MCP server bootstrap', badge: 'L10–42 of 210' } };
export const LongPathTruncates: Story = {
  args: {
    relPath: 'packages/extension/src/server/transports/streamable-http/session-manager.ts',
    title: 'A rather long descriptive title that should truncate',
    badge: 'L1–20 of 900',
  },
};
