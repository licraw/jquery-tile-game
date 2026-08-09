import { describe, expect, it } from "vitest";
import { createDefaultProject } from "@/synth-lab/state/defaultProject";
import { STEPS_PER_BAR, STEP_COUNT, type Project } from "@/synth-lab/state/types";
import { getChallenge } from "../challenges";

function withBassPatch(project: Project, patch: Partial<NonNullable<Project["tracks"]["bass"]["patch"]>>): Project {
  const bass = project.tracks.bass;
  return {
    ...project,
    tracks: {
      ...project.tracks,
      bass: { ...bass, patch: { ...bass.patch!, ...patch, ampEnv: { ...bass.patch!.ampEnv, ...(patch.ampEnv ?? {}) } } }
    }
  };
}

describe("challenge validators (forgiving bands)", () => {
  const start = createDefaultProject();

  it("challenge-0: two drum edits pass, one does not", () => {
    const c = getChallenge("challenge-0")!;
    const one = structuredClone(start);
    one.tracks.drums.pattern.lanes.perc[1] = "on";
    expect(c.validate(one, start)).toBe(false);
    const two = structuredClone(one);
    two.tracks.drums.pattern.lanes.perc[3] = "on";
    expect(c.validate(two, start)).toBe(true);
  });

  it("challenge-1: any waveform change passes", () => {
    const c = getChallenge("challenge-1")!;
    expect(c.validate(start, start)).toBe(false);
    expect(c.validate(withBassPatch(start, { waveform: "sine" }), start)).toBe(true);
  });

  it("challenge-2: plucky needs short attack+decay and low sustain", () => {
    const c = getChallenge("challenge-2")!;
    const plucky = withBassPatch(start, { ampEnv: { attack: 0.005, decay: 0.12, sustain: 0.1, release: 0.2 } });
    expect(c.validate(plucky, start)).toBe(true);
    const nearMiss = withBassPatch(start, { ampEnv: { attack: 0.005, decay: 0.12, sustain: 0.8, release: 0.2 } });
    expect(c.validate(nearMiss, start)).toBe(false);
  });

  it("challenge-3: darker = at least one octave down from the start value", () => {
    const c = getChallenge("challenge-3")!;
    expect(c.validate(withBassPatch(start, { cutoffHz: 2400 }), start)).toBe(true);
    expect(c.validate(withBassPatch(start, { cutoffHz: 3000 }), start)).toBe(false);
  });

  it("challenge-4: raising sweep by ~1 octave passes", () => {
    const c = getChallenge("challenge-4")!;
    expect(c.validate(withBassPatch(start, { filterEnvAmount: 2.4 }), start)).toBe(true);
    expect(c.validate(withBassPatch(start, { filterEnvAmount: 1.7 }), start)).toBe(false);
  });

  it("challenge-5: needs voices ≥ 2 and at least one chord", () => {
    const c = getChallenge("challenge-5")!;
    const mono = structuredClone(start);
    mono.tracks.pads.patch!.voices = 1;
    expect(c.validate(mono, mono)).toBe(false);
    const poly = structuredClone(mono);
    poly.tracks.pads.patch!.voices = 4;
    expect(c.validate(poly, mono)).toBe(true);
    const polyNoChords = structuredClone(poly);
    polyNoChords.tracks.pads.pattern.steps = polyNoChords.tracks.pads.pattern.steps.map(() => null);
    expect(c.validate(polyNoChords, mono)).toBe(false);
  });

  it("prepare() restores headroom so relative validators stay completable", () => {
    const parked = withBassPatch(start, { cutoffHz: 100, filterEnvAmount: 4 });
    const darker = getChallenge("challenge-3")!;
    expect(darker.prepare!(parked)).toEqual([
      { type: "setSynthParam", trackId: "bass", param: "cutoffHz", value: 4800 }
    ]);
    // Already bright: nothing to set up.
    expect(darker.prepare!(start)).toEqual([]);

    const movement = getChallenge("challenge-4")!;
    expect(movement.prepare!(parked)).toEqual([
      { type: "setSynthParam", trackId: "bass", param: "filterEnvAmount", value: 1 }
    ]);
    expect(movement.prepare!(start)).toEqual([]);

    const pad = getChallenge("challenge-5")!;
    expect(pad.prepare!(start)).toEqual([{ type: "setVoices", trackId: "pads", voices: 1 }]);
  });

  it("challenge-0 counts edits made in bar 2, not just bar 1", () => {
    const c = getChallenge("challenge-0")!;
    const bar2Only = structuredClone(start);
    bar2Only.tracks.drums.pattern.lanes.perc[STEPS_PER_BAR + 1] = "on";
    expect(c.validate(bar2Only, start)).toBe(false);
    bar2Only.tracks.drums.pattern.lanes.kick[STEP_COUNT - 2] = "accent";
    expect(c.validate(bar2Only, start)).toBe(true);
  });

  it("challenge-0 counts one edit per bar as two edits", () => {
    const c = getChallenge("challenge-0")!;
    const split = structuredClone(start);
    split.tracks.drums.pattern.lanes.perc[1] = "on";
    split.tracks.drums.pattern.lanes.perc[STEPS_PER_BAR + 1] = "on";
    expect(c.validate(split, start)).toBe(true);
  });

  it("challenge-5 accepts a chord that only exists in bar 2", () => {
    const c = getChallenge("challenge-5")!;
    const mono = structuredClone(start);
    mono.tracks.pads.patch!.voices = 1;
    const bar2Chord = structuredClone(mono);
    bar2Chord.tracks.pads.patch!.voices = 4;
    bar2Chord.tracks.pads.pattern.steps = bar2Chord.tracks.pads.pattern.steps.map((_, step) =>
      step === STEPS_PER_BAR + 4 ? "Cm" : null
    );
    expect(c.validate(bar2Chord, mono)).toBe(true);
  });

  it("validators see the full 32-step patterns", () => {
    expect(start.tracks.drums.pattern.lanes.kick).toHaveLength(STEP_COUNT);
    expect(start.tracks.pads.pattern.steps).toHaveLength(STEP_COUNT);
  });

  it("recipe steps validate in sequence", () => {
    const recipe = getChallenge("recipe-sub-bass")!;
    expect(recipe.steps).toHaveLength(3);
    const step1 = withBassPatch(start, { waveform: "sine" });
    expect(recipe.steps![0].validate(step1, start)).toBe(true);
    expect(recipe.steps![1].validate(step1, start)).toBe(false);
    const step2 = withBassPatch(step1, { filterEnvAmount: 0 });
    expect(recipe.steps![1].validate(step2, start)).toBe(true);
    const step3 = withBassPatch(step2, { cutoffHz: 300 });
    expect(recipe.steps![2].validate(step3, start)).toBe(true);
  });
});
