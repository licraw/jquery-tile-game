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
 * The prebuilt jam (brief §26): a coherent two-bar, 32-step loop in C minor at
 * 96 BPM. Steps 0–15 are bar 1, steps 16–31 are bar 2.
 *
 * Bar 1 is the statement — the pattern shown in the Figma 07 frames. Bar 2 is
 * deliberately NOT a copy: the harmony slows from a chord per beat to a chord
 * per half-bar (Ab, then Eb), the bass follows that new harmony, the lead
 * answers with a sparser phrase that starts a beat late, and the drums open up
 * for a small snare fill on the last two beats that leads back into bar 1. The
 * vocabulary stays beginner-simple; the point is only that the loop stays
 * pleasant across the many repeats a synthesis lesson takes.
 */
export function createDefaultProject(): Project {
  return {
    schemaVersion: 2,
    tempoBpm: 96,
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
            // Bar 2 drops the beat-4 kick and adds a pickup on the last 8th.
            kick: drumLane({
              0: "accent", 4: "on", 8: "accent", 12: "on",
              16: "accent", 20: "on", 24: "accent", 30: "on"
            }),
            // Backbeats hold; the fill is the last three 16ths of bar 2.
            snare: drumLane({
              4: "on", 12: "accent",
              20: "on", 28: "accent", 30: "on", 31: "on"
            }),
            // Steady 8ths, but bar 2 leaves the final 8th open for the fill.
            hat: drumLane({
              0: "on", 2: "accent", 4: "on", 6: "accent",
              8: "on", 10: "accent", 12: "on", 14: "accent",
              16: "on", 18: "accent", 20: "on", 22: "accent",
              24: "on", 26: "accent", 28: "on"
            }),
            perc: drumLane({ 7: "on", 10: "on", 23: "on", 26: "on" })
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
          // Bar 1: C1 on the downbeat pulse, Eb/F/G answering (Figma 07).
          // Bar 2: same rhythmic feel rooted on Ab, then Eb, ending on Bb so
          // the loop leans back into the C of bar 1.
          steps: noteSteps({
            0: 0, 3: 0, 5: 2, 6: 0, 8: 3, 10: 0, 11: 4, 14: 2,
            16: 5, 19: 5, 21: 0, 22: 5, 24: 2, 27: 2, 29: 4, 30: 6
          })
        }
      },
      pads: {
        id: "pads",
        muted: false,
        level: 0.55,
        patch: PADS_PATCH,
        pattern: {
          kind: "chords",
          // Cm Ab Eb Fm | Ab — — Eb — —. Halving the harmonic rhythm in bar 2
          // is what makes the second half read as a different bar.
          steps: chordSteps({ 0: "Cm", 4: "Ab", 8: "Eb", 12: "Fm", 16: "Ab", 24: "Eb" })
        }
      },
      lead: {
        id: "lead",
        muted: false,
        level: 0.6,
        patch: LEAD_PATCH,
        pattern: {
          kind: "notes",
          // Call in bar 1 (eight notes from the downbeat), response in bar 2:
          // six notes, entering half a beat late so the phrase breathes.
          steps: noteSteps({
            0: 4, 2: 2, 4: 3, 7: 4, 8: 7, 10: 6, 12: 4, 15: 2,
            18: 5, 20: 7, 23: 6, 26: 6, 28: 4, 31: 3
          })
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
