import type { CSSProperties } from "react";
import type { TrackId } from "@/synth-lab/state/types";

/** Per-track identity baked in (Figma Track Lane: Track is a variant, not text). */
export const TRACK_META: Record<
  TrackId,
  { name: string; meta: string; tone: string; voiceChip: string }
> = {
  drums: {
    name: "Drums",
    meta: "4 sounds  ·  2 bars",
    tone: "var(--sl-tone-drums)",
    voiceChip: "SAMPLES  ·  PATTERN ONLY"
  },
  bass: {
    name: "Bass",
    meta: "8 notes  ·  one octave",
    tone: "var(--sl-tone-bass)",
    voiceChip: "MONO  ·  ONE NOTE AT A TIME"
  },
  pads: {
    name: "Pads",
    meta: "4 chords  ·  sustained",
    tone: "var(--sl-tone-pads)",
    voiceChip: "POLY  ·  UP TO 4 VOICES"
  },
  lead: {
    name: "Lead",
    meta: "8 notes  ·  one octave",
    tone: "var(--sl-tone-lead)",
    voiceChip: "MONO  ·  ONE NOTE AT A TIME"
  }
};

export function toneStyle(trackId: TrackId): CSSProperties {
  return { "--sl-tone": TRACK_META[trackId].tone } as CSSProperties;
}
