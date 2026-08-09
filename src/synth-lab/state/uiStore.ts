import { useSyncExternalStore } from "react";
import type { SynthParamId } from "@/synth-lab/engine/paramMap";
import { BAR_COUNT, type BarIndex, type SynthTrackId } from "./types";

/**
 * Ephemeral UI state that is deliberately outside projectStore: the
 * lesson/agent control highlight and the transient undo restoration receipt.
 * Never persisted, never in history.
 */
export interface ControlHighlight {
  trackId: SynthTrackId;
  param: SynthParamId | "waveform" | "voices";
  /** Who is pointing — drives the Concept Highlight's accent. */
  source: "lesson" | "agent";
  /**
   * The control treatment. Pointing at a control (lesson step, or an agent's
   * `focus_control`) is the Highlighted state; the magenta "Agent changed"
   * state is reserved for parameters an agent actually modified.
   */
  treatment: "teach" | "agentChanged";
  /** Optional Concept Highlight popover copy (title + body). */
  concept?: { title: string; body: string } | null;
}

export interface RestorationReceipt {
  id: number;
  /** e.g. "Brightness is back to 4.8 kHz" */
  message: string;
  /** Origin note, e.g. "the agent change was reversed" */
  detail: string | null;
}

export type AgentStatus = "absent" | "connected" | "working";

interface UiState {
  highlight: ControlHighlight | null;
  receipt: RestorationReceipt | null;
  /** WebMCP adapter lifecycle (Figma 09 agent chips). */
  agentStatus: AgentStatus;
  /** Agent action currently shown as an anchored card (dismissable). */
  agentCardActionId: string | null;
  /** present_coach_message writes into the Lesson Card body, never a second surface. */
  coachMessage: { message: string } | null;
  /**
   * Which bar of the two-bar loop the editor is showing. One value for the
   * whole workspace — every track pages together, like a groovebox. This is a
   * viewing choice only: it never touches project state, history or playback,
   * and playback never changes it (the playing bar is indicated instead, so a
   * user editing bar 2 is not yanked back to bar 1 mid-edit).
   */
  visibleBar: BarIndex;
}

let state: UiState = {
  highlight: null,
  receipt: null,
  agentStatus: "absent",
  agentCardActionId: null,
  coachMessage: null,
  visibleBar: 0
};
const SERVER_STATE: UiState = { ...state };
const listeners = new Set<() => void>();
let receiptCounter = 0;
let receiptTimer: ReturnType<typeof setTimeout> | null = null;

function setState(next: UiState): void {
  state = next;
  listeners.forEach((listener) => listener());
}

export const uiStore = {
  get: (): UiState => state,
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  setHighlight(highlight: ControlHighlight | null): void {
    setState({ ...state, highlight });
  },
  /** Shows the transient undo receipt (auto-dismisses; Redo lives on it). */
  showReceipt(message: string, detail: string | null): void {
    receiptCounter += 1;
    if (receiptTimer) clearTimeout(receiptTimer);
    setState({ ...state, receipt: { id: receiptCounter, message, detail } });
    receiptTimer = setTimeout(() => {
      receiptTimer = null;
      setState({ ...state, receipt: null });
    }, 6000);
  },
  dismissReceipt(): void {
    if (receiptTimer) clearTimeout(receiptTimer);
    receiptTimer = null;
    setState({ ...state, receipt: null });
  },
  setAgentStatus(agentStatus: AgentStatus): void {
    if (state.agentStatus === agentStatus) return;
    setState({ ...state, agentStatus });
  },
  setAgentCardAction(agentCardActionId: string | null): void {
    setState({ ...state, agentCardActionId });
  },
  setCoachMessage(coachMessage: { message: string } | null): void {
    setState({ ...state, coachMessage });
  },
  setVisibleBar(visibleBar: BarIndex): void {
    if (!Number.isInteger(visibleBar) || visibleBar < 0 || visibleBar >= BAR_COUNT) return;
    if (state.visibleBar === visibleBar) return;
    setState({ ...state, visibleBar });
  }
};

export function useVisibleBar(): BarIndex {
  return useUiState((s) => s.visibleBar);
}

export function useUiState<T>(selector: (s: UiState) => T): T {
  return useSyncExternalStore(
    uiStore.subscribe,
    () => selector(state),
    () => selector(SERVER_STATE)
  );
}
