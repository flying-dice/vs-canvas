# Developing VS Canvas

Reference for contributors and for agents driving the extension. The Marketplace listing is [README.md](../README.md);
the file format is in [canvas-format.md](canvas-format.md) and the design language in [design.md](design.md).

## Connect an agent

Each VS Code window runs its own MCP server on `127.0.0.1`. The port is stable per project: it's derived from the
workspace folder name (3777–3976), so the same project gets the same port every time, whatever order you open
windows in. Set `vsCanvas.mcp.port` to choose one yourself. If the port is taken, the next free one is used, and
the status bar always shows the one in use.

- **VS Code agent mode / Copilot:** registered automatically as "VS Canvas", pointing at the window's own server.
- **Claude Code:** VS Canvas offers to add itself to the project's `.mcp.json` (or run
  **VS Canvas: Set Up Claude Code for This Workspace**). `claude` run in that folder then talks to that project's
  canvas; it asks you to approve the project server the first time. If the port ever changes, the entry is
  updated. The setting `vsCanvas.claudeCode.mcpJson` switches between `ask`, `always` and `never`. Because the
  port comes from the folder name, the file is safe to commit for teammates who clone into a folder of the same
  name.

**Agent skills.** `agent/skill.md` is the canonical guide for agents (when to use the canvas, playbooks, rules).
**VS Canvas: Install Agent Skills** renders it per harness (`src/agent/skills.ts`): Claude Code
(`.claude/skills/vs-canvas/SKILL.md`, project or user), Copilot (`.github/instructions/vs-canvas.instructions.md`),
Cursor (`.cursor/rules/vs-canvas.mdc`), Windsurf (`.windsurf/rules/vs-canvas.md`), Cline (`.clinerules/vs-canvas.md`),
and a marked section in `AGENTS.md` / `GEMINI.md` that is updated in place. The MCP server also sends a compact
version as its `instructions` (`src/mcp/instructions.ts`), which most clients add to the agent's context. Edit the
guide, then reinstall to update the files.

The server also provides prompts that encode good workflows: `map_repo`, `investigate_bug`, `explain_flow` and
`draw_diagram`.

| Tools | Purpose |
| --- | --- |
| `canvas_list`, `canvas_create`, `canvas_open`, `canvas_pin` | Manage canvases (kinds: map, investigation, flow, notes) |
| `canvas_open_file`, `canvas_highlight_lines`, `canvas_connect` | Code nodes, highlighted lines, line-anchored edges |
| `canvas_trace` | Build a caller/callee tree from the language server in one call |
| `canvas_add_service`, `canvas_add_portal`, `canvas_add_group` | Domain maps and drill-down into other canvases |
| `canvas_add_log`, `canvas_add_finding` | Stack traces and hypothesis/evidence cards for investigations |
| `canvas_add_flow`, `canvas_play_flow` | Data-flow playback |
| `canvas_add_note`, `canvas_add_sticky`, `canvas_add_text`, `canvas_add_mermaid`, `canvas_add_file_reference`, `canvas_add_link` | Explanations |
| `canvas_add_diff` | Diff card of two files; chain them to show data changing over a timeline |
| `canvas_update_node`, `canvas_remove`, `canvas_clear`, `canvas_layout`, `canvas_lint` | Edit, auto-layout, lint and fix |
| `canvas_get_state`, `canvas_focus` | Inspect, and move the viewer's camera |
| `code_symbols`, `code_call_hierarchy`, `code_definition` | Raw language-server data |

Canvas tools take an optional `canvas` (a workspace-relative path). By default they use the active canvas,
or create `canvases/scratch.canvas.json` (folder set by `vsCanvas.canvasDirectory`). Every edit returns any
lint issues it introduced, so the agent can fix its own layout.

Agents can also edit canvas files directly: [canvas-format.md](canvas-format.md) documents the
format, `schemas/canvas.schema.json` validates it, and `canvas-lint --fix` tidies the result.

## In the editor

- **Canvases** view in the Explorer, with pinned canvases first. Right-click to pin or unpin.
- **"On canvas" CodeLens** on code that appears in a canvas; click it to jump to the node.
- **Problems panel** entries and quick fixes from the canvas linter (rule severities are set in
  `vsCanvas.lint.rules`).

## Canvas linter

```sh
npx canvas-lint                 # all **/*.canvas.json; exits 1 on errors
npx canvas-lint --fix           # move/resize to resolve overlaps, straddled groups, clipped text, outliers
npx canvas-lint --format json   # for CI
```

Rules cover layout (overlaps, crowding, nodes straddling group borders, edges through nodes, label overlaps,
crossings, clipped text, far-away outliers) and structure (dangling or duplicate edges, invalid line anchors,
out-of-range highlights, missing files). Per-repo settings go in `.canvaslint.json`.

## Develop

```sh
npm install
npm run dev            # watch mode: rebuilds webview + extension on change
npm run build          # one-off build: webview (vite) + extension (esbuild) + canvas-lint CLI
npm test               # vitest: model, layout, trace, linter, playback, snapping
npm run check          # tsc + svelte-check
npm run storybook      # component explorer on http://localhost:6006
npx vite --port 5199   # webview in a browser; add ?demo=showcase or ?demo=agent
```

Press **F5** and choose **Run Extension (dev, watch)**. Webview changes reload open canvases automatically.
For extension-host changes, run **Developer: Restart Extension Host**. `examples/acme-shop` is a demo repo
with a planted double-charge bug, used for the showcase.

```
src/                 extension host: canvas documents + custom editor, MCP server, lint, layout, trace, views
  shared/            contracts shared with the webview: file format, messages, linter, geometry
  cli/               canvas-lint
webview/src/         canvas UI (Svelte 5 + Svelte Flow), styled with VS Code theme tokens
  ui/                presentational components, Atomic Design (atoms/molecules/organisms), with stories
  nodes/             Svelte Flow adapters
  lib/               camera, motion, playback, snapping, level-of-detail, search
schemas/, docs/      canvas JSON Schema, format guide for agents, design language
examples/acme-shop/  demo codebase
```

## Release

`.github/workflows/extension.yml` runs on every push and pull request: tests, type checks, build, `canvas-lint` on
the demo canvases, then packages `vs-canvas-<version>.vsix` and uploads it as the `vsix` build artifact.

Pushing a tag `vX.Y.Z` sets the extension version from the tag, creates a GitHub release with the `.vsix` attached
and, if the repository has a `VSCE_PAT` secret (an Azure DevOps token with Marketplace *Manage* scope), publishes it
to the Marketplace. Without the secret, upload the `.vsix` from the release at
https://marketplace.visualstudio.com/manage.

```sh
git tag v0.1.0 && git push origin v0.1.0
```

To package locally: `npm run package -- --baseContentUrl https://github.com/<owner>/<repo>/blob/main`
(the base URL rewrites the README's relative links for the Marketplace page).
