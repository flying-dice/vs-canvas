import type { LineHighlight, ResolvedCode } from '../../../src/shared/protocol';

/** Everything CodeCard needs to render a code file node. */
export type CodeCardData = {
  /** Workspace-relative path. */
  file: string;
  title?: string;
  code: ResolvedCode;
  highlights: LineHighlight[];
};
