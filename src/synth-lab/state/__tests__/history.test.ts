import { beforeEach, describe, expect, it } from "vitest";
import { commitGesture, dispatch } from "../commands";
import { createDefaultState } from "../defaultProject";
import { canRedo, canUndo, getUndoStack, resetHistory } from "../history";
import { projectStore } from "../projectStore";

function reset() {
  projectStore.set(createDefaultState());
  resetHistory();
  commitGesture();
}

beforeEach(reset);

describe("transaction grouping", () => {
  it("coalesces a slider drag into one transaction with the pre-drag before value", () => {
    dispatch({ type: "setSynthParam", trackId: "bass", param: "cutoffHz", value: 4000 });
    dispatch({ type: "setSynthParam", trackId: "bass", param: "cutoffHz", value: 3000 });
    dispatch({ type: "setSynthParam", trackId: "bass", param: "cutoffHz", value: 900 });
    commitGesture();

    const stack = getUndoStack();
    expect(stack.length).toBe(1);
    const change = stack[0].changes.find((c) => c.path.join(".").includes("cutoffHz"));
    expect(change?.before).toBe(4800);
    expect(change?.after).toBe(900);

    dispatch({ type: "undo" });
    expect(projectStore.get().project.tracks.bass.patch?.cutoffHz).toBe(4800);
  });

  it("does not coalesce across different params or after commit", () => {
    dispatch({ type: "setSynthParam", trackId: "bass", param: "cutoffHz", value: 4000 });
    dispatch({ type: "setSynthParam", trackId: "bass", param: "resonance", value: 0.5 });
    expect(getUndoStack().length).toBe(2);

    reset();
    dispatch({ type: "setSynthParam", trackId: "bass", param: "cutoffHz", value: 4000 });
    commitGesture();
    dispatch({ type: "setSynthParam", trackId: "bass", param: "cutoffHz", value: 3000 });
    expect(getUndoStack().length).toBe(2);
  });

  it("drops a drag that returns to its starting value", () => {
    dispatch({ type: "setSynthParam", trackId: "bass", param: "cutoffHz", value: 4000 });
    dispatch({ type: "setSynthParam", trackId: "bass", param: "cutoffHz", value: 4800 });
    commitGesture();
    expect(getUndoStack().length).toBe(0);
  });

  it("discrete actions are one transaction each", () => {
    dispatch({ type: "cycleDrumStep", lane: "kick", step: 1 });
    dispatch({ type: "setWaveform", trackId: "bass", waveform: "square" });
    dispatch({ type: "setTrackMute", trackId: "pads", muted: true });
    expect(getUndoStack().length).toBe(3);
  });
});

describe("undo/redo", () => {
  it("undo/redo round-trips and redo clears on new mutation", () => {
    dispatch({ type: "setWaveform", trackId: "bass", waveform: "square" });
    dispatch({ type: "undo" });
    expect(projectStore.get().project.tracks.bass.patch?.waveform).toBe("sawtooth");
    expect(canRedo()).toBe(true);

    dispatch({ type: "redo" });
    expect(projectStore.get().project.tracks.bass.patch?.waveform).toBe("square");

    dispatch({ type: "undo" });
    dispatch({ type: "setWaveform", trackId: "bass", waveform: "sine" });
    expect(canRedo()).toBe(false);
  });

  it("undo with an empty stack is a typed error", () => {
    const result = dispatch({ type: "undo" });
    expect(result.ok).toBe(false);
  });

  it("caps depth at 100, dropping the oldest", () => {
    for (let i = 0; i < 105; i += 1) {
      dispatch({ type: "cycleDrumStep", lane: "hat", step: i % 16 });
    }
    expect(getUndoStack().length).toBe(100);
    let undone = 0;
    while (canUndo()) {
      dispatch({ type: "undo" });
      undone += 1;
    }
    expect(undone).toBe(100);
  });
});
