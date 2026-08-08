import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDefaultState } from "../defaultProject";
import {
  PROGRESS_STORAGE_KEY,
  PROJECT_STORAGE_KEY,
  loadPersistedState,
  persistNow
} from "../persistence";

function makeFakeStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear()
  };
}

const fakeWindow = { localStorage: makeFakeStorage() };

beforeEach(() => {
  (globalThis as Record<string, unknown>).window = fakeWindow;
  fakeWindow.localStorage.clear();
});

afterEach(() => {
  delete (globalThis as Record<string, unknown>).window;
});

describe("persistence", () => {
  it("round-trips project, selection, and progress", () => {
    const state = createDefaultState();
    const edited = {
      ...state,
      selectedTrackId: "lead" as const,
      project: { ...state.project, tempoBpm: 140 },
      lessons: {
        ...state.lessons,
        completed: ["challenge-0"],
        concepts: { ...state.lessons.concepts, oscillators: true }
      }
    };
    persistNow(edited);

    const restored = loadPersistedState(createDefaultState());
    expect(restored.project.tempoBpm).toBe(140);
    expect(restored.selectedTrackId).toBe("lead");
    expect(restored.lessons.completed).toContain("challenge-0");
    expect(restored.lessons.concepts.oscillators).toBe(true);
    // Transport state is never persisted: reload = stopped.
    expect(restored.transportStatus).toBe("idle");
  });

  it("falls back silently on corrupt payloads", () => {
    fakeWindow.localStorage.setItem(PROJECT_STORAGE_KEY, "{not json");
    fakeWindow.localStorage.setItem(PROGRESS_STORAGE_KEY, '"just a string"');
    const restored = loadPersistedState(createDefaultState());
    expect(restored.project.tempoBpm).toBe(112);
    expect(restored.lessons.completed).toEqual([]);
  });

  it("rejects wrong-schema payloads", () => {
    fakeWindow.localStorage.setItem(
      PROJECT_STORAGE_KEY,
      JSON.stringify({ schemaVersion: 2, project: { schemaVersion: 2 }, selectedTrackId: "bass" })
    );
    const restored = loadPersistedState(createDefaultState());
    expect(restored.project.tempoBpm).toBe(112);
  });

  it("keeps mastery under a separate key so project reset preserves it", () => {
    const state = createDefaultState();
    persistNow({
      ...state,
      lessons: { ...state.lessons, concepts: { ...state.lessons.concepts, filters: true } }
    });
    // Simulate clearing only the project key (reset flow rewrites project).
    fakeWindow.localStorage.removeItem(PROJECT_STORAGE_KEY);
    const restored = loadPersistedState(createDefaultState());
    expect(restored.lessons.concepts.filters).toBe(true);
    expect(restored.project.tempoBpm).toBe(112);
  });
});
