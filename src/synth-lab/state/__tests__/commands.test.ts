import { beforeEach, describe, expect, it } from "vitest";
import { commitGesture, dispatch } from "../commands";
import { createDefaultState } from "../defaultProject";
import { canRedo, canUndo, resetHistory } from "../history";
import { projectStore } from "../projectStore";

function reset() {
  projectStore.set(createDefaultState());
  resetHistory();
  commitGesture();
}

beforeEach(reset);

describe("command validation", () => {
  it("rejects out-of-range steps", () => {
    expect(dispatch({ type: "cycleDrumStep", lane: "kick", step: 16 }).ok).toBe(false);
    expect(dispatch({ type: "cycleDrumStep", lane: "kick", step: -1 }).ok).toBe(false);
    expect(dispatch({ type: "setStepNote", trackId: "bass", step: 99, row: 0 }).ok).toBe(false);
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
