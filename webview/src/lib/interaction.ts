/** Node ids the user is resizing right now (drags are tracked by xyflow's `dragging`), so external moves do not fight them. */
export const resizing = new Set<string>();
