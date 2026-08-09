/**
 * @vitest-environment jsdom
 */
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { commitGesture, dispatch } from "@/synth-lab/state/commands";
import { createDefaultState } from "@/synth-lab/state/defaultProject";
import { resetHistory } from "@/synth-lab/state/history";
import { projectStore } from "@/synth-lab/state/projectStore";
import { uiStore, type ControlHighlight } from "@/synth-lab/state/uiStore";
import { TrackEditor } from "../TrackEditor";

function reset() {
  projectStore.set(createDefaultState());
  resetHistory();
  commitGesture();
  uiStore.setHighlight(null);
  uiStore.setAgentCardAction(null);
}

beforeEach(reset);
afterEach(cleanup);

function selectTrack(trackId: "bass" | "pads" | "drums") {
  dispatch({ type: "selectTrack", trackId });
}

/** Store writes from outside React have to be flushed like user events are. */
function highlight(next: ControlHighlight) {
  act(() => uiStore.setHighlight(next));
}

function groupNames(): string[] {
  return screen
    .getAllByRole("region")
    .map((region) => region.getAttribute("aria-label") ?? "")
    .filter((label) => !label.endsWith("editor"));
}

/** Controls a user can actually reach — collapsed groups are hidden, not off-screen. */
function reachableControlNames(): string[] {
  return screen.getAllByRole("slider").map((el) => el.getAttribute("aria-label") ?? "");
}

describe("editor structure", () => {
  it("groups the controls the way the design does", () => {
    selectTrack("bass");
    render(<TrackEditor />);
    expect(groupNames()).toEqual(["Oscillator", "Amp Envelope", "Filter"]);
  });

  it("adds the Voices group only on Pads", () => {
    selectTrack("pads");
    render(<TrackEditor />);
    expect(groupNames()).toEqual(["Oscillator", "Voices", "Amp Envelope", "Filter"]);
  });

  it("presents the envelope as one shape, and the rest as horizontal sliders", () => {
    selectTrack("bass");
    render(<TrackEditor />);
    expect(reachableControlNames()).toEqual([
      // The ADSR readout row — four values on one control, not four sliders.
      "Punch, amp envelope, attack",
      "Length, amp envelope, decay",
      "Body, amp envelope, sustain",
      "Tail, amp envelope, release",
      // Decision E2 still holds for the continuous filter parameters.
      "Brightness, filter cutoff, low-pass",
      "Sharpness, resonance"
    ]);
  });

  it("keeps secondary parameters behind each group's More", async () => {
    const user = userEvent.setup();
    selectTrack("bass");
    render(<TrackEditor />);

    expect(reachableControlNames()).not.toContain("Sweep, filter envelope, amount");
    await user.click(screen.getByRole("button", { name: /\+ More · filter envelope amount/ }));
    expect(reachableControlNames()).toContain("Sweep, filter envelope, amount");

    expect(reachableControlNames()).not.toContain("Register, oscillator, octave");
    await user.click(screen.getByRole("button", { name: /\+ More · octave/ }));
    expect(reachableControlNames()).toContain("Register, oscillator, octave");
  });

  it("shows no parameter groups on the pattern-only Drums track", () => {
    selectTrack("drums");
    render(<TrackEditor />);
    expect(groupNames()).toEqual([]);
    expect(screen.queryByRole("slider")).toBeNull();
  });
});

describe("lesson and agent targeting", () => {
  it("opens a collapsed group when a lesson points into it", async () => {
    const user = userEvent.setup();
    selectTrack("bass");
    render(<TrackEditor />);

    await user.click(screen.getByRole("button", { name: /^Filter/ }));
    expect(screen.getByRole("button", { name: /^Filter/ }).getAttribute("aria-expanded")).toBe("false");
    expect(reachableControlNames()).not.toContain("Brightness, filter cutoff, low-pass");

    highlight({ trackId: "bass", param: "cutoffHz", source: "lesson", treatment: "teach" });

    expect(screen.getByRole("button", { name: /^Filter/ }).getAttribute("aria-expanded")).toBe("true");
    expect(reachableControlNames()).toContain("Brightness, filter cutoff, low-pass");
  });

  it("opens the More tier when the target is a secondary parameter", () => {
    selectTrack("bass");
    render(<TrackEditor />);
    expect(reachableControlNames()).not.toContain("Sweep, filter envelope, amount");

    highlight({ trackId: "bass", param: "filterEnvAmount", source: "lesson", treatment: "teach" });

    expect(reachableControlNames()).toContain("Sweep, filter envelope, amount");
  });

  it("opens the Amp Envelope group for any of the four envelope parameters", async () => {
    const user = userEvent.setup();
    selectTrack("bass");
    render(<TrackEditor />);

    await user.click(screen.getByRole("button", { name: /^Amp Envelope/ }));
    expect(reachableControlNames()).not.toContain("Body, amp envelope, sustain");

    highlight({ trackId: "bass", param: "sustain", source: "lesson", treatment: "teach" });

    expect(reachableControlNames()).toContain("Body, amp envelope, sustain");
    expect(screen.getByText("THIS IS THE SHAPE")).toBeTruthy();
  });

  it("shows the collapsed group's contents by name", async () => {
    const user = userEvent.setup();
    selectTrack("bass");
    render(<TrackEditor />);
    await user.click(screen.getByRole("button", { name: /^Amp Envelope/ }));

    const group = screen.getByRole("region", { name: "Amp Envelope" });
    expect(group.textContent).toContain("4 MORE");
    expect(group.textContent).toMatch(/Punch\s+·\s+Length\s+·\s+Body\s+·\s+Tail/);
  });
});
