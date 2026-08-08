import { describe, expect, it } from "vitest";
import {
  PARAM_DEFS,
  normToValue,
  resonanceToQ,
  stepParam,
  valueToNorm
} from "@/synth-lab/engine/paramMap";
import { chordStrip, drumStrip, noteStrip } from "../derive";
import {
  CHORD_VOICINGS,
  STEP_COUNT,
  chordAtStep,
  noteRowLabels,
  rowToNoteName,
  type ChordId,
  type DrumStep
} from "../types";

describe("param curves and formatting", () => {
  it("maps log cutoff round-trip", () => {
    expect(normToValue("cutoffHz", 0)).toBeCloseTo(100);
    expect(normToValue("cutoffHz", 1)).toBeCloseTo(8000);
    const mid = normToValue("cutoffHz", 0.5);
    expect(mid).toBeCloseTo(Math.sqrt(100 * 8000), 0);
    expect(valueToNorm("cutoffHz", mid)).toBeCloseTo(0.5, 5);
  });

  it("formats display values per the registry", () => {
    expect(PARAM_DEFS.cutoffHz.format(4800)).toBe("4.8 kHz");
    expect(PARAM_DEFS.cutoffHz.format(720)).toBe("720 Hz");
    expect(PARAM_DEFS.attack.format(0.005)).toBe("5 ms");
    expect(PARAM_DEFS.release.format(1.5)).toBe("1.5 s");
    expect(PARAM_DEFS.resonance.format(0.18)).toBe("18%");
    expect(PARAM_DEFS.filterEnvAmount.format(1.6)).toBe("40%");
    expect(PARAM_DEFS.octaveOffset.format(-1)).toBe("−1 oct");
    expect(PARAM_DEFS.octaveOffset.format(1)).toBe("+1 oct");
  });

  it("steps log params perceptually and clamps at ends", () => {
    const up = stepParam("cutoffHz", 100, 1, false);
    expect(up).toBeGreaterThan(100);
    expect(stepParam("cutoffHz", 8000, 1, false)).toBe(8000);
    expect(stepParam("octaveOffset", 0, 1, false)).toBe(1);
    expect(stepParam("octaveOffset", 1, 1, false)).toBe(1);
    const large = stepParam("resonance", 0.5, 1, true);
    expect(large).toBeCloseTo(0.6);
  });

  it("maps resonance to a 0.5–12 Q range", () => {
    expect(resonanceToQ(0)).toBe(0.5);
    expect(resonanceToQ(1)).toBe(12);
  });
});

describe("note derivation", () => {
  it("maps rows to C-minor notes at the track register", () => {
    expect(rowToNoteName(0, "bass", 0)).toBe("C1");
    expect(rowToNoteName(2, "bass", 0)).toBe("Eb1");
    expect(rowToNoteName(7, "bass", 0)).toBe("C2");
    expect(rowToNoteName(0, "lead", 0)).toBe("C3");
    expect(rowToNoteName(7, "lead", 1)).toBe("C5");
    expect(rowToNoteName(4, "bass", -1)).toBe("G0");
  });

  it("labels grid rows bottom→top", () => {
    expect(noteRowLabels("bass")).toEqual(["C1", "D1", "Eb1", "F1", "G1", "Ab1", "Bb1", "C2"]);
    expect(noteRowLabels("lead")[7]).toBe("C4");
  });

  it("voicings are triads keyed by chord id", () => {
    (Object.keys(CHORD_VOICINGS) as ChordId[]).forEach((id) => {
      expect(CHORD_VOICINGS[id]).toHaveLength(3);
    });
  });
});

describe("held-chord derivation", () => {
  const steps: (ChordId | null)[] = Array.from({ length: STEP_COUNT }, () => null);
  steps[0] = "Cm";
  steps[8] = "Eb";

  it("a chord holds from its start until the next start", () => {
    expect(chordAtStep(steps, 0)).toEqual({ chord: "Cm", startStep: 0 });
    expect(chordAtStep(steps, 7)).toEqual({ chord: "Cm", startStep: 0 });
    expect(chordAtStep(steps, 8)).toEqual({ chord: "Eb", startStep: 8 });
    expect(chordAtStep(steps, 15)).toEqual({ chord: "Eb", startStep: 8 });
  });

  it("wraps across the loop boundary", () => {
    const late: (ChordId | null)[] = Array.from({ length: STEP_COUNT }, () => null);
    late[12] = "Fm";
    expect(chordAtStep(late, 2)).toEqual({ chord: "Fm", startStep: 12 });
  });

  it("an empty pattern holds nothing", () => {
    const empty: (ChordId | null)[] = Array.from({ length: STEP_COUNT }, () => null);
    expect(chordAtStep(empty, 5)).toBe(null);
  });
});

describe("lane strip derivation", () => {
  it("drum strip: accent wins over on, per column across lanes", () => {
    const lane = (entries: Record<number, DrumStep>) =>
      Array.from({ length: STEP_COUNT }, (_, i) => entries[i] ?? ("off" as DrumStep));
    const strip = drumStrip({
      kind: "drums",
      lanes: {
        kick: lane({ 0: "accent" }),
        snare: lane({ 1: "on" }),
        hat: lane({ 0: "on", 1: "on" }),
        perc: lane({})
      }
    });
    expect(strip[0]).toBe("accent");
    expect(strip[1]).toBe("on");
    expect(strip[2]).toBe("off");
  });

  it("note and chord strips mark present steps", () => {
    const notes = Array.from({ length: STEP_COUNT }, () => null as number | null);
    notes[3] = 5;
    expect(noteStrip({ kind: "notes", steps: notes })[3]).toBe("accent");
    expect(noteStrip({ kind: "notes", steps: notes })[4]).toBe("off");

    const chords = Array.from({ length: STEP_COUNT }, () => null as ChordId | null);
    chords[0] = "Cm";
    expect(chordStrip({ kind: "chords", steps: chords })[0]).toBe("accent");
    // Held steps are NOT shown in the summary strip — starts only.
    expect(chordStrip({ kind: "chords", steps: chords })[1]).toBe("off");
  });
});
