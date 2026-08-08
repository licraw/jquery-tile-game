import { useSyncExternalStore } from "react";

/**
 * Tiny second store for the transport playhead (plan §9/§11): fed by the
 * engine's Draw-scheduled callbacks at ~9 Hz, isolated from projectStore so
 * only step cells and the transport indicator re-render.
 */
export interface PlayheadState {
  /** Current 16th-note step 0–15, or null when stopped. */
  step: number | null;
}

let state: PlayheadState = { step: null };
const listeners = new Set<() => void>();

export const playheadStore = {
  get(): PlayheadState {
    return state;
  },
  set(step: number | null): void {
    if (state.step === step) return;
    state = { step };
    listeners.forEach((listener) => listener());
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }
};

const SERVER_STATE: PlayheadState = { step: null };

export function usePlayheadStep(): number | null {
  return useSyncExternalStore(
    playheadStore.subscribe,
    () => state.step,
    () => SERVER_STATE.step
  );
}
