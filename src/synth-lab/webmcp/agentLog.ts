import { PARAM_DEFS, type SynthParamId } from "@/synth-lab/engine/paramMap";
import type { Change, Transaction } from "@/synth-lab/state/history";
import { projectStore } from "@/synth-lab/state/projectStore";
import { uiStore } from "@/synth-lab/state/uiStore";
import type { AgentAction, AgentChange, TrackId } from "@/synth-lab/state/types";

/**
 * Agent activity log: every mutating tool call becomes one AgentAction entry
 * (status working → applied/error) driving the Agent Action Card and the
 * transport activity count. History owns reversibility; this is display.
 */
let actionCounter = 0;

const PARAM_SEGMENTS: Record<string, SynthParamId> = {
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

function formatLeaf(last: string, value: unknown): string {
  const param = PARAM_SEGMENTS[last];
  if (param && typeof value === "number") return PARAM_DEFS[param].format(value);
  if (last === "waveform" && typeof value === "string") return WAVEFORM_LABELS[value] ?? value;
  if (last === "voices" && typeof value === "number") return value === 1 ? "Mono" : String(value);
  if (last === "tempoBpm" && typeof value === "number") return `${value} BPM`;
  if (last === "muted") return value ? "muted" : "unmuted";
  if (value === null) return "empty";
  return String(value);
}

function labelForLeaf(last: string): string | null {
  const param = PARAM_SEGMENTS[last];
  if (param) return PARAM_DEFS[param].label;
  if (last === "waveform") return "Waveform";
  if (last === "voices") return "Voices";
  if (last === "tempoBpm") return "Tempo";
  if (last === "muted") return "Mute";
  if (last === "level") return "Level";
  return null;
}

/** Collapses a transaction's leaf changes into displayable rows. */
export function changesFromTransaction(transaction: Transaction): AgentChange[] {
  const rows: AgentChange[] = [];
  let patternEdits = 0;
  for (const change of transaction.changes) {
    const last = change.path[change.path.length - 1];
    const pathString = change.path.join(".");
    if (pathString.includes("pattern")) {
      patternEdits += 1;
      continue;
    }
    const label = typeof last === "string" ? labelForLeaf(last) : null;
    rows.push({
      path: pathString,
      label: label ?? String(last),
      before: change.before,
      after: change.after,
      formattedBefore: formatLeaf(String(last), change.before),
      formattedAfter: formatLeaf(String(last), change.after)
    });
  }
  if (patternEdits > 0) {
    rows.unshift({
      path: "pattern",
      label: "Pattern",
      before: null,
      after: null,
      formattedBefore: "",
      formattedAfter: `${patternEdits} step${patternEdits === 1 ? "" : "s"} changed`
    });
  }
  return rows;
}

export function beginAgentAction(trackId: TrackId | null, reason: string | undefined): string {
  actionCounter += 1;
  const id = `agent-${Date.now().toString(36)}-${actionCounter}`;
  const state = projectStore.get();
  const action: AgentAction = {
    id,
    timestamp: Date.now(),
    trackId,
    changes: [],
    reason,
    transactionId: "",
    status: "working"
  };
  projectStore.set({ ...state, agentActivity: [...state.agentActivity, action] });
  uiStore.setAgentStatus("working");
  uiStore.setAgentCardAction(id);
  return id;
}

export function completeAgentAction(id: string, transaction: Transaction | null, error?: string): void {
  const state = projectStore.get();
  const agentActivity = state.agentActivity.map((action): AgentAction => {
    if (action.id !== id) return action;
    if (error !== undefined) {
      return { ...action, status: "error", error };
    }
    return {
      ...action,
      status: "applied",
      transactionId: transaction?.id ?? "",
      changes: transaction ? changesFromTransaction(transaction) : []
    };
  });
  projectStore.set({ ...state, agentActivity });
  uiStore.setAgentStatus("connected");
}

/** Retrieves a transaction's before-patch values for Hear Before (plan §12). */
export function getChangeMap(transaction: Transaction): Change[] {
  return transaction.changes;
}
