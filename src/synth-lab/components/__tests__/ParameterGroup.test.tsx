/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { ParameterGroup } from "../ParameterGroup";

afterEach(cleanup);

/** Mirrors how TrackEditor drives the component: disclosure is React state. */
function Harness({ startExpanded = true }: { startExpanded?: boolean }) {
  const [expanded, setExpanded] = useState(startExpanded);
  const [moreOpen, setMoreOpen] = useState(false);
  return (
    <ParameterGroup
      title="Filter"
      chip="ESSENTIALS"
      summary={["Brightness", "Sharpness", "Sweep"]}
      expanded={expanded}
      onToggle={setExpanded}
      more={<button type="button">Sweep</button>}
      moreLabel="filter envelope amount"
      moreOpen={moreOpen}
      onToggleMore={setMoreOpen}
    >
      <button type="button">Brightness</button>
      <button type="button">Sharpness</button>
    </ParameterGroup>
  );
}

describe("ParameterGroup disclosure", () => {
  it("shows essentials expanded and secondary parameters behind More", () => {
    render(<Harness />);
    expect(screen.getByRole("button", { name: "Brightness" })).toBeTruthy();
    const more = screen.getByRole("button", { name: /\+ More/ });
    expect(more.getAttribute("aria-expanded")).toBe("false");
    expect(more.textContent).toContain("filter envelope amount");
    // Hidden, not merely off-screen.
    expect(screen.getByRole("button", { name: "Sweep", hidden: true }).closest("[hidden]")).not.toBeNull();
  });

  it("reveals the secondary tier when More is pressed", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: /\+ More/ }));
    expect(screen.getByRole("button", { name: "Sweep" }).closest("[hidden]")).toBeNull();
    expect(screen.getByRole("button", { name: "− Less" }).getAttribute("aria-expanded")).toBe("true");
  });

  it("collapses to a header that still says what it holds", async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);
    await user.click(screen.getByRole("button", { name: /Filter/ }));

    expect(screen.queryByRole("button", { name: "Brightness" })).toBeNull();
    const group = within(container).getByRole("region", { name: "Filter" });
    expect(group.textContent).toContain("3 MORE");
    expect(group.textContent).toMatch(/Brightness\s+·\s+Sharpness\s+·\s+Sweep/);
  });

  it("exposes the disclosure as a labelled, keyboard-operable control", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const toggle = screen.getByRole("button", { name: /Filter/ });
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(toggle.getAttribute("aria-controls")).toBeTruthy();

    await user.tab();
    expect(document.activeElement).toBe(toggle);
    await user.keyboard("{Enter}");
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    await user.keyboard(" ");
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
  });

  it("opens the More tier from the keyboard too", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const more = screen.getByRole("button", { name: /\+ More/ });
    more.focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("button", { name: "Sweep" }).closest("[hidden]")).toBeNull();
  });

  it("hides the More affordance while the group is collapsed", () => {
    render(<Harness startExpanded={false} />);
    expect(screen.queryByRole("button", { name: /\+ More/ })).toBeNull();
  });
});
