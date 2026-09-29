import { useViewport } from '@xyflow/svelte';
import { lodForZoom, type Lod } from './lod';

/**
 * Reactive level of detail for a node adapter. Call during component init (uses xyflow context).
 * `lod.current` follows the store zoom with hysteresis.
 */
export function useLod(): { readonly current: Lod } {
  const viewport = useViewport();
  let lod = $state<Lod>(lodForZoom(viewport.current.zoom));
  $effect(() => {
    const next = lodForZoom(viewport.current.zoom, lod);
    if (next !== lod) lod = next;
  });
  return {
    get current() {
      return lod;
    },
  };
}
