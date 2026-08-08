import { useSyncExternalStore } from "react";
import { createDefaultState } from "./defaultProject";
import { loadPersistedState } from "./persistence";
import type { SynthLabState } from "./types";

/**
 * Module-singleton store for all Synth Lab product state (plan §11).
 * Mutations happen only through the command layer (`commands.ts`).
 * Selectors passed to `useSynthLabState` must return stored references or
 * primitives — never freshly created objects — because `useSyncExternalStore`
 * compares snapshots with Object.is.
 */
let state: SynthLabState =
  typeof window === "undefined" ? createDefaultState() : loadPersistedState(createDefaultState());

// Stable snapshot for SSR/hydration renders; must not depend on localStorage.
const serverState: SynthLabState = createDefaultState();

const listeners = new Set<() => void>();

export const projectStore = {
  get(): SynthLabState {
    return state;
  },
  set(next: SynthLabState): void {
    if (next === state) return;
    state = next;
    listeners.forEach((listener) => listener());
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }
};

export function useSynthLabState<T>(selector: (s: SynthLabState) => T): T {
  return useSyncExternalStore(
    projectStore.subscribe,
    () => selector(state),
    () => selector(serverState)
  );
}
