// Pure helpers that map canvas JSON text to line numbers (no vscode import, so they are unit-tested).

/** Zero-based line number of a character index. */
export function lineAt(text: string, index: number): number {
  let line = 0;
  for (let i = 0; i < index; i++) if (text.charCodeAt(i) === 10) line++;
  return line;
}

/** Line of `"id": "<id>"` in the JSON text (0 when not found). */
export function lineOfId(text: string, id: string | undefined): number {
  if (!id) return 0;
  const m = new RegExp(`"id"\\s*:\\s*${JSON.stringify(id).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).exec(text);
  return m ? lineAt(text, m.index) : 0;
}

/**
 * Line of the `"flows"` key inside the metadata object (0 when not found). Metadata is serialized after nodes and
 * edges, so the last `vsCanvas` / `canvasIde` key starts it; searching from there ignores a node's own `flows`
 * property. Falls back to the metadata key's line.
 */
export function lineOfFlowsKey(text: string): number {
  let meta: RegExpExecArray | null = null;
  for (const m of text.matchAll(/"(vsCanvas|canvasIde)"\s*:/g)) meta = m;
  if (!meta) return 0;
  const flows = /"flows"\s*:/.exec(text.slice(meta.index));
  return lineAt(text, flows ? meta.index + flows.index : meta.index);
}
