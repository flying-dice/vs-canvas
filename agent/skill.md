# VS Canvas

VS Canvas puts code on an infinite canvas inside VS Code. You drive it through the `vs-canvas` MCP server
(tools named `canvas_*` and `code_*`). The user watches the canvas update live beside their code, and every canvas
is a `*.canvas.json` file in the repo, so what you build is saved and can be committed.

## When to use it

Reach for the canvas whenever a picture beats a paragraph. Use it without being asked when you are:

- **explaining how something works** across more than two files or functions (a request, a job, a data pipeline);
- **tracing a bug** that spans several call sites, or weighing more than one hypothesis;
- **orienting in an unfamiliar repo** (domains, services, entry points, how they talk);
- **drawing a diagram** the user asked for: architecture (C4), flowchart, UML class, ERD, sequence, BPMN.

Keep answering in chat as usual; the canvas is the shared picture, not a replacement for your explanation. Tell
the user which canvas you used (the tools return its path).

## Playbooks

Start with `canvas_create` (pick `kind`: `map`, `investigation`, `flow` or `notes`) or `canvas_list` +
`canvas_open` to extend an existing canvas. The MCP prompts `map_repo`, `investigate_bug`, `explain_flow` and
`draw_diagram` expand these into step-by-step instructions.

**Explain a flow or trace a call path**
1. `canvas_trace` from the entry symbol (`direction` `outgoing` for "what does this call", `incoming` for "who
   calls this"). It adds the code nodes, line-anchored edges and layout in one call. Prefer it to adding nodes
   one by one.
2. `canvas_highlight_lines` on the lines that matter, with short labels.
3. For data moving through the code, `canvas_add_flow` with one step per hop and the payload at that point in
   `data` (e.g. `Order{ id: 812, total: 49.00 }`), then `canvas_play_flow`.

**Investigate a bug**
1. `canvas_create` with `kind: "investigation"`.
2. `canvas_add_log` with the stack trace or log; its `file:line` frames become clickable.
3. `canvas_open_file` / `canvas_trace` for the failing frames; connect the log to the failing line.
4. One `canvas_add_finding` per hypothesis (`kind: "hypothesis"`), then update `status` as you learn:
   `investigating` → `confirmed` or `ruled-out`. Put the evidence in the finding's text.
5. Mark the root-cause line red with a label that states the cause.

**Map a repo**
1. `canvas_create` with `kind: "map"` and `pinned: true`.
2. One `canvas_add_service` per domain or service, with 2–4 real `entryPoints`; group related services with
   `canvas_add_group` (colour `domain`).
3. Connect services that call each other; `canvas_add_portal` to link deeper canvases.
4. Optionally a C4 container view with `canvas_add_diagram`.

**Show data changing**
`canvas_add_diff` with `left` (before) and `right` (after) files, e.g. `order.0.json` and `order.1.json`, placed
under the code that made the change (`attachTo` the code node). Chain the next diff (`order.1.json` →
`order.2.json`) beside it, then `canvas_add_flow` with steps whose `node` is each diff to play the timeline.

**Draw a diagram**
Use `canvas_add_diagram` to build a whole diagram in one call: `library` (`c4`, `flowchart`, `uml`, `erd`,
`arch`, `bpmn`), `nodes` with shape ids and fields, `edges` with `relation` presets; it lays itself out. Call
`canvas_list_shapes` once if you need the shape ids or field names. For sequence diagrams use
`canvas_add_mermaid`.

## Rules that keep canvases good

- **Colour is meaning.** Use the names `failure` (root cause, error path), `investigating`, `attention` (a
  key line), `confirmed`, `flow` (data in motion) and `domain` (a boundary). Leave neutral things uncoloured.
- **Anchor to lines.** Connect code nodes on the lines that make the call (`sourceLine` / `targetLine`), not just
  node to node. Show focused ranges (`startLine`/`endLine`, about 5–30 lines), not whole files.
- **Place deliberately.** Use `near` + `side` when adding related nodes, and build diagrams with
  `canvas_add_diagram` or `canvas_trace` rather than many single adds. Finish with `canvas_layout` if the board
  grew organically.
- **Fix what the linter reports.** Every edit returns a `lint` list for what you just changed (overlaps, nodes
  straddling a group border, edges through cards, clipped text). Resolve it: move the node, or call
  `canvas_lint` with `fix: true`. Don't leave warnings behind.
- **Show the user.** Mutating tools focus the camera on what changed. Use `canvas_focus` with `nodeIds` to
  point at something specific while you explain it.
- **Keep text short.** Titles of a few words; put detail in notes, findings or your chat answer.
- **Paths are workspace-relative.** Use the repo's real files and line numbers; check with `code_symbols` or
  by reading the file before anchoring.

## If the tools are not available

The MCP server runs inside VS Code while VS Canvas is installed and the workspace is trusted. If no `canvas_*`
tools are available, say so and suggest the user open the folder in VS Code (for Claude Code: run
**VS Canvas: Set Up Claude Code for This Workspace**). As a fallback you can write `*.canvas.json` files
directly: they are JSON Canvas 1.0 (`nodes` with `id`, `type`, `x`, `y`, `width`, `height`; `edges` with
`fromNode`/`toNode`), with extensions validated by the schema VS Canvas registers for `*.canvas.json`.
