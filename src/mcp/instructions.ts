// Sent to every MCP client in the initialize response; most harnesses add it to the agent's context, so agents
// learn when and how to use the canvas even without the installed skill files (agent/skill.md is the full guide).
export const MCP_INSTRUCTIONS = `VS Canvas shows code on an infinite canvas beside the user's editor; they watch it update live, and each canvas is a *.canvas.json file in the repo.

Use it without being asked when explaining how code works across more than two files, tracing a bug across call sites or weighing hypotheses, orienting in an unfamiliar repo, or when the user wants a diagram. Keep explaining in chat too, and say which canvas you used.

- Start with canvas_create (kind: map | investigation | flow | notes) or canvas_list + canvas_open.
- Call paths: canvas_trace from the entry symbol (one call adds code nodes, line-anchored edges and layout), then canvas_highlight_lines on the lines that matter.
- Data flows: canvas_open_file each hop, canvas_connect the call sites with line-anchored edges labelled with the payload, highlight the transforming lines, and summarise in a canvas_add_note.
- Bugs: canvas_add_log with the stack trace, open the failing frames, one canvas_add_finding per hypothesis and update its status (investigating -> confirmed | ruled-out); mark the root-cause line with colour "failure".
- Repo maps: canvas_add_service per domain with real entryPoints, grouped with canvas_add_group (colour "domain"); pin the map.
- Diagrams (C4, flowchart, UML, ERD, architecture, BPMN): canvas_add_diagram builds a whole diagram in one call; canvas_list_shapes lists shapes; sequence diagrams: canvas_add_mermaid.
- Colour is meaning: failure, investigating, attention, confirmed, flow, domain. Leave neutral things uncoloured.
- Anchor edges on the calling lines (sourceLine/targetLine) and show focused line ranges, not whole files.
- Every edit returns a "lint" list for what you changed; fix it (move nodes or canvas_lint with fix: true). Use near/side placement and canvas_layout to keep boards tidy.
- canvas_focus with nodeIds points the user's camera at what you are explaining.
The prompts map_repo, investigate_bug, explain_flow and draw_diagram give step-by-step playbooks.`;
