import {
  DRUM_LANES,
  STEP_COUNT,
  type ChordPattern,
  type DrumPattern,
  type NotePattern
} from "./types";

/**
 * Track Lane pattern-strip derivation (Figma behavior contract: the strip is
 * derived from the same pattern array as the editor grid — never authored
 * separately). "accent" renders solid, "on" renders at reduced opacity.
 */
export type StripCell = "off" | "on" | "accent";

export function drumStrip(pattern: DrumPattern): StripCell[] {
  return Array.from({ length: STEP_COUNT }, (_, step) => {
    let cell: StripCell = "off";
    for (const lane of DRUM_LANES) {
      const value = pattern.lanes[lane][step];
      if (value === "accent") return "accent";
      if (value === "on") cell = "on";
    }
    return cell;
  });
}

export function noteStrip(pattern: NotePattern): StripCell[] {
  return pattern.steps.map((row) => (row === null ? "off" : "accent"));
}

export function chordStrip(pattern: ChordPattern): StripCell[] {
  return pattern.steps.map((chord) => (chord === null ? "off" : "accent"));
}

export function trackStrip(pattern: DrumPattern | NotePattern | ChordPattern): StripCell[] {
  switch (pattern.kind) {
    case "drums":
      return drumStrip(pattern);
    case "notes":
      return noteStrip(pattern);
    case "chords":
      return chordStrip(pattern);
  }
}
