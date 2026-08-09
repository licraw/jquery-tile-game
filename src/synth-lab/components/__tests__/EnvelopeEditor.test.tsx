/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PARAM_DEFS } from "@/synth-lab/engine/paramMap";
import { commitGesture, dispatch, dispatchBatch } from "@/synth-lab/state/commands";
import { createDefaultState } from "@/synth-lab/state/defaultProject";
import { getUndoStack, resetHistory } from "@/synth-lab/state/history";
import { loadPersistedState, persistNow } from "@/synth-lab/state/persistence";
import { projectStore } from "@/synth-lab/state/projectStore";
import { uiStore } from "@/synth-lab/state/uiStore";
import { EnvelopeEditor } from "../EnvelopeEditor";

function reset() {
  projectStore.set(createDefaultState());
  resetHistory();
  commitGesture();
  uiStore.setHighlight(null);
  uiStore.setAgentCardAction(null);
}

beforeEach(reset);
afterEach(cleanup);

function bassEnv() {
  return projectStore.get().project.tracks.bass.patch!.ampEnv;
}

function readout(name: RegExp) {
  return screen.getByRole("slider", { name });
}

describe("ADSR readouts as the accessible surface", () => {
  it("exposes name, value, units and range for all four parameters", () => {
    render(<EnvelopeEditor trackId="bass" />);
    const sliders = screen.getAllByRole("slider");
    expect(sliders).toHaveLength(4);

    const attack = readout(/^Punch/);
    expect(attack.getAttribute("aria-label")).toBe("Punch, amp envelope, attack");
    expect(attack.getAttribute("aria-valuenow")).toBe(String(bassEnv().attack));
    expect(attack.getAttribute("aria-valuemin")).toBe(String(PARAM_DEFS.attack.min));
    expect(attack.getAttribute("aria-valuemax")).toBe(String(PARAM_DEFS.attack.max));
    expect(attack.getAttribute("aria-valuetext")).toBe(PARAM_DEFS.attack.formatSpoken(bassEnv().attack));

    // Both labels stay on screen (decision D3), never hover-to-reveal.
    expect(attack.textContent).toContain("PUNCH");
    expect(attack.textContent).toContain("ATTACK");
    expect(attack.textContent).toContain(PARAM_DEFS.attack.format(bassEnv().attack));
    expect(readout(/^Body/).textContent).toContain("SUSTAIN");
    expect(readout(/^Tail/).textContent).toContain("RELEASE");
    expect(readout(/^Length/).textContent).toContain("DECAY");
  });

  it("keeps every readout in the tab order", async () => {
    const user = userEvent.setup();
    render(<EnvelopeEditor trackId="bass" />);
    for (const name of [/^Punch/, /^Length/, /^Body/, /^Tail/]) {
      await user.tab();
      expect(document.activeElement).toBe(readout(name));
    }
  });

  it("hides the graph from assistive tech — it mirrors the readouts", () => {
    const { container } = render(<EnvelopeEditor trackId="bass" />);
    expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    for (const handle of container.querySelectorAll("[data-handle]")) {
      expect(handle.getAttribute("aria-hidden")).toBe("true");
    }
  });
});

describe("keyboard manipulation reaches project state", () => {
  it("adjusts Attack with arrows, Shift+arrows and Home/End", async () => {
    const user = userEvent.setup();
    render(<EnvelopeEditor trackId="bass" />);
    readout(/^Punch/).focus();

    const start = bassEnv().attack;
    await user.keyboard("{ArrowRight}");
    const stepped = bassEnv().attack;
    expect(stepped).toBeGreaterThan(start);

    await user.keyboard("{Shift>}{ArrowRight}{/Shift}");
    // The large step moves further than the small one — the existing stepping
    // behaviour, unchanged.
    expect(bassEnv().attack - stepped).toBeGreaterThan(stepped - start);

    await user.keyboard("{Home}");
    expect(bassEnv().attack).toBe(PARAM_DEFS.attack.min);
    await user.keyboard("{End}");
    expect(bassEnv().attack).toBe(PARAM_DEFS.attack.max);
    await user.keyboard("{ArrowLeft}");
    expect(bassEnv().attack).toBeLessThan(PARAM_DEFS.attack.max);
  });

  it("adjusts Decay", async () => {
    const user = userEvent.setup();
    render(<EnvelopeEditor trackId="bass" />);
    readout(/^Length/).focus();
    const before = bassEnv().decay;
    await user.keyboard("{ArrowUp}");
    expect(bassEnv().decay).toBeGreaterThan(before);
    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(bassEnv().decay).toBeLessThan(before);
  });

  it("adjusts Sustain", async () => {
    const user = userEvent.setup();
    render(<EnvelopeEditor trackId="bass" />);
    readout(/^Body/).focus();
    await user.keyboard("{Home}");
    expect(bassEnv().sustain).toBe(0);
    await user.keyboard("{ArrowRight}");
    expect(bassEnv().sustain).toBeCloseTo(PARAM_DEFS.sustain.step, 5);
  });

  it("adjusts Release", async () => {
    const user = userEvent.setup();
    render(<EnvelopeEditor trackId="bass" />);
    readout(/^Tail/).focus();
    const before = bassEnv().release;
    await user.keyboard("{ArrowRight}{ArrowRight}");
    expect(bassEnv().release).toBeGreaterThan(before);
    expect(readout(/^Tail/).getAttribute("aria-valuetext")).toBe(
      PARAM_DEFS.release.formatSpoken(bassEnv().release)
    );
  });

  it("redraws the shape from the new values", async () => {
    const user = userEvent.setup();
    const { container } = render(<EnvelopeEditor trackId="bass" />);
    const before = container.querySelector("polyline")!.getAttribute("points");
    readout(/^Body/).focus();
    await user.keyboard("{End}");
    expect(container.querySelector("polyline")!.getAttribute("points")).not.toBe(before);
  });
});

describe("history, lessons, agents and persistence keep working on the same values", () => {
  it("undoes an envelope change", async () => {
    const user = userEvent.setup();
    render(<EnvelopeEditor trackId="bass" />);
    const before = bassEnv().decay;
    readout(/^Length/).focus();
    await user.keyboard("{End}");
    expect(bassEnv().decay).toBe(PARAM_DEFS.decay.max);

    dispatch({ type: "undo" });
    expect(bassEnv().decay).toBe(before);
  });

  it("undoes a whole envelope drag as one step, even across two parameters", () => {
    const before = { ...bassEnv() };
    // What a pointer drag on the decay/sustain corner emits.
    dispatch({ type: "setEnvelope", trackId: "bass", env: { decay: 0.3, sustain: 0.5 } });
    dispatch({ type: "setEnvelope", trackId: "bass", env: { decay: 0.25, sustain: 0.35 } });
    dispatch({ type: "setEnvelope", trackId: "bass", env: { decay: 0.2, sustain: 0.2 } });
    commitGesture();

    expect(getUndoStack()).toHaveLength(1);
    expect(bassEnv().decay).toBeCloseTo(0.2, 5);
    expect(bassEnv().sustain).toBeCloseTo(0.2, 5);

    dispatch({ type: "undo" });
    expect(bassEnv().decay).toBe(before.decay);
    expect(bassEnv().sustain).toBe(before.sustain);
  });

  it("shows an agent's multi-parameter change as one shape, one ghost and one undo", () => {
    const before = { ...bassEnv() };
    const result = dispatchBatch(
      [
        { type: "setSynthParam", trackId: "bass", param: "attack", value: 0.002 },
        { type: "setSynthParam", trackId: "bass", param: "decay", value: 0.12 },
        { type: "setSynthParam", trackId: "bass", param: "sustain", value: 0.1 }
      ],
      "agent",
      "Bass · patch"
    );
    expect(result.ok).toBe(true);
    const transaction = result.ok ? result.transaction! : null;

    projectStore.set({
      ...projectStore.get(),
      agentActivity: [
        {
          id: "action-1",
          timestamp: Date.now(),
          trackId: "bass",
          changes: [],
          transactionId: transaction!.id,
          status: "applied"
        }
      ]
    });
    uiStore.setAgentCardAction("action-1");

    const { container } = render(<EnvelopeEditor trackId="bass" highlight="agent" />);
    // Ghost curve = the envelope before the agent touched it.
    const polylines = container.querySelectorAll("polyline");
    expect(polylines).toHaveLength(2);
    expect(screen.getByText(/CHANGED BY AGENT/)).toBeTruthy();

    // Every readout shows the agent's new value.
    expect(readout(/^Punch/).getAttribute("aria-valuenow")).toBe("0.002");
    expect(readout(/^Body/).getAttribute("aria-valuenow")).toBe("0.1");

    dispatch({ type: "undo" });
    expect(getUndoStack()).toHaveLength(0);
    expect(bassEnv()).toEqual(before);
  });

  it("completes the 'make it pluck' validator from envelope edits alone", async () => {
    const { attachLessonEngine, startChallenge } = await import("@/synth-lab/lessons/lessonEngine");
    const detach = attachLessonEngine();
    try {
      startChallenge("challenge-2");
      render(<EnvelopeEditor trackId="bass" />);

      readout(/^Punch/).focus();
      dispatch({ type: "setSynthParam", trackId: "bass", param: "attack", value: 0.005 });
      dispatch({ type: "setSynthParam", trackId: "bass", param: "decay", value: 0.14 });
      dispatch({ type: "setSynthParam", trackId: "bass", param: "sustain", value: 0.2 });

      expect(projectStore.get().lessons.completed).toContain("challenge-2");
      expect(projectStore.get().lessons.concepts.envelopes).toBe(true);
    } finally {
      detach();
    }
  });

  it("persists envelope values through a save/load round trip", async () => {
    const user = userEvent.setup();
    render(<EnvelopeEditor trackId="bass" />);
    readout(/^Tail/).focus();
    await user.keyboard("{End}");
    const saved = bassEnv();

    persistNow(projectStore.get());
    const restored = loadPersistedState(createDefaultState());
    expect(restored.project.tracks.bass.patch?.ampEnv).toEqual(saved);
  });
});
