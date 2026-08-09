import { PARAM_DEFS, type SynthParamId } from "./paramMap";
import type { SynthTrackId } from "@/synth-lab/state/types";

/**
 * Parameter groups for the Selected Track Editor.
 *
 * The grouping is Figma's, not ours. `Soft Arcade Synth Lab` specifies:
 *
 * - `Group / Oscillator` (32:161) — the waveform selector under
 *   "OSCILLATOR · THE STARTING WAVEFORM". Register lives here because its own
 *   technical label is "OSCILLATOR · OCTAVE".
 * - `Group / Voices` (54:1125) — the Mono / 2 / 4 segmented control.
 * - `ADSR Envelope` (39:84) — "AMP ENVELOPE · A D S R", one direct-manipulation
 *   graph rather than four scalars.
 * - `Parameter Group` (27:104) — the "Filter" group: Brightness and Sharpness
 *   as essentials, with "filter envelope amount" named in its "+ More" line.
 *   That is why Sweep sits in Filter's secondary tier and there is no separate
 *   Filter Envelope group.
 *
 * Each group carries two disclosure levels, exactly as the component does: the
 * group itself expands/collapses, and inside an expanded group a "+ More" line
 * reveals the secondary parameters.
 */
export type ParameterGroupId = "oscillator" | "voices" | "ampEnvelope" | "filter";

/** A control slot inside a group. `ampEnvelope` is the ADSR graph (A/D/S/R). */
export type GroupControlId = SynthParamId | "waveform" | "voices" | "ampEnvelope";

export interface ParameterGroupDef {
  id: ParameterGroupId;
  /** Group title (Figma header, left). */
  title: string;
  /** Contextual/technical line under the title. Null where Figma shows none. */
  technical: string | null;
  /** Chip copy while the group is expanded (Figma: "ESSENTIALS"). */
  chip: string;
  /** Controls shown whenever the group is expanded. */
  controls: GroupControlId[];
  /** Secondary parameters behind the group's "+ More" disclosure. */
  more: SynthParamId[];
  /** "+ More · …" copy naming what is still hidden. */
  moreLabel: string | null;
  /**
   * Control names listed while the group is collapsed, so a collapsed group
   * still says what it holds. The count chip is this list's length.
   */
  summary: string[];
  /** Tracks that show this group. */
  tracks: SynthTrackId[];
}

const ALL_SYNTH_TRACKS: SynthTrackId[] = ["bass", "pads", "lead"];

export const PARAMETER_GROUPS: ParameterGroupDef[] = [
  {
    id: "oscillator",
    title: "Oscillator",
    technical: "THE STARTING WAVEFORM",
    chip: "ESSENTIALS",
    controls: ["waveform"],
    more: ["octaveOffset"],
    moreLabel: "octave",
    summary: ["Waveform", PARAM_DEFS.octaveOffset.label],
    tracks: ALL_SYNTH_TRACKS
  },
  {
    id: "voices",
    title: "Voices",
    technical: "HOW MANY NOTES AT ONCE",
    chip: "ESSENTIALS",
    controls: ["voices"],
    more: [],
    moreLabel: null,
    summary: ["Voices"],
    // Only Pads exposes polyphony in MVP — Bass is architecturally mono and the
    // Lead editor header says "MONO · ONE NOTE AT A TIME".
    tracks: ["pads"]
  },
  {
    id: "ampEnvelope",
    title: "Amp Envelope",
    technical: null,
    chip: "SHAPE",
    controls: ["ampEnvelope"],
    more: [],
    moreLabel: null,
    summary: [
      PARAM_DEFS.attack.label,
      PARAM_DEFS.decay.label,
      PARAM_DEFS.sustain.label,
      PARAM_DEFS.release.label
    ],
    tracks: ALL_SYNTH_TRACKS
  },
  {
    id: "filter",
    title: "Filter",
    technical: null,
    chip: "ESSENTIALS",
    controls: ["cutoffHz", "resonance"],
    more: ["filterEnvAmount"],
    moreLabel: "filter envelope amount",
    summary: [PARAM_DEFS.cutoffHz.label, PARAM_DEFS.resonance.label, PARAM_DEFS.filterEnvAmount.label],
    tracks: ALL_SYNTH_TRACKS
  }
];

/** The four amp-envelope parameters, in A-D-S-R order. */
export const ENVELOPE_PARAM_IDS = ["attack", "decay", "sustain", "release"] as const;
export type EnvelopeParamId = (typeof ENVELOPE_PARAM_IDS)[number];

export function groupsForTrack(trackId: SynthTrackId): ParameterGroupDef[] {
  return PARAMETER_GROUPS.filter((group) => group.tracks.includes(trackId));
}

/**
 * Where a lesson or agent highlight lands. Used to open the group holding a
 * hidden parameter instead of pointing at a control nobody can see.
 */
export interface ControlLocation {
  groupId: ParameterGroupId;
  /** True when the control only appears after the group's "+ More". */
  secondary: boolean;
}

export function locateControl(
  trackId: SynthTrackId,
  control: GroupControlId
): ControlLocation | null {
  for (const group of groupsForTrack(trackId)) {
    if (group.controls.includes(control)) return { groupId: group.id, secondary: false };
    // The envelope graph is the control for all four ADSR parameters, so a
    // highlight on "attack" resolves to the Amp Envelope group.
    if (
      group.controls.includes("ampEnvelope") &&
      (ENVELOPE_PARAM_IDS as readonly string[]).includes(control)
    ) {
      return { groupId: group.id, secondary: false };
    }
    if ((group.more as string[]).includes(control)) return { groupId: group.id, secondary: true };
  }
  return null;
}
