import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultState } from "@/synth-lab/state/defaultProject";
import { resetHistory } from "@/synth-lab/state/history";
import { projectStore } from "@/synth-lab/state/projectStore";
import { STEPS_PER_BAR, STEP_COUNT } from "@/synth-lab/state/types";

// The adapter imports the engine only for the play/audition guards; stubbing it
// keeps Tone (and a Web Audio context) out of the node test environment.
vi.mock("@/synth-lab/engine/SynthLabEngine", () => ({
  getEngineIfStarted: () => null
}));

interface FakeTool {
  name: string;
  description: string;
  execute: (input: unknown) => Promise<{ content: { type: "text"; text: string }[] }>;
}

const tools = new Map<string, FakeTool>();

async function call(name: string, input: unknown): Promise<Record<string, unknown>> {
  const tool = tools.get(name);
  if (!tool) throw new Error(`Tool ${name} was not registered`);
  const result = await tool.execute(input);
  return JSON.parse(result.content[0].text) as Record<string, unknown>;
}

beforeAll(async () => {
  (globalThis as Record<string, unknown>).document = {
    modelContext: {
      registerTool: (tool: FakeTool) => void tools.set(tool.name, tool)
    }
  };
  const { registerWebMcpTools } = await import("../registerTools");
  registerWebMcpTools();
});

beforeEach(() => {
  projectStore.set(createDefaultState());
  resetHistory();
});

describe("WebMCP tools across the two-bar loop", () => {
  it("registers the semantic tool surface", () => {
    expect(tools.has("set_pattern")).toBe(true);
    expect(tools.has("set_notes")).toBe(true);
    expect(tools.has("set_chords")).toBe(true);
    expect(tools.has("get_project_state")).toBe(true);
  });

  it("tells the agent the loop is 32 steps over two bars", () => {
    for (const name of ["set_pattern", "set_notes", "set_chords"]) {
      expect(tools.get(name)!.description).toContain("0-31");
      expect(tools.get(name)!.description).toContain("bar 2");
    }
  });

  it("returns 32-step patterns from get_project_state", async () => {
    const state = await call("get_project_state", {});
    const tracks = state.tracks as Record<string, { pattern: { steps?: unknown[]; lanes?: Record<string, unknown[]> } }>;
    expect(tracks.bass.pattern.steps).toHaveLength(STEP_COUNT);
    expect(tracks.pads.pattern.steps).toHaveLength(STEP_COUNT);
    expect(tracks.lead.pattern.steps).toHaveLength(STEP_COUNT);
    expect(tracks.drums.pattern.lanes!.kick).toHaveLength(STEP_COUNT);
  });

  it("writes drum steps in both bars as one undoable change", async () => {
    const result = await call("set_pattern", {
      steps: [
        { lane: "perc", step: 1, value: "on" },
        { lane: "perc", step: 17, value: "accent" },
        { lane: "perc", step: STEP_COUNT - 1, value: "on" }
      ],
      reason: "test"
    });
    expect(result.ok).toBe(true);
    const lanes = projectStore.get().project.tracks.drums.pattern.lanes;
    expect(lanes.perc[1]).toBe("on");
    expect(lanes.perc[17]).toBe("accent");
    expect(lanes.perc[STEP_COUNT - 1]).toBe("on");
  });

  it("writes notes at every step of the loop", async () => {
    const notes = Array.from({ length: STEP_COUNT }, (_, step) => ({ step, row: step % 8 }));
    const result = await call("set_notes", { track: "lead", notes });
    expect(result.ok).toBe(true);
    const steps = projectStore.get().project.tracks.lead.pattern.steps;
    expect(steps).toHaveLength(STEP_COUNT);
    steps.forEach((row, step) => expect(row).toBe(step % 8));
  });

  it("writes chords into bar 2", async () => {
    const result = await call("set_chords", {
      chords: [
        { step: STEPS_PER_BAR, chord: "Fm" },
        { step: 28, chord: "Cm" }
      ]
    });
    expect(result.ok).toBe(true);
    const steps = projectStore.get().project.tracks.pads.pattern.steps;
    expect(steps[STEPS_PER_BAR]).toBe("Fm");
    expect(steps[28]).toBe("Cm");
  });

  it("rejects steps past the end of the loop and changes nothing", async () => {
    const before = projectStore.get().project;
    const result = await call("set_notes", { track: "bass", notes: [{ step: STEP_COUNT, row: 0 }] });
    expect(result.ok).toBe(false);
    expect(projectStore.get().project).toBe(before);
  });

  it("undoes a bar 2 agent edit through the shared stack", async () => {
    const original = projectStore.get().project.tracks.bass.pattern.steps[26];
    await call("set_notes", { track: "bass", notes: [{ step: 26, row: 7 }] });
    expect(projectStore.get().project.tracks.bass.pattern.steps[26]).toBe(7);

    const undone = await call("undo_last_change", {});
    expect(undone.ok).toBe(true);
    expect(projectStore.get().project.tracks.bass.pattern.steps[26]).toBe(original);
  });

  it("reset_track restores the two-bar default pattern", async () => {
    await call("set_notes", { track: "lead", notes: [{ step: 20, row: 0 }] });
    const result = await call("reset_track", { track: "lead", scope: "pattern" });
    expect(result.ok).toBe(true);
    const steps = projectStore.get().project.tracks.lead.pattern.steps;
    expect(steps).toHaveLength(STEP_COUNT);
    expect(steps).toEqual(createDefaultState().project.tracks.lead.pattern.steps);
  });

  it("reports the 96 BPM starter tempo and accepts tempo changes", async () => {
    const state = await call("get_project_state", {});
    expect(state.tempoBpm).toBe(96);
    const result = await call("set_tempo", { bpm: 120 });
    expect(result.ok).toBe(true);
    expect(projectStore.get().project.tempoBpm).toBe(120);
  });
});
