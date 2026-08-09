import { describe, expect, it } from "vitest";
import {
  ENVELOPE_PARAM_IDS,
  PARAMETER_GROUPS,
  groupsForTrack,
  locateControl
} from "../paramGroups";
import { PARAM_DEFS, type SynthParamId } from "../paramMap";

describe("parameter groups", () => {
  it("uses the group names and order from the Figma editor frames", () => {
    expect(groupsForTrack("bass").map((group) => group.title)).toEqual([
      "Oscillator",
      "Amp Envelope",
      "Filter"
    ]);
    // Voices only exists where the design shows a Group / Voices — Pads.
    expect(groupsForTrack("pads").map((group) => group.title)).toEqual([
      "Oscillator",
      "Voices",
      "Amp Envelope",
      "Filter"
    ]);
    expect(groupsForTrack("lead").some((group) => group.id === "voices")).toBe(false);
  });

  it("covers every synth parameter exactly once", () => {
    const placed = PARAMETER_GROUPS.flatMap((group) => [
      ...group.controls.filter((control): control is SynthParamId => control in PARAM_DEFS),
      ...group.more,
      ...(group.controls.includes("ampEnvelope") ? [...ENVELOPE_PARAM_IDS] : [])
    ]);
    expect([...placed].sort()).toEqual((Object.keys(PARAM_DEFS) as SynthParamId[]).sort());
  });

  it("keeps secondary parameters behind each group's own More tier", () => {
    expect(locateControl("bass", "octaveOffset")).toEqual({ groupId: "oscillator", secondary: true });
    expect(locateControl("bass", "filterEnvAmount")).toEqual({ groupId: "filter", secondary: true });
    expect(locateControl("bass", "cutoffHz")).toEqual({ groupId: "filter", secondary: false });
    expect(locateControl("bass", "waveform")).toEqual({ groupId: "oscillator", secondary: false });
  });

  it("resolves all four envelope parameters to the Amp Envelope group", () => {
    for (const param of ENVELOPE_PARAM_IDS) {
      expect(locateControl("bass", param)).toEqual({ groupId: "ampEnvelope", secondary: false });
    }
  });

  it("does not locate voices on a track that has no Voices group", () => {
    expect(locateControl("pads", "voices")).toEqual({ groupId: "voices", secondary: false });
    expect(locateControl("bass", "voices")).toBeNull();
  });

  it("names its contents so a collapsed group still reads", () => {
    for (const group of PARAMETER_GROUPS) {
      expect(group.summary.length).toBeGreaterThan(0);
      expect(group.summary.every((name) => name.trim().length > 0)).toBe(true);
    }
    const envelope = PARAMETER_GROUPS.find((group) => group.id === "ampEnvelope");
    expect(envelope?.summary).toEqual(["Punch", "Length", "Body", "Tail"]);
  });
});
