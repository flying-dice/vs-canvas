// Small shared reactive state between Canvas.svelte and the node / edge adapters. Kept out of node `data` so a
// pointer move or a playback frame never rebuilds the node array.
import type { ActiveStep } from './playback';

export type LineRange = readonly [number, number];
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
const NONE: readonly ActiveStep[] = [];

class UiState {
  /** Node id asked to enter inline edit mode (consumed by the adapter). */
  editId = $state<string | null>(null);
  /** Node under the pointer (xyflow pointer events); code nodes mount per-line drag handles for it. */
  hoverNodeId = $state<string | null>(null);
  /** Node a connection is being dragged from (its line handles stay mounted). */
  connectFrom = $state<string | null>(null);
  /** Flow playback: the steps of the current group, per frame. */
  steps = $state.raw<readonly ActiveStep[]>(NONE);
  /** True while a flow is playing or parked mid-way (drives dimming of non-participants). */
  flowActive = $state(false);
  /** Lit lines per node id (flow playback target lines). */
  activeLines = $state.raw<ReadonlyMap<string, readonly LineRange[]>>(new Map());

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
