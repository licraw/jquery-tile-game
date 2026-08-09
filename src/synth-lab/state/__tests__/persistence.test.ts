import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDefaultState } from "../defaultProject";
import {
  PROGRESS_STORAGE_KEY,
  PROJECT_STORAGE_KEY,
  loadPersistedState,
  persistNow
} from "../persistence";
import { DRUM_LANES, STEP_COUNT, STEPS_PER_BAR, type ChordId, type DrumStep } from "../types";

/**
 * A project exactly as v1 wrote it: schemaVersion 1, every pattern one bar of
 * 16 steps. Kept literal rather than derived from the current default so it
 * keeps describing the old format after the current one moves on again.
 */
function makeV1Project() {
  const lane = (on: number[]): DrumStep[] =>
    Array.from({ length: STEPS_PER_BAR }, (_, step) => (on.includes(step) ? "on" : "off"));
  return {
    schemaVersion: 1,
    tempoBpm: 120,
    masterLevel: 0.7,
    tracks: {
      drums: {
        id: "drums",
        muted: false,
        level: 0.8,
        patch: null,
        pattern: {
          kind: "drums",
          lanes: {
            kick: lane([0, 8]),
            snare: lane([4, 12]),
            hat: lane([0, 2, 4, 6, 8, 10, 12, 14]),
            perc: lane([7])
          }
        }
      },
      bass: {
        id: "bass",
        muted: false,
        level: 0.8,
        patch: {
          waveform: "sawtooth",
          octaveOffset: 0,
          ampEnv: { attack: 0.005, decay: 0.14, sustain: 0.2, release: 0.18 },
          cutoffHz: 1234,
          resonance: 0.18,
          filterEnvAmount: 1.6,
          voices: 1
        },
        pattern: {
          kind: "notes",
          steps: Array.from({ length: STEPS_PER_BAR }, (_, step) => (step % 4 === 0 ? 0 : null))
        }
      },
      pads: {
        id: "pads",
        muted: false,
        level: 0.55,
        patch: null,
        pattern: {
          kind: "chords",
          steps: Array.from({ length: STEPS_PER_BAR }, (_, step) =>
            step === 0 ? ("Cm" as ChordId) : step === 8 ? ("Ab" as ChordId) : null
          )
        }
      },
      lead: {
        id: "lead",
        muted: false,
        level: 0.6,
        patch: null,
        pattern: {
          kind: "notes",
          steps: Array.from({ length: STEPS_PER_BAR }, (_, step) => (step === 2 ? 4 : null))
        }
      }
    }
  } as never as ReturnType<typeof createDefaultState>["project"];
}

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
    expect(restored.project.tempoBpm).toBe(96);
    expect(restored.lessons.completed).toEqual([]);
  });

  it("rejects structurally broken and unknown-version payloads", () => {
    fakeWindow.localStorage.setItem(
      PROJECT_STORAGE_KEY,
      JSON.stringify({ schemaVersion: 2, project: { schemaVersion: 2 }, selectedTrackId: "bass" })
    );
    expect(loadPersistedState(createDefaultState()).project.tempoBpm).toBe(96);

    fakeWindow.localStorage.setItem(
      PROJECT_STORAGE_KEY,
      JSON.stringify({ schemaVersion: 99, project: { ...makeV1Project(), schemaVersion: 99 }, selectedTrackId: "bass" })
    );
    expect(loadPersistedState(createDefaultState()).project.tempoBpm).toBe(96);
  });

  it("round-trips a 32-step project without changing any step", () => {
    const state = createDefaultState();
    persistNow(state);
    const restored = loadPersistedState(createDefaultState());
    expect(restored.project.schemaVersion).toBe(2);
    expect(restored.project).toEqual(state.project);
    expect(restored.project.tracks.lead.pattern.steps).toHaveLength(STEP_COUNT);
  });

  it("preserves a bar 2 edit across a save/load round trip", () => {
    const state = createDefaultState();
    const steps = [...state.project.tracks.bass.pattern.steps];
    steps[29] = 7;
    persistNow({
      ...state,
      project: {
        ...state.project,
        tracks: {
          ...state.project.tracks,
          bass: { ...state.project.tracks.bass, pattern: { kind: "notes", steps } }
        }
      }
    });
    const restored = loadPersistedState(createDefaultState());
    expect(restored.project.tracks.bass.pattern.steps[29]).toBe(7);
  });
});

describe("v1 → v2 migration", () => {
  it("upgrades a saved 16-step project by repeating bar 1 into bar 2", () => {
    const v1 = makeV1Project();
    fakeWindow.localStorage.setItem(
      PROJECT_STORAGE_KEY,
      JSON.stringify({ schemaVersion: 1, project: v1, selectedTrackId: "pads" })
    );

    const restored = loadPersistedState(createDefaultState());
    const { project } = restored;
    expect(project.schemaVersion).toBe(2);
    expect(restored.selectedTrackId).toBe("pads");
    // Tempo and patches are untouched by the migration — only lengths change.
    expect(project.tempoBpm).toBe(120);
    expect(project.tracks.bass.patch?.cutoffHz).toBe(1234);

    // Every pattern is now 32 long, with bar 2 an exact copy of bar 1: the
    // migrated jam sounds identical to the one-bar loop the user saved.
    for (const lane of DRUM_LANES) {
      const steps = project.tracks.drums.pattern.lanes[lane];
      expect(steps).toHaveLength(STEP_COUNT);
      expect(steps.slice(STEPS_PER_BAR)).toEqual(steps.slice(0, STEPS_PER_BAR));
      expect(steps.slice(0, STEPS_PER_BAR)).toEqual(v1.tracks.drums.pattern.lanes[lane]);
    }
    for (const trackId of ["bass", "lead"] as const) {
      const steps = project.tracks[trackId].pattern.steps;
      expect(steps).toHaveLength(STEP_COUNT);
      expect(steps.slice(STEPS_PER_BAR)).toEqual(steps.slice(0, STEPS_PER_BAR));
      expect(steps.slice(0, STEPS_PER_BAR)).toEqual(v1.tracks[trackId].pattern.steps);
    }
    const chords = project.tracks.pads.pattern.steps;
    expect(chords).toHaveLength(STEP_COUNT);
    expect(chords.slice(STEPS_PER_BAR)).toEqual(chords.slice(0, STEPS_PER_BAR));
  });

  it("re-saves a migrated project at the current schema version", () => {
    fakeWindow.localStorage.setItem(
      PROJECT_STORAGE_KEY,
      JSON.stringify({ schemaVersion: 1, project: makeV1Project(), selectedTrackId: "bass" })
    );
    const restored = loadPersistedState(createDefaultState());
    persistNow(restored);

    const raw = JSON.parse(fakeWindow.localStorage.getItem(PROJECT_STORAGE_KEY) as string);
    expect(raw.schemaVersion).toBe(2);
    expect(raw.project.schemaVersion).toBe(2);
    expect(raw.project.tracks.bass.pattern.steps).toHaveLength(STEP_COUNT);
  });

  it("pads a wrong-length pattern instead of discarding the jam", () => {
    const v1 = makeV1Project();
    // Truncated array — corrupt rather than a known schema.
    v1.tracks.lead.pattern.steps = [3, null, 5];
    fakeWindow.localStorage.setItem(
      PROJECT_STORAGE_KEY,
      JSON.stringify({ schemaVersion: 1, project: v1, selectedTrackId: "bass" })
    );
    const restored = loadPersistedState(createDefaultState());
    expect(restored.project.tracks.lead.pattern.steps).toHaveLength(STEP_COUNT);
    expect(restored.project.tracks.lead.pattern.steps[0]).toBe(3);
    expect(restored.project.tracks.lead.pattern.steps[2]).toBe(5);
    expect(restored.project.tracks.lead.pattern.steps[31]).toBe(null);
    // The rest of the project survived.
    expect(restored.project.tempoBpm).toBe(120);
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
    expect(restored.project.tempoBpm).toBe(96);
  });
});
