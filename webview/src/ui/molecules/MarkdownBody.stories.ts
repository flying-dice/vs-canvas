import type { Meta, StoryObj } from '@storybook/svelte-vite';
import MarkdownBody from './MarkdownBody.svelte';

const meta = {
  title: 'Molecules/MarkdownBody',
  component: MarkdownBody,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
} satisfies Meta<typeof MarkdownBody>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Rich: Story = {
  args: {
    markdown: `# Request lifecycle

An incoming request passes through three stages:

1. **Parse** the JSON-RPC envelope
2. *Route* it to a tool handler
3. Serialize the result with \`JSON.stringify\`

## Example

\`\`\`ts
const result = await tool.handler(args);
return { content: [{ type: 'text', text: String(result) }] };
\`\`\`

- Errors are returned, never thrown
- See the [MCP spec](https://modelcontextprotocol.io)

> Note: handlers must be idempotent.
`,
  },
};
export const Paragraph: Story = { args: { markdown: 'Just a short paragraph with `inline code`.' } };
export const Empty: Story = { args: { markdown: '' } };
export const WithMermaidFence: Story = {
  args: {
    markdown: `Text before.

\`\`\`mermaid
flowchart TD
  A[Start] --> B{Ok?}
  B -- yes --> C[Done]
  B -- no --> A
\`\`\`

Text after, with \`inline code\`.
`,
  },
};
export const InvalidMermaidFence: Story = { args: { markdown: '```mermaid\nflowchart LR\n  A --> -->\n```' } };
export const LightMode: Story = { args: { mode: 'light', markdown: '```mermaid\nflowchart LR\n  A --> B\n```' }, globals: { theme: 'light' } };
