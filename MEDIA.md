# VS Canvas: 60-second showcase

A motion-graphics demo cut from real screen recordings of VS Canvas running in VS Code. It tells one story:
**a developer on day one in a codebase they have never seen, getting productive in minutes.** Every shot is
the real product driven by an agent over MCP. Nothing is mocked. Motion graphics only frame, zoom and
annotate.

Length: 60s. Aspect: 16:9 master (2560×1440), with a 1:1 cutdown for social. Sound: one music bed with a
soft tick on each agent action. No voice-over; on-screen captions carry the story.

## The four hero use cases

| # | Use case | The developer's question | Feature on show |
| --- | --- | --- | --- |
| 1 | Map an unfamiliar repo | "What even is this system?" | Domain map, pinned and always one keystroke away; semantic zoom from services to code |
| 2 | Trace a bug | "Why does checkout sometimes charge twice?" | Investigation board: stack trace to code, hypotheses ruled out or confirmed, root cause on one line |
| 3 | Follow the data | "What happens to an order after I click pay?" | Flow playback: a packet travels through the real code and the payload changes shape at each hop |
| 4 | Keep it and share it | "How do I hand this to my team?" | Canvases are committed `.canvas.json` files; the linter keeps them clean; drag-to-connect editing |

## Storyboard

Timings are targets. Captions are sentence case, at most 7 words, bottom-left, in the VS Code UI font.

### 0:00–0:05: Cold open
- **Shot:** a large unfamiliar repo (`acme-shop`: 14 services, 2,100 files). The Explorer tree scrolls fast
  and becomes unreadable.
- **Motion:** a slow push-in on the tree, then a hard cut to black.
- **Caption:** "New codebase. No map."

### 0:05–0:18: Use case 1, map the repo
- **Prompt (typed into Claude Code, visible):** `Map this repo's domains and pin it.`
- **Shot:** the canvas opens beside the code. Service cards arrive one by one: Checkout, Payments, Inventory,
  Identity, Notifications. Each fades in where it belongs while the camera settles, never chasing. Purple
  domain groups draw around related services. Edges between services draw in along their curves.
- **Beat:** the pin icon lights up and the map appears in the Canvases sidebar under "Pinned".
- **Motion:** semantic zoom. Scroll into Payments and its card resolves into its entry points and then real
  code lines; scroll out and they collapse back into the card. This is the "codebase comes to life" moment,
  so give it 3 full seconds.
- **Caption:** "A map you can zoom into."

### 0:18–0:33: Use case 2, trace the bug
- **Prompt:** paste a stack trace, then `Why does checkout charge twice? Build an investigation board.`
- **Shot:** a log node appears with the stack trace. Frames are clickable, and the failing frame is red. The
  agent opens the three frames as code nodes, connected by the call path on the exact lines. Hypothesis
  cards appear:
  1. "Client double-submits": grey, then struck through as ruled out.
  2. "Retry on timeout re-sends the charge": amber, then green as confirmed.
- **Beat:** the root-cause line in `payments/retry.ts:48` pulses red with the label "retry without
  idempotency key".
- **Motion:** each hypothesis state change is a single colour transition, with no bounce. The camera pans
  across the board as evidence arrives.
- **Caption:** "From stack trace to root cause."

### 0:33–0:48: Use case 3, follow the data
- **Prompt:** `Show how an order flows from the pay button to the ledger.`
- **Shot:** a flow across 5 code nodes (`CheckoutButton.tsx` → `api/orders.ts` → `payments/charge.ts` →
  `payments/retry.ts` → `ledger/write.ts`). Press play in the transport bar.
- **Motion (the hero moment):** a cyan packet travels each edge in sequence. At every hop:
  - the target line lights up
  - the camera glides to follow
  - a small data chip beside the packet shows the payload changing:
    `{ cartId }` → `Order{ id: 812, total: 49.00 }` → `Charge{ status: 'pending' }` → `LedgerEntry{ … }`
- **Beat:** at `retry.ts` the packet splits in two. That visually explains the bug from use case 2. Hold
  for 1s.
- **Caption:** "Watch the data move."

### 0:48–0:56: Use case 4, keep it and share it
- **Shot, split screen:**
  - **Left, the human's turn:** drag an arrow out of a code line and drop it on empty canvas. A quick-add menu
    appears; choose "Sticky" and type "Fix: pass idempotency key". Alignment guides snap it into place.
  - **Right:** `git diff` shows a clean, small `investigation.canvas.json` diff, then the PR view with the
    canvas attached.
- **Beat:** a deliberately overlapping sticky raises a lint badge. Choose "Fix layout" and it glides clear.
- **Caption:** "Commit it. Your team sees what you saw."

### 0:56–1:00: End card
- The domain map from use case 1 zooms out to a single glowing overview. The product name and one line
  appear: "Your codebase, on a canvas." Then the repo URL.

## Visual rules for the edit
- **Theme:** VS Code Dark Modern, editor font size 15, zoom level 1. Record at 2× (Retina) and keep the UI
  crisp without rescaling.
- **Colours:** these carry meaning and match the product. Never recolour in post.
  - red: failure path
  - amber: under investigation
  - green: confirmed
  - cyan: data in motion
  - purple: domain boundary
- **Camera:** motion-graphics zooms should reinforce the product's own camera moves, not fight them. Use at
  most one post zoom per scene.
- **Cursor:** use a large cursor and show clicks with a subtle ring. Hide the mouse during agent-driven
  sequences so it's clear the agent is acting.
- **Pacing:** each agent action is visible for at least 400ms. Speed up waiting time (agent thinking) to 4×
  and mark it with a small spinner, never a jump cut.

## Capture checklist (engineering)
The features every shot depends on. Each must work live before recording.

- [ ] Demo repo `acme-shop` with a planted double-charge bug (retry without idempotency key) and a realistic
      stack trace
- [ ] Domain map: service cards, drill-down into a sub-canvas, pin to the sidebar, open with a keyboard
      shortcut
- [ ] Semantic zoom: card → entry points → code lines
- [ ] Investigation board: log node with clickable frames, hypothesis cards with open, ruled-out and confirmed
      states
- [ ] Flow playback: transport bar, packet along edges, data chips, camera follow, packet split at a fork
- [ ] Drag-out connection onto empty canvas → quick-add menu; alignment guides
- [ ] Linter badge and one-click "Fix layout" with animated resolve
- [ ] Calm camera, and reduced motion off for recording
