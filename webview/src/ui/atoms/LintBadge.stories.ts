import type { Meta, StoryObj } from '@storybook/svelte-vite';
import LintBadge from './LintBadge.svelte';

const meta = {
  title: 'Atoms/LintBadge',
  component: LintBadge,
  tags: ['autodocs'],
  args: { severity: 'warning', messages: ['Overlaps "Auth flow" by 40x22 px'] },
} satisfies Meta<typeof LintBadge>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Warning: Story = {};
export const Error: Story = { args: { severity: 'error', messages: ['Edge points to missing node "x"'] } };
export const Info: Story = { args: { severity: 'info', messages: ['Node is far from the rest of the canvas'] } };
export const Multiple: Story = {
  args: { severity: 'error', messages: ['Edge points to missing node "x"', 'Overlaps "Auth flow"', 'Text is clipped'] },
};
