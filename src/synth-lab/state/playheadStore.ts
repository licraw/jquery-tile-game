import { useSyncExternalStore } from "react";
import { barOfStep } from "./types";

/**
 * Tiny second store for the transport playhead (plan §9/§11): fed by the
 * engine's Draw-scheduled callbacks at ~6 Hz, isolated from projectStore so
 * only step cells and the transport indicator re-render.
 */
export interface PlayheadState {
  /** Current absolute 16th-note step 0–31 across the two-bar loop, or null when stopped. */
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

/**
 * The bar currently sounding, or null when stopped. Subscribing to this
 * instead of the raw step keeps the BAR selector from re-rendering 16 times
 * per bar — it only changes at the bar boundary.
 */
export function usePlayheadBar(): number | null {
  return useSyncExternalStore(
    playheadStore.subscribe,
    () => (state.step === null ? null : barOfStep(state.step)),
    () => null
  );
}
