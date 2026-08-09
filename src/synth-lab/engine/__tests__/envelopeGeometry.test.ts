import { describe, expect, it } from "vitest";
import {
  ATTACK_SPAN,
  DECAY_SPAN,
  PLOT_HEIGHT,
  RELEASE_SPAN,
  SUSTAIN_SPAN,
  dragToValues,
  envelopeShape,
  handlePosition
} from "../envelopeGeometry";
import { PARAM_DEFS } from "../paramMap";
import type { AmpEnvelope } from "@/synth-lab/state/types";

const ENV: AmpEnvelope = { attack: 0.005, decay: 0.14, sustain: 0.2, release: 0.18 };

describe("envelope shape derivation", () => {
  it("draws a five-point ADSR outline from the four values", () => {
    const shape = envelopeShape(ENV);
    expect(shape.start).toEqual({ x: 0, y: PLOT_HEIGHT });
    expect(shape.peak.y).toBe(0);
    expect(shape.end.y).toBe(PLOT_HEIGHT);
    // Monotonic left to right: attack, then decay, then the sustain hold,
    // then release.
    expect(shape.peak.x).toBeGreaterThan(shape.start.x);
    expect(shape.corner.x).toBeGreaterThan(shape.peak.x);
    expect(shape.sustainEnd.x).toBeCloseTo(shape.corner.x + SUSTAIN_SPAN, 3);
    expect(shape.end.x).toBeGreaterThan(shape.sustainEnd.x);
    expect(shape.polyline.split(" ")).toHaveLength(5);
  });

  it("puts the sustain plateau at the sustain level", () => {
    const shape = envelopeShape({ ...ENV, sustain: 0.25 });
    expect(shape.corner.y).toBeCloseTo(75, 3);
    expect(shape.sustainEnd.y).toBe(shape.corner.y);

    const full = envelopeShape({ ...ENV, sustain: 1 });
    expect(full.corner.y).toBe(0);
    const silent = envelopeShape({ ...ENV, sustain: 0 });
    expect(silent.corner.y).toBe(PLOT_HEIGHT);
  });

  it("keeps the whole shape inside the plot at maximum values", () => {
    const shape = envelopeShape({
      attack: PARAM_DEFS.attack.max,
      decay: PARAM_DEFS.decay.max,
      sustain: 1,
      release: PARAM_DEFS.release.max
    });
    expect(shape.end.x).toBeCloseTo(ATTACK_SPAN + DECAY_SPAN + SUSTAIN_SPAN + RELEASE_SPAN, 3);
    expect(shape.end.x).toBeLessThanOrEqual(100);
  });

  it("shows a longer attack as a later peak", () => {
    const fast = envelopeShape({ ...ENV, attack: 0.001 });
    const slow = envelopeShape({ ...ENV, attack: 1 });
    expect(slow.peak.x).toBeGreaterThan(fast.peak.x);
  });
});

describe("direct manipulation", () => {
  it("round-trips each handle: drag to a position, read the value back", () => {
    const shape = envelopeShape(ENV);

    const attackPoint = { x: ATTACK_SPAN * 0.5, y: 0 };
    const attack = dragToValues("attack", attackPoint, ENV).attack!;
    expect(envelopeShape({ ...ENV, attack }).peak.x).toBeCloseTo(attackPoint.x, 2);

    const cornerPoint = { x: shape.peak.x + DECAY_SPAN * 0.5, y: 40 };
    const corner = dragToValues("decaySustain", cornerPoint, ENV);
    expect(corner.sustain).toBeCloseTo(0.6, 5);
    const afterCorner = envelopeShape({ ...ENV, decay: corner.decay!, sustain: corner.sustain! });
    expect(afterCorner.corner.x).toBeCloseTo(cornerPoint.x, 2);
    expect(afterCorner.corner.y).toBeCloseTo(cornerPoint.y, 2);

    const releasePoint = { x: shape.sustainEnd.x + RELEASE_SPAN * 0.5, y: PLOT_HEIGHT };
    const release = dragToValues("release", releasePoint, ENV).release!;
    expect(envelopeShape({ ...ENV, release }).end.x).toBeCloseTo(releasePoint.x, 2);
  });

  it("moves only its own parameters per handle", () => {
    expect(Object.keys(dragToValues("attack", { x: 5, y: 0 }, ENV))).toEqual(["attack"]);
    expect(Object.keys(dragToValues("release", { x: 90, y: 100 }, ENV))).toEqual(["release"]);
    // The corner is the one handle that teaches a pairing.
    expect(Object.keys(dragToValues("decaySustain", { x: 30, y: 50 }, ENV)).sort()).toEqual([
      "decay",
      "sustain"
    ]);
  });

  it("clamps drags outside the plot to the parameter range", () => {
    expect(dragToValues("attack", { x: -50, y: 0 }, ENV).attack).toBe(PARAM_DEFS.attack.min);
    expect(dragToValues("attack", { x: 500, y: 0 }, ENV).attack).toBe(PARAM_DEFS.attack.max);
    const corner = dragToValues("decaySustain", { x: 0, y: -40 }, ENV);
    expect(corner.sustain).toBe(1);
    expect(corner.decay).toBe(PARAM_DEFS.decay.min);
    expect(dragToValues("decaySustain", { x: 0, y: 900 }, ENV).sustain).toBe(0);
  });

  it("reports handle positions that match the drawn shape", () => {
    const shape = envelopeShape(ENV);
    expect(handlePosition(shape, "attack")).toEqual(shape.peak);
    expect(handlePosition(shape, "decaySustain")).toEqual(shape.corner);
    expect(handlePosition(shape, "release")).toEqual(shape.end);
  });
});
