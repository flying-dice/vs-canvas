import type { Meta, StoryObj } from '@storybook/svelte-vite';
import { fn } from 'storybook/test';
import type { LintDiagnostic } from '../../../../src/shared/lint';
import IssuesPanel from './IssuesPanel.svelte';

const d = (severity: LintDiagnostic['severity'], rule: LintDiagnostic['rule'], message: string): LintDiagnostic => ({
  severity,
  rule,
  message,
  nodeIds: ['a'],
  edgeIds: [],
});

const diagnostics: LintDiagnostic[] = [
  d('error', 'dangling-edge', 'Edge "e4" points to missing node "gone".'),
  d('warning', 'node-overlap', 'Sticky "TODO: rate limit" overlaps "authenticate()" by 40x22 px.'),
  d('warning', 'edge-through-node', 'Edge "e1" passes through "Auth flow".'),
  d('warning', 'text-overflow', 'Note "Flow" text is likely clipped (needs ~260px height, has 200px).'),
  d('info', 'far-outlier', 'Node "Old idea" is 3400px away from the rest of the canvas.'),
];

const meta = {
  title: 'Organisms/IssuesPanel',
  component: IssuesPanel,
  tags: ['autodocs'],
  args: { diagnostics, onselect: fn(), onclose: fn() },
} satisfies Meta<typeof IssuesPanel>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Mixed: Story = {};
export const WarningsOnly: Story = { args: { diagnostics: diagnostics.filter((x) => x.severity === 'warning') } };
export const Empty: Story = { args: { diagnostics: [] } };
export const Many: Story = {
  args: { diagnostics: Array.from({ length: 24 }, (_, i) => d(i % 3 ? 'warning' : 'info', 'node-crowded', `Node ${i} is 10px from node ${i + 1}.`)) },
};
