import { beforeEach, describe, expect, it } from "vitest";
import { createDefaultProject, createDefaultState } from "../defaultProject";
import { trackStrip } from "../derive";
import { playheadStore } from "../playheadStore";
import {
  BAR_COUNT,
  CHORD_VOICINGS,
  DRUM_LANES,
  STEPS_PER_BAR,
  STEP_COUNT,
  absoluteStep,
  barOfStep,
  chordAtStep,
  stepWithinBar,
  type ChordId
} from "../types";
import { uiStore } from "../uiStore";

describe("bar / step arithmetic", () => {
  it("splits the loop into two bars of sixteen", () => {
    expect(STEP_COUNT).toBe(STEPS_PER_BAR * BAR_COUNT);
    expect(barOfStep(0)).toBe(0);
    expect(barOfStep(STEPS_PER_BAR - 1)).toBe(0);
    expect(barOfStep(STEPS_PER_BAR)).toBe(1);
    expect(barOfStep(STEP_COUNT - 1)).toBe(1);
  });

  it("round-trips absolute step ↔ (bar, step in bar)", () => {
    for (let step = 0; step < STEP_COUNT; step += 1) {
      expect(absoluteStep(barOfStep(step), stepWithinBar(step))).toBe(step);
      expect(stepWithinBar(step)).toBeLessThan(STEPS_PER_BAR);
    }
  });

  it("crosses from step 15 to step 16 into bar 2 without restarting the loop", () => {
    // The seam the UI pages across: the last step of bar 1 and the first of
    // bar 2 are adjacent absolute steps, not two versions of step 0.
    expect(barOfStep(15)).toBe(0);
    expect(stepWithinBar(15)).toBe(15);
    expect(barOfStep(16)).toBe(1);
    expect(stepWithinBar(16)).toBe(0);
    expect(16 - 15).toBe(1);
  });

  it("wraps from step 31 back to step 0 rather than into a third bar", () => {
    expect(barOfStep(STEP_COUNT - 1)).toBe(BAR_COUNT - 1);
    expect(stepWithinBar(STEP_COUNT - 1)).toBe(STEPS_PER_BAR - 1);
    // There is no bar index 2 to land in — the next step is the top of bar 1.
    expect(barOfStep(0)).toBe(0);
    expect(BAR_COUNT).toBe(2);
  });
});

describe("playhead across the two-bar loop", () => {
  beforeEach(() => playheadStore.set(null));

  it("reports absolute steps and derives the sounding bar", () => {
    playheadStore.set(15);
    expect(playheadStore.get().step).toBe(15);
    expect(barOfStep(playheadStore.get().step!)).toBe(0);

    playheadStore.set(16);
    expect(barOfStep(playheadStore.get().step!)).toBe(1);

    playheadStore.set(31);
    expect(barOfStep(playheadStore.get().step!)).toBe(1);

    playheadStore.set(0);
    expect(barOfStep(playheadStore.get().step!)).toBe(0);
  });

  it("clears on stop", () => {
    playheadStore.set(20);
    playheadStore.set(null);
    expect(playheadStore.get().step).toBe(null);
  });

  it("never moves the bar the user is editing", () => {
    uiStore.setVisibleBar(1);
    for (let step = 0; step < STEP_COUNT; step += 1) {
      playheadStore.set(step);
    }
    // A full pass of the loop, including the wrap, leaves the view alone.
    expect(uiStore.get().visibleBar).toBe(1);
    uiStore.setVisibleBar(0);
  });

  it("ignores out-of-range bar selections", () => {
    uiStore.setVisibleBar(0);
    uiStore.setVisibleBar(BAR_COUNT);
    uiStore.setVisibleBar(-1);
    expect(uiStore.get().visibleBar).toBe(0);
  });
});

describe("all four tracks stay synchronized on one step index", () => {
  const project = createDefaultProject();

  it("addresses every track with the same absolute step", () => {
    for (let step = 0; step < STEP_COUNT; step += 1) {
      // Every track can answer "what happens at step N" for all 32 steps —
      // this is what keeps the four Tone.Sequences reading the same position.
      expect(DRUM_LANES.every((lane) => project.tracks.drums.pattern.lanes[lane][step] !== undefined)).toBe(true);
      expect(project.tracks.bass.pattern.steps.length).toBeGreaterThan(step);
      expect(project.tracks.pads.pattern.steps.length).toBeGreaterThan(step);
      expect(project.tracks.lead.pattern.steps.length).toBeGreaterThan(step);
    }
  });

  it("lands the starter jam's bar 2 events on the expected absolute steps", () => {
    const { drums, bass, pads, lead } = project.tracks;
    // Downbeat of bar 2 is step 16 on the tracks that mark it.
    expect(drums.pattern.lanes.kick[16]).toBe("accent");
    expect(pads.pattern.steps[16]).toBe("Ab");
    expect(bass.pattern.steps[16]).toBe(5);
    // The fill sits at the very end of bar 2, just before the loop wraps.
    expect(drums.pattern.lanes.snare[30]).toBe("on");
    expect(drums.pattern.lanes.snare[31]).toBe("on");
    // The lead answers late — bar 2 opens with a rest.
    expect(lead.pattern.steps[16]).toBe(null);
    expect(lead.pattern.steps[18]).toBe(5);
  });

  it("makes bar 2 musically different from bar 1", () => {
    const { drums, bass, pads, lead } = project.tracks;
    const bar1 = <T>(steps: T[]) => steps.slice(0, STEPS_PER_BAR);
    const bar2 = <T>(steps: T[]) => steps.slice(STEPS_PER_BAR);
    // A duplicated bar 2 would defeat the whole point of the change.
    expect(bar2(bass.pattern.steps)).not.toEqual(bar1(bass.pattern.steps));
    expect(bar2(pads.pattern.steps)).not.toEqual(bar1(pads.pattern.steps));
    expect(bar2(lead.pattern.steps)).not.toEqual(bar1(lead.pattern.steps));
    expect(DRUM_LANES.some((lane) => {
      const steps = drums.pattern.lanes[lane];
      return JSON.stringify(bar2(steps)) !== JSON.stringify(bar1(steps));
    })).toBe(true);
  });

  it("keeps every pad chord in bar 2 playable", () => {
    for (const chord of createDefaultProject().tracks.pads.pattern.steps) {
      if (chord) expect(CHORD_VOICINGS[chord as ChordId]).toBeDefined();
    }
  });
});

describe("derived views span the whole loop", () => {
  it("summarises 32 steps in the lane strip", () => {
    const project = createDefaultProject();
    for (const track of Object.values(project.tracks)) {
      expect(trackStrip(track.pattern)).toHaveLength(STEP_COUNT);
    }
  });

  it("holds a chord across the bar boundary", () => {
    const steps: (ChordId | null)[] = Array.from({ length: STEP_COUNT }, () => null);
    steps[8] = "Cm";
    // Started in bar 1, still sounding well into bar 2.
    expect(chordAtStep(steps, 20)).toEqual({ chord: "Cm", startStep: 8 });
    expect(chordAtStep(steps, STEP_COUNT - 1)).toEqual({ chord: "Cm", startStep: 8 });

    // A chord started late in bar 2 wraps around to cover the top of bar 1.
    const late: (ChordId | null)[] = Array.from({ length: STEP_COUNT }, () => null);
    late[28] = "Fm";
    expect(chordAtStep(late, 0)).toEqual({ chord: "Fm", startStep: 28 });
    expect(chordAtStep(late, 27)).toEqual({ chord: "Fm", startStep: 28 });
  });

  it("reads the default jam's bar 2 harmony", () => {
    const steps = createDefaultState().project.tracks.pads.pattern.steps;
    expect(chordAtStep(steps, 20)).toEqual({ chord: "Ab", startStep: 16 });
    expect(chordAtStep(steps, 31)).toEqual({ chord: "Eb", startStep: 24 });
  });
});
