# VS Canvas design language

The canvas is part of VS Code, not a separate app. It borrows VS Code's colours, type and density so it feels
native. It spends its boldness in exactly one place: **signal**, meaning the cyan that marks data in motion
through code.

## Principles
1. **Native first.** Every colour comes from a `--vscode-*` token, with a fallback for Storybook and the
   browser. Chrome such as toolbars, menus and panels mirrors VS Code widgets: `editorWidget` background,
   `widget-border`, `list-hoverBackground` and `focusBorder` rings. Use the VS Code UI font for chrome and
   the editor font for code, logs and data. No new typefaces.
2. **Colour is meaning, never decoration.** Use the semantic vocabulary (`SEMANTIC_COLORS` in
   `src/shared/canvasFile.ts`):
   - red: failure path / root cause
   - orange: under investigation
   - yellow: attention / key line
   - green: confirmed
   - cyan: data in motion
   - purple: domain boundary

   Neutral cards have no colour. A colour only appears when it says something.
3. **One bold thing: signal.** Cyan is reserved for data in motion: edges that carry data are
   drawn in cyan. Everything else is flat, using 1px borders and at most one shadow level for floating chrome.
4. **Meaning at every altitude.** Semantic zoom has three levels. Zoomed far out, cards show only their
   title, their state colour and a big glyph. At mid zoom they show the summary. Zoomed in, they show full
   content and code. Text is never rendered too small to read; it gives way to a simpler level instead.
5. **Motion answers something.** Motion follows either a user action or an agent action, and is never
   ambient. Enter by fading in, move by tweening. The camera stays calm (see `webview/src/lib/camera.ts`).
   Durations live in `webview/src/lib/motion.ts`. Honour reduced motion.
6. **Direct manipulation over dialogs.**
   - Drag an arrow out of anything; dropping it on empty canvas opens a quick-add menu.
   - Double-click to edit.
   - Floating toolbars appear next to the selection.
   - Nothing opens a modal.

## Geometry
- The grid is 8px; nodes snap to 8px, and gaps default to 24px (`LINT_DEFAULTS.minGap`).
- Radius is 6px for cards, 4px for chips and buttons, and 10px for the quick-add menu and command bar
  (floating surfaces). Groups use 8px.
- Card chrome: a 1px `--vscode-widget-border` border (fallback `editorWidget-border`) on
  `--vscode-editorWidget-background`. When selected, it gets a 1px `--vscode-focusBorder` border plus a
  2px outer ring at 35% opacity.
- Header is 31px tall (`GEOMETRY.codeHeaderHeight`). Code line height is 18px.
- Floating chrome (toolbars, menus) uses shadow `0 4px 16px rgb(0 0 0 / .28)` in dark and `/ .12` in light.
  It is the only shadow in the product.

## Copy
Use sentence case, plain verbs, and no trailing arrows or ALL-CAPS labels. Actions keep the same name
everywhere: if the toolbar says "Fix layout", the toast says "Layout fixed". Empty states tell you what to do
next.
