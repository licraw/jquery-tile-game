import { beforeEach, describe, expect, it } from "vitest";
import { commitGesture, dispatch } from "../commands";
import { createDefaultState } from "../defaultProject";
import { canRedo, canUndo, resetHistory } from "../history";
import { projectStore } from "../projectStore";
import { DRUM_LANES, STEP_COUNT, STEPS_PER_BAR } from "../types";

function reset() {
  projectStore.set(createDefaultState());
  resetHistory();
  commitGesture();
}

beforeEach(reset);

describe("command validation", () => {
  it("rejects out-of-range steps", () => {
    expect(dispatch({ type: "cycleDrumStep", lane: "kick", step: 32 }).ok).toBe(false);
    expect(dispatch({ type: "cycleDrumStep", lane: "kick", step: -1 }).ok).toBe(false);
    expect(dispatch({ type: "setStepNote", trackId: "bass", step: 99, row: 0 }).ok).toBe(false);
  });

  it("accepts every step of both bars", () => {
    for (let step = 0; step < STEP_COUNT; step += 1) {
      expect(dispatch({ type: "setDrumStep", lane: "kick", step, value: "on" }).ok).toBe(true);
      expect(dispatch({ type: "setStepNote", trackId: "bass", step, row: 1 }).ok).toBe(true);
      expect(dispatch({ type: "setStepChord", step, chord: "Cm" }).ok).toBe(true);
    }
    // Step 31 is the last step of bar 2; step 32 is off the end of the loop.
    expect(dispatch({ type: "setStepNote", trackId: "lead", step: STEP_COUNT - 1, row: 0 }).ok).toBe(true);
    expect(dispatch({ type: "setStepNote", trackId: "lead", step: STEP_COUNT, row: 0 }).ok).toBe(false);
  });

  it("rejects invalid rows and chords", () => {
    expect(dispatch({ type: "setStepNote", trackId: "bass", step: 0, row: 8 }).ok).toBe(false);
    expect(dispatch({ type: "setStepNote", trackId: "bass", step: 0, row: 2.5 }).ok).toBe(false);
    expect(dispatch({ type: "setStepChord", step: 0, chord: "Xm" as never }).ok).toBe(false);
  });

  it("rejects synth params on drums and unknown params", () => {
    expect(dispatch({ type: "setSynthParam", trackId: "drums" as never, param: "cutoffHz", value: 500 }).ok).toBe(false);
    expect(dispatch({ type: "setSynthParam", trackId: "bass", param: "nope" as never, value: 1 }).ok).toBe(false);
  });

  it("leaves state untouched on invalid input", () => {
    const before = projectStore.get();
    dispatch({ type: "setStepNote", trackId: "bass", step: 0, row: 42 });
    expect(projectStore.get()).toBe(before);
    expect(canUndo()).toBe(false);
  });

  it("clamps tempo and levels", () => {
    dispatch({ type: "setTempo", bpm: 500 });
    expect(projectStore.get().project.tempoBpm).toBe(180);
    dispatch({ type: "setTempo", bpm: 10 });
    expect(projectStore.get().project.tempoBpm).toBe(60);
    dispatch({ type: "setMasterLevel", level: 3 });
    expect(projectStore.get().project.masterLevel).toBe(1);
  });

  it("clamps synth params to the registry ranges", () => {
    dispatch({ type: "setSynthParam", trackId: "bass", param: "cutoffHz", value: 99999 });
    expect(projectStore.get().project.tracks.bass.patch?.cutoffHz).toBe(8000);
    dispatch({ type: "setSynthParam", trackId: "bass", param: "cutoffHz", value: 1 });
    expect(projectStore.get().project.tracks.bass.patch?.cutoffHz).toBe(100);
  });
});

describe("pattern semantics", () => {
  it("cycles drum steps off → on → accent → off", () => {
    const laneAt = () => projectStore.get().project.tracks.drums.pattern.lanes.kick[1];
    expect(laneAt()).toBe("off");
    dispatch({ type: "cycleDrumStep", lane: "kick", step: 1 });
    expect(laneAt()).toBe("on");
    dispatch({ type: "cycleDrumStep", lane: "kick", step: 1 });
    expect(laneAt()).toBe("accent");
    dispatch({ type: "cycleDrumStep", lane: "kick", step: 1 });
    expect(laneAt()).toBe("off");
  });

  it("enforces one note per column by replacement", () => {
    dispatch({ type: "setStepNote", trackId: "bass", step: 2, row: 3 });
    expect(projectStore.get().project.tracks.bass.pattern.steps[2]).toBe(3);
    dispatch({ type: "setStepNote", trackId: "bass", step: 2, row: 6 });
    expect(projectStore.get().project.tracks.bass.pattern.steps[2]).toBe(6);
    dispatch({ type: "setStepNote", trackId: "bass", step: 2, row: null });
    expect(projectStore.get().project.tracks.bass.pattern.steps[2]).toBe(null);
  });

  it("replaces chords in a column", () => {
    dispatch({ type: "setStepChord", step: 0, chord: "Fm" });
    expect(projectStore.get().project.tracks.pads.pattern.steps[0]).toBe("Fm");
    dispatch({ type: "setStepChord", step: 0, chord: null });
    expect(projectStore.get().project.tracks.pads.pattern.steps[0]).toBe(null);
  });
});

describe("two-bar patterns", () => {
  it("gives every track 32 steps across both bars", () => {
    const { tracks } = projectStore.get().project;
    expect(STEP_COUNT).toBe(32);
    expect(STEPS_PER_BAR).toBe(16);
    for (const lane of DRUM_LANES) {
      expect(tracks.drums.pattern.lanes[lane]).toHaveLength(STEP_COUNT);
    }
    expect(tracks.bass.pattern.steps).toHaveLength(STEP_COUNT);
    expect(tracks.pads.pattern.steps).toHaveLength(STEP_COUNT);
    expect(tracks.lead.pattern.steps).toHaveLength(STEP_COUNT);
  });

  it("keeps all four tracks the same length so they stay synchronized", () => {
    const { tracks } = projectStore.get().project;
    const lengths = new Set<number>([
      ...DRUM_LANES.map((lane) => tracks.drums.pattern.lanes[lane].length),
      tracks.bass.pattern.steps.length,
      tracks.pads.pattern.steps.length,
      tracks.lead.pattern.steps.length
    ]);
    expect([...lengths]).toEqual([STEP_COUNT]);
  });

  it("edits bar 1 and bar 2 independently", () => {
    // Same position within each bar — a paging bug that folded bar 2 onto bar
    // 1 would make these two writes collide.
    dispatch({ type: "setStepNote", trackId: "lead", step: 5, row: 1 });
    dispatch({ type: "setStepNote", trackId: "lead", step: 5 + STEPS_PER_BAR, row: 6 });
    const steps = projectStore.get().project.tracks.lead.pattern.steps;
    expect(steps[5]).toBe(1);
    expect(steps[21]).toBe(6);

    dispatch({ type: "setStepNote", trackId: "lead", step: 5, row: null });
    expect(projectStore.get().project.tracks.lead.pattern.steps[5]).toBe(null);
    expect(projectStore.get().project.tracks.lead.pattern.steps[21]).toBe(6);
  });

  it("carries drum, note and chord data in both bars", () => {
    dispatch({ type: "setDrumStep", lane: "perc", step: 30, value: "accent" });
    dispatch({ type: "setStepChord", step: 20, chord: "Fm" });
    const { tracks } = projectStore.get().project;
    expect(tracks.drums.pattern.lanes.perc[30]).toBe("accent");
    expect(tracks.pads.pattern.steps[20]).toBe("Fm");
    // The shipped jam actually uses bar 2 rather than leaving it empty.
    const jam = createDefaultState().project;
    expect(jam.tracks.bass.pattern.steps.slice(STEPS_PER_BAR).some((row) => row !== null)).toBe(true);
    expect(jam.tracks.lead.pattern.steps.slice(STEPS_PER_BAR).some((row) => row !== null)).toBe(true);
    expect(jam.tracks.pads.pattern.steps.slice(STEPS_PER_BAR).some((c) => c !== null)).toBe(true);
    expect(
      DRUM_LANES.some((lane) => jam.tracks.drums.pattern.lanes[lane].slice(STEPS_PER_BAR).some((v) => v !== "off"))
    ).toBe(true);
  });

  it("undoes a bar 2 edit without disturbing bar 1", () => {
    const bar1Before = projectStore.get().project.tracks.bass.pattern.steps[0];
    dispatch({ type: "setStepNote", trackId: "bass", step: 26, row: 7 });
    expect(projectStore.get().project.tracks.bass.pattern.steps[26]).toBe(7);

    dispatch({ type: "undo" });
    const steps = projectStore.get().project.tracks.bass.pattern.steps;
    expect(steps[26]).toBe(createDefaultState().project.tracks.bass.pattern.steps[26]);
    expect(steps[0]).toBe(bar1Before);
    expect(steps).toHaveLength(STEP_COUNT);

    dispatch({ type: "redo" });
    expect(projectStore.get().project.tracks.bass.pattern.steps[26]).toBe(7);
  });

  it("defaults the starter jam to 96 BPM", () => {
    expect(createDefaultState().project.tempoBpm).toBe(96);
    dispatch({ type: "setTempo", bpm: 140 });
    dispatch({ type: "resetProject" });
    expect(projectStore.get().project.tempoBpm).toBe(96);
  });
});

describe("patch commands", () => {
  it("applies a multi-parameter patch as one undoable transaction", () => {
    const result = dispatch({
      type: "applyPatch",
      trackId: "bass",
      patch: { waveform: "sine", cutoffHz: 500, ampEnv: { attack: 0.3, decay: 0.5, sustain: 0.9, release: 1 } }
    });
    expect(result.ok).toBe(true);
    const patch = projectStore.get().project.tracks.bass.patch;
    expect(patch?.waveform).toBe("sine");
    expect(patch?.cutoffHz).toBe(500);
    expect(patch?.ampEnv.sustain).toBe(0.9);

    dispatch({ type: "undo" });
    const restored = projectStore.get().project.tracks.bass.patch;
    expect(restored?.waveform).toBe("sawtooth");
    expect(restored?.cutoffHz).toBe(4800);
    expect(restored?.ampEnv.sustain).toBe(0.2);
  });

  it("rejects invalid values inside applyPatch without partial application", () => {
    const before = projectStore.get().project.tracks.bass.patch;
    const result = dispatch({
      type: "applyPatch",
      trackId: "bass",
      patch: { waveform: "noise" as never, cutoffHz: 500 }
    });
    expect(result.ok).toBe(false);
    expect(projectStore.get().project.tracks.bass.patch).toBe(before);
  });

  it("resetPatch restores defaults", () => {
    dispatch({ type: "setSynthParam", trackId: "bass", param: "cutoffHz", value: 200 });
    dispatch({ type: "resetPatch", trackId: "bass" });
    expect(projectStore.get().project.tracks.bass.patch?.cutoffHz).toBe(4800);
  });
});

describe("history exclusions", () => {
  it("play/stop/selectTrack create no history", () => {
    dispatch({ type: "play" });
    dispatch({ type: "selectTrack", trackId: "lead" });
    dispatch({ type: "stop" });
    expect(canUndo()).toBe(false);
    expect(canRedo()).toBe(false);
  });

  it("resetProject is undoable and restores the edited jam", () => {
    dispatch({ type: "setStepNote", trackId: "lead", step: 1, row: 5 });
    dispatch({ type: "resetProject" });
    expect(projectStore.get().project.tracks.lead.pattern.steps[1]).toBe(null);
    dispatch({ type: "undo" });
    expect(projectStore.get().project.tracks.lead.pattern.steps[1]).toBe(5);
  });
});
