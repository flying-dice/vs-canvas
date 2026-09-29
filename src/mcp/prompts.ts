import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod';

const user = (text: string) => ({ messages: [{ role: 'user' as const, content: { type: 'text' as const, text } }] });

const COLORS =
  'Colour vocabulary: failure (red) = failure path/root cause, investigating (orange), attention (yellow) = key line, confirmed (green), flow (cyan) = data in motion, domain (purple) = domain boundary.';

export function registerPrompts(server: McpServer) {
  server.registerPrompt(
    'map_repo',
    { title: 'Map this repo', description: 'Build a pinned domain map of the repository with drill-down canvases.' },
    () => user(
      'Map this repository on a canvas so a newcomer can get productive.\n' +
        '1. Explore the repo (top-level layout, package manifests, entry points) and identify 4-10 domains/services.\n' +
        '2. canvas_create with kind "map" and pinned true (name e.g. "repo-map").\n' +
        '3. For each domain call canvas_add_service with a one-sentence description, 2-4 real entryPoints (file + lines + label) and tags. Verify lines with code_symbols.\n' +
        '4. Group related services with canvas_add_group color "domain" (purple), then canvas_connect services that talk to each other, with a label for what flows between them.\n' +
        '5. For domains worth a deeper look, canvas_create a canvas per domain (kind "notes" or "flow"), populate it, and set the service\'s canvas (or canvas_add_portal) so it drills down.\n' +
        '6. Also draw the architecture as a C4 container view with ONE canvas_add_diagram call (library "c4", frame true titled with the system, frameSublabel "Software System"): c4.person for users, c4.container / c4.container-db / c4.container-queue / c4.container-web for each runnable unit with a technology field, c4.system-external for third parties, and c4.uses edges labelled with intent ("Reads orders") and a sublabel for the protocol ("SQL/TCP"). Place it near the service cards.\n' +
        '7. canvas_lint with fix true, then canvas_focus the whole map.\n' + COLORS,
    ),
  );

  server.registerPrompt(
    'investigate_bug',
    {
      title: 'Investigate a bug',
      description: 'Build an investigation board: stack trace, failing code, hypotheses with statuses, root cause.',
      argsSchema: { symptom: z.string().describe('What goes wrong, e.g. "checkout sometimes charges twice".'), stackTrace: z.string().optional().describe('Stack trace or log excerpt, if you have one.') },
    },
    ({ symptom, stackTrace }) => user(
      `Investigate this bug on a canvas: ${symptom}\n` +
        '1. canvas_create with kind "investigation".\n' +
        (stackTrace
          ? `2. canvas_add_log with this trace verbatim (errorLines = the error message and failing frame lines):\n\`\`\`\n${stackTrace}\n\`\`\`\n`
          : '2. If there is a log or trace, canvas_add_log it; otherwise start from the code most likely involved.\n') +
        '3. canvas_open_file the failing frames (tight line ranges) and canvas_trace around them to show callers and callees.\n' +
        '4. canvas_add_finding for each hypothesis and piece of evidence (attachTo the relevant code line). Start "open", set "investigating" while checking, then "confirmed" or "ruled-out" via canvas_update_node.\n' +
        '5. When found, canvas_highlight_lines on the root-cause line with color "failure" and a short label, and add a conclusion finding with the fix.\n' + COLORS,
    ),
  );

  server.registerPrompt(
    'explain_flow',
    {
      title: 'Explain a data flow',
      description: 'Trace how data moves through the code and play it back.',
      argsSchema: { question: z.string().describe('e.g. "What happens to an order after I click pay?"') },
    },
    ({ question }) => user(
      `Explain this on a canvas: ${question}\n` +
        '1. canvas_create with kind "flow".\n' +
        '2. Find the hops (code_symbols, code_call_hierarchy) and canvas_open_file each with a tight range, or use canvas_trace from the entry point.\n' +
        '3. canvas_connect the call sites with line-anchored edges in order, labelled "1. ...", "2. ...".\n' +
        '4. canvas_add_flow with one step per hop: from/to node ids, startLine/endLine of the target lines, a caption and a `data` payload showing how the value changes (e.g. "Order{ id: 812, total: 49.00 }"). Use parallel true for forks.\n' +
        '5. canvas_play_flow, then summarise in a canvas_add_note.\n' + COLORS,
    ),
  );

  server.registerPrompt(
    'draw_diagram',
    {
      title: 'Draw a diagram',
      description: 'Draw a C4, flowchart, UML class, ERD, sequence or architecture diagram of something in the code.',
      argsSchema: {
        kind: z.enum(['c4-context', 'c4-container', 'flowchart', 'uml-class', 'erd', 'sequence', 'architecture']).describe('Diagram type. sequence uses Mermaid.'),
        subject: z.string().describe('What to draw, e.g. "the checkout service" or "the billing tables".'),
      },
    },
    ({ kind, subject }) => {
      const how: Record<string, string> = {
        'c4-context':
          'Explore the code and docs to find the users and external systems. ONE canvas_add_diagram call: library "c4", layout layered LR. Nodes: c4.person (users), a single c4.system for the subject, c4.system-external for everything it depends on. Edges: relation c4.uses with a label of intent ("Sends invoices") and a sublabel for the protocol. No containers at this level.',
        'c4-container':
          'Find the runnable units (apps, services, databases, queues) from manifests, Dockerfiles and entry points (code_symbols to verify). ONE canvas_add_diagram call: library "c4", frame true titled with the system name and frameSublabel "Software System". Nodes: c4.person and c4.system-external (external ones sit beside the system), c4.container / c4.container-web / c4.container-db / c4.container-queue with a `technology` field ("Node.js, Express", "PostgreSQL 16") and a one-line description after the name. Edges: c4.uses with a label such as "Reads from" and a sublabel like "SQL/TCP" or "JSON/HTTPS".',
        flowchart:
          'Read the code path and follow it. ONE canvas_add_diagram call: library "flowchart" (top to bottom). Start with a flowchart.terminator "Start", end with "End" terminators, flowchart.process for steps, flowchart.decision for branches phrased as questions with edges labelled "Yes"/"No", flowchart.io for data in and out. Keep it to 6-15 nodes; skip trivial branches.',
        'uml-class':
          'Find the types (code_symbols). ONE canvas_add_diagram call: library "uml", nodes uml.class / uml.interface / uml.enum with fields.attributes (["- id: string"]) and fields.methods (["+ charge(amount): Receipt"]) listing only the important members. Edges: uml.inheritance (child -> parent), uml.realization (class -> interface), uml.composition (owner -> part), uml.aggregation, uml.dependency, uml.association.',
        erd:
          'Find the schema (migrations, ORM models). ONE canvas_add_diagram call: library "erd", nodes erd.entity with text = table name and fields.columns like ["id uuid PK", "user_id uuid FK", "email text"]. Edges: erd.one-to-many from the parent ("one" side) to the child, erd.one-to-one, erd.many-to-many (or erd.zero-to-many for optional links), labelled with the foreign key or verb.',
        sequence:
          'Trace the call sequence (code_call_hierarchy). Use canvas_add_mermaid with a sequenceDiagram (participants in call order, ->> for calls, -->> for returns, alt/loop blocks for branches) rather than shapes.',
        architecture:
          'Find the services and infrastructure. ONE canvas_add_diagram call: library "arch", nodes arch.client / arch.gateway / arch.service / arch.database / arch.cache / arch.queue / arch.external with technology fields, optionally frame true (arch.region). Edges: arch.calls (sync), arch.publishes (async, dashed), arch.reads (data access), labelled.',
      };
      return user(
        `Draw a ${kind} diagram of: ${subject}\n` +
          '1. canvas_create (or reuse the active canvas) with kind "notes" and a title.\n' +
          `2. ${how[kind]}\n` +
          '3. Read the returned lint list; fix warnings with canvas_lint fix true or canvas_update_node, and use canvas_list_shapes if you need another shape.\n' +
          '4. canvas_add_note with a two-sentence reading guide (what the boxes and arrows mean), then canvas_focus.\n' +
          'Good diagrams: name every box, label every edge, one level of abstraction, 4-12 nodes.',
      );
    },
  );
}
