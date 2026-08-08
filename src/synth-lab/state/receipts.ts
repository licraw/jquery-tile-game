import { PARAM_DEFS, type SynthParamId } from "@/synth-lab/engine/paramMap";
import type { Change, Transaction } from "./history";

/**
 * Turns an undone transaction into the restoration receipt copy the design
 * specifies: it names what was restored and the value it went back to
 * ("Brightness is back to 4.8 kHz"), with an origin note for agent changes.
 */
const PATCH_PARAM_SEGMENTS: Record<string, SynthParamId> = {
  cutoffHz: "cutoffHz",
  resonance: "resonance",
  attack: "attack",
  decay: "decay",
  sustain: "sustain",
  release: "release",
  filterEnvAmount: "filterEnvAmount",
  octaveOffset: "octaveOffset"
};

const WAVEFORM_LABELS: Record<string, string> = {
  sine: "Sine",
  triangle: "Triangle",
  sawtooth: "Saw",
  square: "Square"
};

function describeChange(change: Change): string | null {
  const last = change.path[change.path.length - 1];
  if (typeof last !== "string") return null;
  const param = PATCH_PARAM_SEGMENTS[last];
  if (param && typeof change.before === "number") {
    const def = PARAM_DEFS[param];
    return `${def.label} is back to ${def.format(change.before)}`;
  }
  if (last === "waveform" && typeof change.before === "string") {
    return `Waveform is back to ${WAVEFORM_LABELS[change.before] ?? change.before}`;
  }
  if (last === "voices" && typeof change.before === "number") {
    return `Voices is back to ${change.before === 1 ? "Mono" : change.before}`;
  }
  if (last === "tempoBpm" && typeof change.before === "number") {
    return `Tempo is back to ${change.before} BPM`;
  }
  if (last === "muted") {
    return change.before === true ? "Track is muted again" : "Track is unmuted again";
  }
  return null;
}

export function receiptForUndo(transaction: Transaction): { message: string; detail: string | null } {
  const detail =
    transaction.origin === "agent"
      ? "the agent change was reversed"
      : transaction.origin === "lesson"
        ? "the lesson change was reversed"
        : null;

  if (transaction.changes.length === 1) {
    const described = describeChange(transaction.changes[0]);
    if (described) return { message: described, detail };
  }
  // Multi-change transactions (patterns, patches, resets) fall back to the
  // transaction label, still naming what was restored.
  const described = transaction.changes.length <= 4 ? describeChange(transaction.changes[0]) : null;
  if (described && transaction.changes.length === 1) return { message: described, detail };
  return { message: `${transaction.label} — restored`, detail };
}

export function receiptForRedo(transaction: Transaction): { message: string; detail: string | null } {
  return { message: `${transaction.label} — reapplied`, detail: null };
}
