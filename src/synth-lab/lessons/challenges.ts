import type { SynthParamId } from "@/synth-lab/engine/paramMap";
import type { SynthLabCommand } from "@/synth-lab/state/commands";
import type { ConceptId, Project, SynthTrackId, TrackId } from "@/synth-lab/state/types";

/**
 * Challenge and recipe definitions (brief §10) with forgiving validators
 * (brief §23): challenges are educational guides, not puzzles with one exact
 * solution. Validators compare live project state against the state captured
 * when the challenge became active.
 */
export interface Challenge {
  id: string;
  /** Brief numbering 0–5; recipes have no number. */
  number: number | null;
  kind: "challenge" | "recipe";
  /** Eyebrow tag, e.g. "FILTERS". */
  tag: string;
  concept: ConceptId | null;
  title: string;
  body: string;
  /** Status line while listening for the change. */
  listening: string;
  /** Track selected when the challenge starts. */
  trackId: TrackId | null;
  /** Parameter to highlight while active. */
  highlight: { trackId: SynthTrackId; param: SynthParamId | "waveform" | "voices" } | null;
  /**
   * Establishes a musical context the challenge can actually be completed
   * from (brief flow D step 2). Returns commands the lesson dispatches on
   * start — visible, undoable, and validated like any other change. Without
   * this, a user who has already parked a control at its range end could not
   * satisfy a relative validator.
   */
  prepare?: (project: Project) => SynthLabCommand[];
  /** Success copy names the real synthesis concept (brief §6.4). */
  successTitle: string;
  successBody: string;
  validate: (project: Project, start: Project) => boolean;
  /** Recipe steps (recipes validate step by step). */
  steps?: { instruction: string; validate: (project: Project, start: Project) => boolean }[];
}

function countDrumEdits(project: Project, start: Project): number {
  let edits = 0;
  const lanes = project.tracks.drums.pattern.lanes;
  const startLanes = start.tracks.drums.pattern.lanes;
  for (const lane of Object.keys(lanes) as (keyof typeof lanes)[]) {
    lanes[lane].forEach((value, step) => {
      if (value !== startLanes[lane][step]) edits += 1;
    });
  }
  return edits;
}

export const CHALLENGES: Challenge[] = [
  {
    id: "challenge-0",
    number: 0,
    kind: "challenge",
    tag: "RHYTHM",
    concept: null,
    title: "Build the beat.",
    body: "The drums are the floor everything else stands on. Add or move a couple of steps in the drum grid — the loop keeps playing while you edit, and BAR 1 / BAR 2 switches which half of it you're looking at.",
    listening: "Listening for your drum edits…",
    trackId: "drums",
    highlight: null,
    successTitle: "That's a groove.",
    successBody: "You just used a step sequencer: each cell is one sixteenth of a bar, and the loop runs two bars — 32 steps. The grid shows one bar at a time, so BAR 2 is where the pattern can answer itself instead of just repeating.",
    validate: (project, start) => countDrumEdits(project, start) >= 2
  },
  {
    id: "challenge-1",
    number: 1,
    kind: "challenge",
    tag: "OSCILLATORS",
    concept: "oscillators",
    title: "Change the source.",
    body: "Every synth voice starts as a repeating wave. Switch the bass to a different waveform and listen to how the character changes before anything else shapes it.",
    listening: "Listening for a waveform change…",
    trackId: "bass",
    highlight: { trackId: "bass", param: "waveform" },
    successTitle: "That shape is an oscillator.",
    successBody: "The waveform you picked is the oscillator — the starting harmonic content. Brighter shapes like saw and square carry more harmonics for the filter to work with.",
    validate: (project, start) =>
      project.tracks.bass.patch?.waveform !== start.tracks.bass.patch?.waveform
  },
  {
    id: "challenge-2",
    number: 2,
    kind: "challenge",
    tag: "ENVELOPES",
    concept: "envelopes",
    title: "Make it pluck.",
    body: "Turn the sustained bass into a short, punchy sound. Short Punch, short Length, and low Body get you there — listen while you drag.",
    listening: "Listening for a plucky envelope…",
    trackId: "bass",
    highlight: { trackId: "bass", param: "decay" },
    successTitle: "That's the amp envelope.",
    successBody: "Punch, Length, Body and Tail are the amplitude envelope — attack, decay, sustain and release. A fast attack and low sustain is what reads as \"plucky.\"",
    validate: (project) => {
      const patch = project.tracks.bass.patch;
      if (!patch) return false;
      return patch.ampEnv.attack <= 0.03 && patch.ampEnv.decay <= 0.35 && patch.ampEnv.sustain <= 0.4;
    }
  },
  {
    id: "challenge-3",
    number: 3,
    kind: "challenge",
    tag: "FILTERS",
    concept: "filters",
    title: "Make the bass darker — without turning it down.",
    body: "The highlighted control is the one to move. Listen while you drag — the loop keeps playing.",
    listening: "Listening for your change…",
    trackId: "bass",
    highlight: { trackId: "bass", param: "cutoffHz" },
    // There has to be brightness to remove before "darker" means anything.
    prepare: (project) =>
      (project.tracks.bass.patch?.cutoffHz ?? 0) < 2000
        ? [{ type: "setSynthParam", trackId: "bass", param: "cutoffHz", value: 4800 }]
        : [],
    successTitle: "That's the filter.",
    successBody: "Brightness is the low-pass filter cutoff. Lowering it removes high-frequency harmonics, so the sound gets darker while the level stays the same.",
    // "Darker" = cutoff reduced at least one octave from the challenge's
    // starting value (plan §10) — forgiving, no exact target.
    validate: (project, start) => {
      const cutoff = project.tracks.bass.patch?.cutoffHz;
      const startCutoff = start.tracks.bass.patch?.cutoffHz;
      if (!cutoff || !startCutoff) return false;
      return cutoff <= startCutoff / 2;
    }
  },
  {
    id: "challenge-4",
    number: 4,
    kind: "challenge",
    tag: "FILTER MOVEMENT",
    concept: "filters",
    title: "Add movement.",
    body: "A static filter is only half the story. Raise Sweep so every bass note starts bright and closes darker as it plays.",
    listening: "Listening for filter movement…",
    trackId: "bass",
    highlight: { trackId: "bass", param: "filterEnvAmount" },
    // Leave headroom above the current Sweep so it can audibly increase.
    prepare: (project) =>
      (project.tracks.bass.patch?.filterEnvAmount ?? 0) > 2.5
        ? [{ type: "setSynthParam", trackId: "bass", param: "filterEnvAmount", value: 1 }]
        : [],
    successTitle: "That's a filter envelope.",
    successBody: "Sweep is the filter envelope amount: an envelope pushes the cutoff up and lets it fall over time, which is why the note moves instead of sitting still.",
    validate: (project, start) => {
      const amount = project.tracks.bass.patch?.filterEnvAmount ?? 0;
      const startAmount = start.tracks.bass.patch?.filterEnvAmount ?? 0;
      return amount >= startAmount + 0.75;
    }
  },
  {
    id: "challenge-5",
    number: 5,
    kind: "challenge",
    tag: "POLYPHONY",
    concept: "polyphony",
    title: "Build a pad.",
    body: "The pads are playing one note at a time right now. Raise Voices and hear the chord open up — that jump from one note to several is polyphony.",
    listening: "Listening for more voices…",
    trackId: "pads",
    highlight: { trackId: "pads", param: "voices" },
    // Start from one voice so the jump to polyphony is the audible event.
    prepare: (project) =>
      project.tracks.pads.patch?.voices !== 1 ? [{ type: "setVoices", trackId: "pads", voices: 1 }] : [],
    successTitle: "That's polyphony.",
    successBody: "A monophonic synth plays one note at a time; a polyphonic one allocates a voice per note. Slow attack and release is what turns those chords into a pad.",
    validate: (project) => {
      const patch = project.tracks.pads.patch;
      if (!patch || patch.voices < 2) return false;
      return project.tracks.pads.pattern.steps.some((chord) => chord !== null);
    }
  },
  {
    id: "recipe-sub-bass",
    number: null,
    kind: "recipe",
    tag: "SUB BASS",
    concept: "recipes",
    title: "Recipe: sub bass.",
    body: "A sub bass is almost pure fundamental: a sine wave, a steady filter, and a closed-down cutoff. Three moves.",
    listening: "Following the recipe…",
    trackId: "bass",
    highlight: { trackId: "bass", param: "waveform" },
    successTitle: "That's a sub bass.",
    successBody: "Sine oscillator, steady filter, low cutoff: with almost no harmonics above the fundamental, the note is felt more than heard. A synthesis approximation, not a rule.",
    validate: () => false, // recipes complete via steps
    steps: [
      {
        instruction: "Set the bass oscillator to Sine — the purest source.",
        validate: (project) => project.tracks.bass.patch?.waveform === "sine"
      },
      {
        instruction: "Take Sweep to zero — a sub stays steady, it never opens up.",
        validate: (project) => (project.tracks.bass.patch?.filterEnvAmount ?? 4) <= 0.4
      },
      {
        instruction: "Pull Brightness below about 400 Hz to keep only the low end.",
        validate: (project) => (project.tracks.bass.patch?.cutoffHz ?? Infinity) <= 450
      }
    ]
  },
  {
    id: "recipe-warm-pad",
    number: null,
    kind: "recipe",
    tag: "WARM PAD",
    concept: "recipes",
    title: "Recipe: warm pad.",
    body: "Warm pads are rich sources tamed by a soft filter and slow edges. Three moves on the Pads track.",
    listening: "Following the recipe…",
    trackId: "pads",
    highlight: { trackId: "pads", param: "attack" },
    successTitle: "That's a warm pad.",
    successBody: "A saw source keeps the harmonics, the low cutoff rounds them off, and the slow attack and release blur the edges between chords — the classic warm-pad recipe.",
    validate: () => false,
    steps: [
      {
        instruction: "Give the pads a rich source: Saw or Square oscillator.",
        validate: (project) =>
          project.tracks.pads.patch?.waveform === "sawtooth" || project.tracks.pads.patch?.waveform === "square"
      },
      {
        instruction: "Slow Punch past 200 ms so chords fade in.",
        validate: (project) => (project.tracks.pads.patch?.ampEnv.attack ?? 0) >= 0.2
      },
      {
        instruction: "Soften Brightness below about 2 kHz to take off the edge.",
        validate: (project) => (project.tracks.pads.patch?.cutoffHz ?? Infinity) <= 2200
      }
    ]
  }
];

export const CHALLENGE_COUNT = CHALLENGES.filter((c) => c.kind === "challenge").length;

export function getChallenge(id: string | null): Challenge | null {
  if (!id) return null;
  return CHALLENGES.find((challenge) => challenge.id === id) ?? null;
}

export function nextIncompleteChallenge(completed: string[], afterId: string | null): Challenge | null {
  const startIndex = afterId ? CHALLENGES.findIndex((c) => c.id === afterId) + 1 : 0;
  for (let i = 0; i < CHALLENGES.length; i += 1) {
    const challenge = CHALLENGES[(startIndex + i) % CHALLENGES.length];
    if (!completed.includes(challenge.id)) return challenge;
  }
  return null;
}
