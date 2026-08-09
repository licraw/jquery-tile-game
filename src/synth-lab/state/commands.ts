import { PARAM_DEFS, clampParam, withParamValue, type SynthParamId } from "@/synth-lab/engine/paramMap";
import { createDefaultProject, defaultPatchFor } from "./defaultProject";
import {
  commitGesture as historyCommitGesture,
  recordTransaction,
  redoTransaction,
  setRecordingSuppressed,
  undoTransaction,
  type Transaction,
  type TransactionOrigin
} from "./history";
import { schedulePersist } from "./persistence";
import { projectStore } from "./projectStore";
import {
  CHORD_IDS,
  DRUM_LANES,
  STEP_COUNT,
  type AmpEnvelope,
  type ChordId,
  type DrumLaneId,
  type DrumStep,
  type Project,
  type SynthLabState,
  type SynthPatch,
  type SynthTrackId,
  type TrackId,
  type Waveform
} from "./types";

/**
 * The application command layer (plan §10): the ONLY way to mutate Synth Lab
 * state, shared by the UI, lessons, undo, and the WebMCP adapter. Validation
 * lives here; invalid input returns a typed error and leaves state untouched.
 */
export type CommandOrigin = TransactionOrigin;

export type SynthLabCommand =
  | { type: "play" }
  | { type: "stop" }
  | { type: "setTempo"; bpm: number }
  | { type: "setMasterLevel"; level: number }
  | { type: "selectTrack"; trackId: TrackId }
  | { type: "cycleDrumStep"; lane: DrumLaneId; step: number }
  | { type: "setDrumStep"; lane: DrumLaneId; step: number; value: DrumStep }
  | { type: "setStepNote"; trackId: "bass" | "lead"; step: number; row: number | null }
  | { type: "setStepChord"; step: number; chord: ChordId | null }
  | { type: "setTrackMute"; trackId: TrackId; muted: boolean }
  | { type: "setTrackLevel"; trackId: TrackId; level: number }
  | { type: "setWaveform"; trackId: SynthTrackId; waveform: Waveform }
  | { type: "setSynthParam"; trackId: SynthTrackId; param: SynthParamId; value: number }
  | { type: "setEnvelope"; trackId: SynthTrackId; env: Partial<AmpEnvelope> }
  | { type: "setVoices"; trackId: "pads" | "lead"; voices: 1 | 2 | 4 }
  | { type: "applyPatch"; trackId: SynthTrackId; patch: Partial<SynthPatch> }
  | { type: "resetPatch"; trackId: SynthTrackId }
  | { type: "resetTrackPattern"; trackId: TrackId }
  | { type: "resetProject" }
  | { type: "undo" }
  | { type: "redo" };

export type CommandResult =
  | { ok: true; state: SynthLabState; transaction: Transaction | null }
  | { ok: false; error: string };

const TRACK_LABELS: Record<TrackId, string> = {
  drums: "Drums",
  bass: "Bass",
  pads: "Pads",
  lead: "Lead"
};

const WAVEFORMS: Waveform[] = ["sine", "triangle", "sawtooth", "square"];
const WAVEFORM_LABELS: Record<Waveform, string> = {
  sine: "Sine",
  triangle: "Triangle",
  sawtooth: "Saw",
  square: "Square"
};

const DRUM_STEP_CYCLE: Record<DrumStep, DrumStep> = { off: "on", on: "accent", accent: "off" };

function invalid(error: string): CommandResult {
  return { ok: false, error };
}

function validStep(step: number): boolean {
  return Number.isInteger(step) && step >= 0 && step < STEP_COUNT;
}

interface MutationSpec {
  project: Project;
  label: string;
  coalesceKey?: string;
}

export function dispatch(command: SynthLabCommand, origin: CommandOrigin = "user"): CommandResult {
  const state = projectStore.get();
  const { project } = state;

  // Non-history commands first (plan §10: play/stop/selectTrack/undo/redo
  // never create history entries).
  switch (command.type) {
    case "play": {
      const next = { ...state, transportStatus: "playing" as const };
      projectStore.set(next);
      return { ok: true, state: next, transaction: null };
    }
    case "stop": {
      const next = { ...state, transportStatus: "idle" as const };
      projectStore.set(next);
      return { ok: true, state: next, transaction: null };
    }
    case "selectTrack": {
      if (!(command.trackId in TRACK_LABELS)) return invalid(`Unknown track "${command.trackId}".`);
      const next = { ...state, selectedTrackId: command.trackId };
      projectStore.set(next);
      schedulePersist(projectStore.get);
      return { ok: true, state: next, transaction: null };
    }
    case "undo": {
      const result = undoTransaction(project);
      if (!result) return invalid("Nothing to undo.");
      const next = { ...state, project: result.project };
      projectStore.set(next);
      schedulePersist(projectStore.get);
      return { ok: true, state: next, transaction: result.transaction };
    }
    case "redo": {
      const result = redoTransaction(project);
      if (!result) return invalid("Nothing to redo.");
      const next = { ...state, project: result.project };
      projectStore.set(next);
      schedulePersist(projectStore.get);
      return { ok: true, state: next, transaction: result.transaction };
    }
    default:
      break;
  }

  const spec = buildMutation(project, command);
  if ("error" in spec) return invalid(spec.error);

  const transaction = recordTransaction(project, spec.project, {
    origin,
    label: spec.label,
    coalesceKey: spec.coalesceKey
  });
  const next = { ...state, project: spec.project };
  projectStore.set(next);
  schedulePersist(projectStore.get);
  return { ok: true, state: next, transaction };
}

function buildMutation(project: Project, command: SynthLabCommand): MutationSpec | { error: string } {
  switch (command.type) {
    case "setTempo": {
      if (!Number.isFinite(command.bpm)) return { error: "Tempo must be a number." };
      const bpm = Math.round(Math.min(180, Math.max(60, command.bpm)));
      return { project: { ...project, tempoBpm: bpm }, label: "Tempo", coalesceKey: "tempo" };
    }

    case "setMasterLevel": {
      if (!Number.isFinite(command.level)) return { error: "Master level must be a number." };
      const level = Math.min(1, Math.max(0, command.level));
      return { project: { ...project, masterLevel: level }, label: "Master level", coalesceKey: "master" };
    }

    case "cycleDrumStep":
    case "setDrumStep": {
      if (!DRUM_LANES.includes(command.lane)) return { error: `Unknown drum lane "${command.lane}".` };
      if (!validStep(command.step)) return { error: `Step must be 0–${STEP_COUNT - 1}.` };
      const lanes = project.tracks.drums.pattern.lanes;
      const current = lanes[command.lane][command.step];
      const value = command.type === "cycleDrumStep" ? DRUM_STEP_CYCLE[current] : command.value;
      if (command.type === "setDrumStep" && !["off", "on", "accent"].includes(value)) {
        return { error: `Drum step value must be off, on, or accent.` };
      }
      if (value === current) {
        // Idempotent set (agent/lesson) — succeed without recording history.
        return { project, label: `Drums · ${command.lane} step ${command.step + 1}` };
      }
      const laneSteps = [...lanes[command.lane]];
      laneSteps[command.step] = value;
      return {
        project: setTrackPattern(project, "drums", {
          kind: "drums",
          lanes: { ...lanes, [command.lane]: laneSteps }
        }),
        label: `Drums · ${command.lane} step ${command.step + 1}`
      };
    }

    case "setStepNote": {
      if (command.trackId !== "bass" && command.trackId !== "lead") {
        return { error: `setStepNote targets bass or lead.` };
      }
      if (!validStep(command.step)) return { error: `Step must be 0–${STEP_COUNT - 1}.` };
      if (command.row !== null && (!Number.isInteger(command.row) || command.row < 0 || command.row > 7)) {
        return { error: "Row must be 0–7 or null." };
      }
      const track = project.tracks[command.trackId];
      const steps = [...track.pattern.steps];
      // One note per column is a state rule: placing a note replaces any
      // existing note in that column (monophony made visible).
      steps[command.step] = command.row;
      return {
        project: setTrackPattern(project, command.trackId, { kind: "notes", steps }),
        label: `${TRACK_LABELS[command.trackId]} · step ${command.step + 1}`
      };
    }

    case "setStepChord": {
      if (!validStep(command.step)) return { error: `Step must be 0–${STEP_COUNT - 1}.` };
      if (command.chord !== null && !CHORD_IDS.includes(command.chord)) {
        return { error: `Unknown chord "${command.chord}".` };
      }
      const steps = [...project.tracks.pads.pattern.steps];
      steps[command.step] = command.chord;
      return {
        project: setTrackPattern(project, "pads", { kind: "chords", steps }),
        label: `Pads · step ${command.step + 1}`
      };
    }

    case "setTrackMute": {
      if (!(command.trackId in TRACK_LABELS)) return { error: `Unknown track "${command.trackId}".` };
      const track = project.tracks[command.trackId];
      if (track.muted === command.muted) {
        return { project, label: `${TRACK_LABELS[command.trackId]} · mute` };
      }
      return {
        project: setTrack(project, command.trackId, { muted: command.muted }),
        label: `${TRACK_LABELS[command.trackId]} · ${command.muted ? "mute" : "unmute"}`
      };
    }

    case "setTrackLevel": {
      if (!(command.trackId in TRACK_LABELS)) return { error: `Unknown track "${command.trackId}".` };
      if (!Number.isFinite(command.level)) return { error: "Level must be a number." };
      const level = Math.min(1, Math.max(0, command.level));
      return {
        project: setTrack(project, command.trackId, { level }),
        label: `${TRACK_LABELS[command.trackId]} · level`,
        coalesceKey: `level:${command.trackId}`
      };
    }

    case "setWaveform": {
      const patch = synthPatch(project, command.trackId);
      if (!patch) return { error: `Track "${command.trackId}" has no synth patch.` };
      if (!WAVEFORMS.includes(command.waveform)) return { error: `Unknown waveform "${command.waveform}".` };
      return {
        project: setTrack(project, command.trackId, { patch: { ...patch, waveform: command.waveform } }),
        label: `${TRACK_LABELS[command.trackId]} · Waveform → ${WAVEFORM_LABELS[command.waveform]}`
      };
    }

    case "setSynthParam": {
      const patch = synthPatch(project, command.trackId);
      if (!patch) return { error: `Track "${command.trackId}" has no synth patch.` };
      if (!(command.param in PARAM_DEFS)) return { error: `Unknown parameter "${command.param}".` };
      if (!Number.isFinite(command.value)) return { error: "Parameter value must be a number." };
      return {
        project: setTrack(project, command.trackId, {
          patch: withParamValue(patch, command.param, command.value)
        }),
        label: `${TRACK_LABELS[command.trackId]} · ${PARAM_DEFS[command.param].label}`,
        coalesceKey: `param:${command.trackId}:${command.param}`
      };
    }

    case "setEnvelope": {
      // The ADSR Envelope is one control, so one drag across it is one undo
      // step even when it moves two parameters (the decay/sustain corner).
      // Values still land on the same patch.ampEnv fields every other surface
      // reads and writes — there is no second envelope model.
      const patch = synthPatch(project, command.trackId);
      if (!patch) return { error: `Track "${command.trackId}" has no synth patch.` };
      let next: SynthPatch = { ...patch, ampEnv: { ...patch.ampEnv } };
      const entries: [SynthParamId, number | undefined][] = [
        ["attack", command.env.attack],
        ["decay", command.env.decay],
        ["sustain", command.env.sustain],
        ["release", command.env.release]
      ];
      const touched: SynthParamId[] = [];
      for (const [param, value] of entries) {
        if (value === undefined) continue;
        if (!Number.isFinite(value)) return { error: `Parameter "${param}" must be a number.` };
        next = withParamValue(next, param, value);
        touched.push(param);
      }
      if (touched.length === 0) return { error: "setEnvelope needs at least one value." };
      const label =
        touched.length === 1
          ? `${TRACK_LABELS[command.trackId]} · ${PARAM_DEFS[touched[0]].label}`
          : `${TRACK_LABELS[command.trackId]} · Envelope`;
      return {
        project: setTrack(project, command.trackId, { patch: next }),
        label,
        coalesceKey: `envelope:${command.trackId}`
      };
    }

    case "setVoices": {
      if (command.trackId !== "pads" && command.trackId !== "lead") {
        return { error: "setVoices targets pads or lead." };
      }
      const patch = synthPatch(project, command.trackId);
      if (!patch) return { error: `Track "${command.trackId}" has no synth patch.` };
      if (![1, 2, 4].includes(command.voices)) return { error: "Voices must be 1, 2, or 4." };
      return {
        project: setTrack(project, command.trackId, { patch: { ...patch, voices: command.voices } }),
        label: `${TRACK_LABELS[command.trackId]} · Voices → ${command.voices === 1 ? "Mono" : command.voices}`
      };
    }

    case "applyPatch": {
      const patch = synthPatch(project, command.trackId);
      if (!patch) return { error: `Track "${command.trackId}" has no synth patch.` };
      let next: SynthPatch = { ...patch, ampEnv: { ...patch.ampEnv } };
      const partial = command.patch;
      if (partial.waveform !== undefined) {
        if (!WAVEFORMS.includes(partial.waveform)) return { error: `Unknown waveform "${partial.waveform}".` };
        next.waveform = partial.waveform;
      }
      if (partial.voices !== undefined) {
        if (![1, 2, 4].includes(partial.voices)) return { error: "Voices must be 1, 2, or 4." };
        next.voices = partial.voices;
      }
      const numeric: [SynthParamId, number | undefined][] = [
        ["cutoffHz", partial.cutoffHz],
        ["resonance", partial.resonance],
        ["filterEnvAmount", partial.filterEnvAmount],
        ["octaveOffset", partial.octaveOffset],
        ["attack", partial.ampEnv?.attack],
        ["decay", partial.ampEnv?.decay],
        ["sustain", partial.ampEnv?.sustain],
        ["release", partial.ampEnv?.release]
      ];
      for (const [param, value] of numeric) {
        if (value === undefined) continue;
        if (!Number.isFinite(value)) return { error: `Parameter "${param}" must be a number.` };
        next = withParamValue(next, param, clampParam(param, value));
      }
      return {
        project: setTrack(project, command.trackId, { patch: next }),
        label: `${TRACK_LABELS[command.trackId]} · patch`
      };
    }

    case "resetPatch": {
      const patch = synthPatch(project, command.trackId);
      if (!patch) return { error: `Track "${command.trackId}" has no synth patch.` };
      return {
        project: setTrack(project, command.trackId, { patch: defaultPatchFor(command.trackId) }),
        label: `${TRACK_LABELS[command.trackId]} · reset patch`
      };
    }

    case "resetTrackPattern": {
      if (!(command.trackId in TRACK_LABELS)) return { error: `Unknown track "${command.trackId}".` };
      const defaults = createDefaultProject();
      return {
        project: setTrackPattern(project, command.trackId, defaults.tracks[command.trackId].pattern),
        label: `${TRACK_LABELS[command.trackId]} · reset pattern`
      };
    }

    case "resetProject": {
      return { project: createDefaultProject(), label: "Reset project" };
    }

    default:
      return { error: `Unknown command.` };
  }
}

function synthPatch(project: Project, trackId: SynthTrackId): SynthPatch | null {
  return project.tracks[trackId].patch;
}

function setTrack<K extends TrackId>(
  project: Project,
  trackId: K,
  updates: Partial<Project["tracks"][K]>
): Project {
  return {
    ...project,
    tracks: { ...project.tracks, [trackId]: { ...project.tracks[trackId], ...updates } }
  };
}

function setTrackPattern<K extends TrackId>(
  project: Project,
  trackId: K,
  pattern: Project["tracks"][K]["pattern"]
): Project {
  return setTrack(project, trackId, { pattern } as Partial<Project["tracks"][K]>);
}

/** Closes an open slider-drag transaction (pointer-up / blur / idle). */
export function commitGesture(): void {
  historyCommitGesture();
}

/**
 * Runs several commands as ONE transaction (agent/lesson multi-step tools).
 * If any command fails, the whole batch rolls back and nothing is recorded.
 */
export function dispatchBatch(
  commands: SynthLabCommand[],
  origin: CommandOrigin,
  label: string
): CommandResult {
  const beforeState = projectStore.get();
  setRecordingSuppressed(true);
  try {
    for (const command of commands) {
      const result = dispatch(command, origin);
      if (!result.ok) {
        projectStore.set(beforeState);
        return result;
      }
    }
  } finally {
    setRecordingSuppressed(false);
  }
  const afterState = projectStore.get();
  const transaction = recordTransaction(beforeState.project, afterState.project, { origin, label });
  return { ok: true, state: afterState, transaction };
}
