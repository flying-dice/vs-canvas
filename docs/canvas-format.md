# Editing `*.canvas.json` directly (guide for LLM agents)

Canvases are JSON Canvas 1.0 files plus a few extensions. Schema: `schemas/canvas.schema.json` (add `"$schema": "../schemas/canvas.schema.json"` for editor validation/completion). **After editing, run `npx canvas-lint --fix`** and fix what remains.

## Shape

```json
{
  "nodes": [ /* draw order: later = on top. Groups FIRST. */ ],
  "edges": [ /* arrows */ ],
  "vsCanvas": { "version": 1, "title": "Auth flow", "description": "...", "kind": "map", "pinned": true, "flows": [] }
}
```

- Coordinates are px, x to the right, y **down**. Every node has `id` (unique across nodes, edges and highlights; use `code-1`, `note-2`, `edge-3`), `type`, `x`, `y`, `width`, `height`, optional `color`.
- `color`: preset `"1"` red `"2"` orange `"3"` yellow `"4"` green `"5"` cyan `"6"` purple, or `"#rrggbb"`.
- **Semantic colours** (use consistently): `"1"` red = failure path / root cause, `"2"` orange = under investigation, `"3"` yellow = attention / key line, `"4"` green = confirmed / healthy, `"5"` cyan = data in motion / flow, `"6"` purple = domain boundary (groups). MCP tools accept these as names too: `failure`, `investigating`, `attention`, `confirmed`, `flow`, `domain` (and `blue` = cyan).

## Node types

| type | fields | typical size |
|---|---|---|
| `text` | `text` (markdown), `variant`: `note` (default card, optional `title`), `sticky` (short remark, use color), `plain` (title text, no card; `# Heading` renders large), `mermaid` (`text` is Mermaid source, no fences) | note 360x220, sticky 220x180, plain 400x60, mermaid 480x360 |
| `text` + `variant` `finding` | `title`, `text`, `findingKind` (`hypothesis`\|`evidence`\|`question`\|`conclusion`), `status` (`open`\|`investigating`\|`confirmed`\|`ruled-out`); colour by status: investigating `"2"`, confirmed `"4"`, others none | 280x150 |
| `text` + `variant` `log` | `text` = log / stack trace (`file:line` frames are clickable), `errorLines` (1-based lines within `text`, drawn red), `title` | 520 x (40 + 18/line, max 420) |
| `text` + `variant` `service` | `title` (name), `text` (description), `entryPoints: [{file, lines?: [a,b], label}]`, `tags`, `canvas` (drill-down `*.canvas.json`); shows entry points, then code, as you zoom | 320x200 |
| `file` | `file` (workspace-relative, `/` separators), `display`: `code` (default; live source), `reference` (chip 320x56) or `diff` (line diff of `diffFrom` (left, before) against `file` (right, after); whole files, `lines`/`highlights` ignored, no line anchors), `lines: [first, last]` (1-based, inclusive; omit = whole file), `highlights: [{id, start, end, color?, label?}]`, `title`; keep `subpath` = `"#L<first>-L<last>"` in sync with `lines` | code: width 420-1000, height = 18 * lineCount + 36; diff: 560x420 (scrolls inside) |
| `file` with `file: "x.canvas.json"` | portal: live thumbnail of another canvas, opens it on click | 360x240 |
| `link` | `url` (http/https), `title` | 320x72 |
| `text` + `variant` `shape` | diagram shape: `shape` (id `<library>.<name>`, see [Shapes](#shapes)), `text` (label), `fields` | per shape (`size` in `src/shared/shapes.ts`) |
| `group` | `label`; frame shapes add `shape` + `sublabel` | fit around members |

Never store file contents in the canvas; code is read from the workspace.

## Edges

`{ "id", "fromNode", "toNode", "label"?, "sublabel"?, "color"?, "fromSide"?, "toSide"?, "fromLine"?, "toLine"?, "toEnd"?, "fromEnd"?, "animated"?, "relation"?, "fromMarker"?, "toMarker"?, "lineStyle"?, "routing"? }`

- Default handles: leaves the source's **right** side midpoint, enters the target's **left** side midpoint. Override with `fromSide`/`toSide` (`top|right|bottom|left`).
- `fromLine` / `toLine` anchor to a file line of a **code** node (must be inside its `lines`, or inside the file when `lines` is omitted). The anchor sits on the node's right edge (source) / left edge (target) at that line's height: `y = node.y + 31 + 4 + (line - firstLine + 0.5) * 18`.
- Lay flows out left to right (targets to the right of sources) to avoid loops back across the canvas. Label edges briefly ("1. validates input"); labels are drawn at the curve midpoint, so leave >= 150px between nodes on labeled edges.

## Shapes

Diagram shapes come in six libraries; the full registry (ids, sizes, fields, relation presets) is `src/shared/shapes.ts` (or the MCP tool `canvas_list_shapes`).

| library | shapes (`<library>.<name>`) | default relation |
|---|---|---|
| `flowchart` | process, decision, terminator, io, document, multi-document, database, subprocess, manual-input, preparation, delay, display, connector, off-page | `flow.next` |
| `uml` | class, interface, enum, object, actor, use-case, component, node, package (frame), note, state, initial, final, choice, fork, activity | `uml.association` |
| `c4` | person, person-external, system, system-external, container, container-db, container-queue, container-web, component, boundary (frame) | `c4.uses` |
| `erd` | entity, view | `erd.one-to-many` |
| `arch` | service, database, cache, queue, gateway, load-balancer, cdn, client, mobile, function, storage, user, external, region (frame) | `arch.calls` |
| `bpmn` | task, subprocess, start, intermediate, end, gateway-exclusive, gateway-parallel, data-object, pool (frame) | `bpmn.sequence` |

- **Shape node**: `{ "type": "text", "variant": "shape", "shape": "c4.container", "text": "API\nHandles orders", "fields": { "technology": "Node.js" }, ... }`. `id` prefix `shape-`. `text` is the label (for c4/arch top-layout shapes the first line is the name, further lines the description). `fields` keys per shape: text fields are strings (`technology`, `stereotype`), list fields arrays of lines (`attributes`, `methods`, `values`, `actions`, ERD `columns` like `"id uuid PK"`, `"user_id uuid FK"`). Omit `width`/`height` to get the shape's default size; grow `height` for long text or many field lines (`text-overflow` estimates: header 32px + 20px per field line for UML/ERD compartments; label wraps in ~70% of the width for decision/terminator/io).
- **Frames**: a `group` with `shape` (`c4.boundary`, `uml.package`, `arch.region`, `bpmn.pool`) plus `label` and `sublabel` (e.g. `"Software System"`). Same rules as groups (list first, ~40px padding, top 36px free).
- **Data layer / timeline.** Put a row of diff nodes (`order.0.json` -> `order.1.json` -> `order.2.json`, each a `display: "diff"` file node with `diffFrom`) beneath the code nodes that produce each change, connect code -> diff ("writes") and diff -> diff ("then"), and let a flow visit them with `node` steps. MCP: `canvas_add_diff`. See `examples/acme-shop/canvases/order-data.canvas.json`.
- **Unknown shape ids** are kept and drawn as a plain card, but flagged by the `unknown-shape` lint error.
- **Edge markers**: `fromMarker` / `toMarker` are one of `none arrow open-arrow triangle diamond diamond-filled circle crow-one crow-zero-one crow-many crow-one-many crow-zero-many`. They win over `fromEnd`/`toEnd`, which writers keep at the closest `none`/`arrow` so other JSON Canvas tools still draw something.
- **`lineStyle`**: `solid` (default) `dashed` `dotted`. **`routing`**: `bezier` (default), `orthogonal` (right angles, 8px rounded corners; label at the path centre), `straight`.
- **`relation`** presets: `flow.next`, `uml.association|inheritance|realization|dependency|aggregation|composition|transition`, `c4.uses`, `erd.one-to-one|one-to-many|zero-to-many|many-to-many`, `arch.calls|publishes|reads`, `bpmn.sequence|message`. A relation implies markers, `lineStyle` and `routing`; explicit fields on the edge win. MCP `canvas_connect` and `canvas_add_diagram` fill the preset in for you; writing the JSON yourself, set `relation` and the markers.
- `sublabel` on an edge is a second line under the label (C4 technology, e.g. `"JSON/HTTPS"`).
- For diagrams use MCP `canvas_add_diagram`: one call builds nodes, layout, edges and frame.

## Metadata and flows

`vsCanvas.kind`: `map` \| `investigation` \| `flow` \| `notes` (sidebar icon). `vsCanvas.pinned: true` lists the canvas first in the Canvases view and opens it with *Canvas: Open Pinned Map*.
`vsCanvas.flows`: `[{ "id": "flow-1", "title", "description"?, "steps": [{ "id": "step-1", "edge"?: edgeId, "node"?: nodeId, "lines"?: [a, b], "caption"?, "data"?: "Order{ id: 812 }", "parallel"?: true, "durationMs"?: 1200 }] }]`. A step travels an edge (or appears at a node), lights the target `lines`, and shows `data` next to the packet; `parallel` starts it with the previous step (a fork). Play with MCP `canvas_play_flow`.

## Layout rules (what the linter checks)

- **No overlaps**: keep at least 24px between nodes (`node-overlap` is an error, `node-crowded` a warning). Use 80px between neighbours. New nodes go *after* existing ones in the array; the linter moves later nodes, never earlier ones.
- **Groups are frames**. A node belongs to a group when its rect is fully inside. Never let a node cross a group border (`group-straddle`): fully inside or fully outside. Keep the top 36px of a group free (label tab; `group-label-covered`). Put group padding of ~40px around members, and list the group before its members in `nodes` (`group-order`).
- **Text must fit**: ~7.5px per character wrapping at `width - 24`, 20px per line, 24px padding (`text-overflow`); grow `height`. Shapes use a per-layout estimate (see Shapes).
- **Edges should not cross other nodes** (`edge-through-node`; orthogonal edges are checked along their right-angle path), labels should not cover nodes (`edge-label-overlap`), and crossings should be few (`edge-crossing`, more than 4 reported).
- **No far-flung nodes** (`far-outlier`, > 2000px from anything).
- Structural: `unknown-shape`, unique ids, no dangling / self-loop / duplicate edges, valid anchors and highlight ranges, existing files (including a diff node's `diffFrom`; `diff-missing-base` flags a diff node without one).

## Tools

- `npx canvas-lint [globs] [--fix] [--destructive] [--format json] [--root dir]`: `--fix` moves/resizes/reorders only; `--destructive` also deletes dangling, duplicate and self-loop edges. Exit code 1 when errors remain. Optional `.canvaslint.json`: `{ "rules": { "node-crowded": "off" }, "minGap": 24, "maxCrossings": 4, "outlierDistance": 2000 }`.
- MCP: `canvas_lint { fix?, destructive? }`; every mutating MCP tool also appends a `lint` list for what it changed.
- VS Code: diagnostics appear in the Problems panel with quick fixes; configure via `vsCanvas.lint.rules`.
