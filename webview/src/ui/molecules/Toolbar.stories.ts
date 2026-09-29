import type { Meta, StoryObj } from '@storybook/svelte-vite';
import { fn } from 'storybook/test';
import Toolbar from './Toolbar.svelte';

const items = [
  { id: 'sticky', label: 'Sticky', title: 'Add a sticky note', icon: 'sticky' },
  { id: 'text', label: 'Text', icon: 'text' },
  { id: 'note', label: 'Note', icon: 'note' },
  { id: 'mermaid', label: 'Mermaid', icon: 'mermaid' },
  { id: 'group', label: 'Group', icon: 'group' },
] as const;

const meta = {
  title: 'Molecules/Toolbar',
  component: Toolbar,
  tags: ['autodocs'],
  args: { items: [...items], onselect: fn() },
} satisfies Meta<typeof Toolbar>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const WithCaption: Story = { args: { caption: 'docs/architecture.canvas.json' } };
export const LongCaption: Story = {
  args: { caption: 'packages/extension/docs/design/some/very/deeply/nested/architecture-overview.canvas.json' },
};
export const WithIssues: Story = { args: { caption: 'docs/architecture.canvas.json', issueCount: 3, issueSeverity: 'warning', onissues: fn() } };
export const WithErrors: Story = { args: { issueCount: 1, issueSeverity: 'error', onissues: fn() } };
export const IssuesOpen: Story = { args: { issueCount: 5, issueSeverity: 'info', issuesOpen: true, onissues: fn() } };
