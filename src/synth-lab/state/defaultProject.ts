import {
  STEP_COUNT,
  type ChordId,
  type DrumStep,
  type Project,
  type SynthLabState,
  type SynthPatch
} from "./types";

function drumLane(entries: Record<number, DrumStep>): DrumStep[] {
  return Array.from({ length: STEP_COUNT }, (_, step) => entries[step] ?? "off");
}

function noteSteps(entries: Record<number, number>): (number | null)[] {
  return Array.from({ length: STEP_COUNT }, (_, step) => (step in entries ? entries[step] : null));
}

function chordSteps(entries: Record<number, ChordId>): (ChordId | null)[] {
  return Array.from({ length: STEP_COUNT }, (_, step) => entries[step] ?? null);
}

const BASS_PATCH: SynthPatch = {
  waveform: "sawtooth",
  octaveOffset: 0,
  ampEnv: { attack: 0.005, decay: 0.14, sustain: 0.2, release: 0.18 },
  cutoffHz: 4800,
  resonance: 0.18,
  filterEnvAmount: 1.6,
  voices: 1
};

const PADS_PATCH: SynthPatch = {
  waveform: "sawtooth",
  octaveOffset: 0,
  ampEnv: { attack: 0.4, decay: 0.3, sustain: 0.7, release: 1.2 },
  cutoffHz: 1600,
  resonance: 0.1,
  filterEnvAmount: 0.4,
  voices: 4
};

const LEAD_PATCH: SynthPatch = {
  waveform: "square",
  octaveOffset: 0,
  ampEnv: { attack: 0.01, decay: 0.18, sustain: 0.35, release: 0.25 },
  cutoffHz: 3200,
  resonance: 0.25,
  filterEnvAmount: 1,
  voices: 1
};

/** Fresh copies of the default patches, used by the resetPatch command. */
export function defaultPatchFor(trackId: "bass" | "pads" | "lead"): SynthPatch {
  const source = trackId === "bass" ? BASS_PATCH : trackId === "pads" ? PADS_PATCH : LEAD_PATCH;
  return { ...source, ampEnv: { ...source.ampEnv } };
}

/**
 * The prebuilt jam (brief §26): a coherent 16-step loop in C minor at 112 BPM.
 * Bass and pad content matches the patterns shown in the Figma 07 frames.
 */
export function createDefaultProject(): Project {
  return {
    schemaVersion: 1,
    tempoBpm: 112,
    masterLevel: 0.8,
    tracks: {
      drums: {
        id: "drums",
        muted: false,
        level: 0.8,
        patch: null,
        pattern: {
          kind: "drums",
          lanes: {
            kick: drumLane({ 0: "accent", 4: "on", 8: "accent", 12: "on" }),
            snare: drumLane({ 4: "on", 12: "accent" }),
            hat: drumLane({
              0: "on", 2: "accent", 4: "on", 6: "accent",
              8: "on", 10: "accent", 12: "on", 14: "accent"
            }),
            perc: drumLane({ 7: "on", 10: "on" })
          }
        }
      },
      bass: {
        id: "bass",
        muted: false,
        level: 0.8,
        patch: BASS_PATCH,
        pattern: {
          kind: "notes",
          // C1 on the downbeat pulse, with Eb/F/G answering — Figma 07 pattern.
          steps: noteSteps({ 0: 0, 3: 0, 5: 2, 6: 0, 8: 3, 10: 0, 11: 4, 14: 2 })
        }
      },
      pads: {
        id: "pads",
        muted: false,
        level: 0.55,
        patch: PADS_PATCH,
        pattern: {
          kind: "chords",
          steps: chordSteps({ 0: "Cm", 4: "Ab", 8: "Eb", 12: "Fm" })
        }
      },
      lead: {
        id: "lead",
        muted: false,
        level: 0.6,
        patch: LEAD_PATCH,
        pattern: {
          kind: "notes",
          steps: noteSteps({ 0: 4, 2: 2, 4: 3, 7: 4, 8: 7, 10: 6, 12: 4, 15: 2 })
        }
      }
    }
  };
}

export function createDefaultState(): SynthLabState {
  return {
    project: createDefaultProject(),
    selectedTrackId: "bass",
    transportStatus: "idle",
    lessons: {
      activeChallengeId: "challenge-0",
      completed: [],
      concepts: {
        oscillators: false,
        envelopes: false,
        filters: false,
        polyphony: false,
        recipes: false
      }
    },
    agentActivity: []
  };
}
