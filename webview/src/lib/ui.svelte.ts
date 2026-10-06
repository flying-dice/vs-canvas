// Small shared reactive state between Canvas.svelte and the node / edge adapters. Kept out of node `data` so a
// pointer move or a drag frame never rebuilds the node array.

/** Node under a connection drag (drop target feedback), in flow coordinates. */
export type DropTarget = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Code node: the line under the pointer (absolute number) and its row rect. */
  line?: { n: number; y: number; h: number };
  /** Where the arrow will land. */
  snap: { x: number; y: number; side: 'left' | 'right' | 'top' | 'bottom' };
};

class UiState {
  /** Node id asked to enter inline edit mode (consumed by the adapter). */
  editId = $state<string | null>(null);
  /** Node under the pointer (xyflow pointer events); code nodes mount per-line drag handles for it. */
  hoverNodeId = $state<string | null>(null);
  /** Node a connection is being dragged from (its line handles stay mounted). */
  connectFrom = $state<string | null>(null);

  /** The one selected edge that shows its toolbar (null with a multi-selection). */
  toolEdge = $state<string | null>(null);
  /** Connection drag: the node (and code line) the arrow would connect to right now. */
  dropTarget = $state.raw<DropTarget | null>(null);

  requestEdit(id: string) {
    this.editId = id;
  }
}

export const ui = new UiState();

/** Call during adapter init: runs `enter` when `requestEdit(id)` targets this node. */
export function useEditRequest(id: () => string, enter: () => void) {
  $effect(() => {
    if (ui.editId !== null && ui.editId === id()) {
      ui.editId = null;
      enter();
    }
  });
}
