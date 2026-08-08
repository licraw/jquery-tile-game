export type TrackId = "drums" | "bass" | "pads" | "lead";
export type DrumLaneId = "kick" | "snare" | "hat" | "perc";
export type DrumStep = "off" | "on" | "accent";
export type Waveform = "sine" | "triangle" | "sawtooth" | "square";
export const STEP_COUNT = 16;

// C minor, one octave — the only scale in MVP (Figma decision G1).
// Row index 0 = lowest row. Bass rows C1..C2, Lead rows C3..C4.
export const SCALE_DEGREES = ["C", "D", "Eb", "F", "G", "Ab", "Bb", "C8va"] as const;
export const SCALE_ROW_COUNT = SCALE_DEGREES.length;

// Pads rows, bottom→top in Figma: Fm, Eb, Ab, Cm — stored by id with fixed voicings.
export type ChordId = "Cm" | "Ab" | "Eb" | "Fm";
export const CHORD_IDS: ChordId[] = ["Cm", "Ab", "Eb", "Fm"];
export const CHORD_VOICINGS: Record<ChordId, string[]> = {
  Cm: ["C3", "Eb3", "G3"],
  Ab: ["Ab2", "C3", "Eb3"],
  Eb: ["Eb3", "G3", "Bb3"],
  Fm: ["F3", "Ab3", "C4"]
};

export const DRUM_LANES: DrumLaneId[] = ["kick", "snare", "hat", "perc"];

export interface DrumPattern {
  kind: "drums";
  lanes: Record<DrumLaneId, DrumStep[]>;
}

export interface NotePattern {
  kind: "notes";
  steps: (number | null)[]; // scale-row 0–7; null = rest
}

export interface ChordPattern {
  kind: "chords";
  steps: (ChordId | null)[]; // non-null = chord START; held cells are derived, never stored
}

export interface AmpEnvelope {
  attack: number; // seconds
  decay: number; // seconds
  sustain: number; // 0–1
  release: number; // seconds
}

export interface SynthPatch {
  waveform: Waveform;
  octaveOffset: -1 | 0 | 1; // relative to the track's home register
  ampEnv: AmpEnvelope;
  cutoffHz: number; // low-pass cutoff floor ("Brightness")
  resonance: number; // 0–1 UI value → mapped to filter Q ("Sharpness")
  filterEnvAmount: number; // octaves above cutoffHz (0–4)
  voices: 1 | 2 | 4; // pads/lead; bass is architecturally 1
}

export interface Track<P> {
  id: TrackId;
  muted: boolean;
  level: number; // 0–1 → dB in engine
  pattern: P;
  patch: SynthPatch | null; // null for drums (samples, not synthesis)
}

export interface Project {
  schemaVersion: 1;
  tempoBpm: number; // 60–180, default 112
  masterLevel: number; // 0–1
  tracks: {
    drums: Track<DrumPattern>;
    bass: Track<NotePattern>;
    pads: Track<ChordPattern>;
    lead: Track<NotePattern>;
  };
}

export type ConceptId = "oscillators" | "envelopes" | "filters" | "polyphony" | "recipes";

export interface LessonProgress {
  activeChallengeId: string | null; // null = Free Play
  completed: string[]; // challenge ids
  concepts: Record<ConceptId, boolean>;
}

export interface AgentChange {
  path: string;
  label: string;
  before: unknown;
  after: unknown;
  formattedBefore: string;
  formattedAfter: string;
}

export interface AgentAction {
  id: string;
  timestamp: number;
  trackId: TrackId | null;
  changes: AgentChange[];
  reason?: string;
  transactionId: string; // ties to the history entry Undo reverses
  status: "working" | "applied" | "error";
  error?: string;
}

export interface SynthLabState {
  project: Project;
  selectedTrackId: TrackId; // UI-meaningful, persisted, NOT in history
  transportStatus: "idle" | "playing"; // audio-not-started is a UI gate, not state here
  lessons: LessonProgress;
  agentActivity: AgentAction[]; // display log (history owns reversibility)
}

export type SynthTrackId = "bass" | "pads" | "lead";
export const SYNTH_TRACK_IDS: SynthTrackId[] = ["bass", "pads", "lead"];
export const TRACK_IDS: TrackId[] = ["drums", "bass", "pads", "lead"];

/** Home register (octave of scale row 0) per synth track. */
export const TRACK_BASE_OCTAVE: Record<SynthTrackId, number> = {
  bass: 1,
  pads: 3, // pads use chord voicings, base octave listed for completeness
  lead: 3
};

const DEGREE_NOTE: Record<(typeof SCALE_DEGREES)[number], { name: string; octaveUp: number }> = {
  C: { name: "C", octaveUp: 0 },
  D: { name: "D", octaveUp: 0 },
  Eb: { name: "Eb", octaveUp: 0 },
  F: { name: "F", octaveUp: 0 },
  G: { name: "G", octaveUp: 0 },
  Ab: { name: "Ab", octaveUp: 0 },
  Bb: { name: "Bb", octaveUp: 0 },
  C8va: { name: "C", octaveUp: 1 }
};

/** Row index → concrete note name, e.g. (2, "bass", 0) → "Eb1". */
export function rowToNoteName(row: number, trackId: "bass" | "lead", octaveOffset: number): string {
  const degree = SCALE_DEGREES[row];
  const { name, octaveUp } = DEGREE_NOTE[degree];
  return `${name}${TRACK_BASE_OCTAVE[trackId] + octaveOffset + octaveUp}`;
}

/** Row labels bottom→top for the note grid, e.g. C1..C2 for bass. */
export function noteRowLabels(trackId: "bass" | "lead"): string[] {
  return SCALE_DEGREES.map((_, row) => rowToNoteName(row, trackId, 0));
}

/** Derived pad "held" ranges: a chord sounds from its start step until the next start. */
export function chordAtStep(steps: (ChordId | null)[], step: number): { chord: ChordId; startStep: number } | null {
  for (let i = step; i >= 0; i -= 1) {
    const chord = steps[i];
    if (chord) {
      return { chord, startStep: i };
    }
  }
  // Loop wrap: the last chord of the bar holds across the loop start.
  for (let i = steps.length - 1; i > step; i -= 1) {
    const chord = steps[i];
    if (chord) {
      return { chord, startStep: i };
    }
  }
  return null;
}
