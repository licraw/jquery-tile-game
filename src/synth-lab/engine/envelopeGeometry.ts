import { normToValue, valueToNorm } from "./paramMap";
import type { AmpEnvelope } from "@/synth-lab/state/types";

/**
 * ADSR Envelope geometry (Figma 39:84).
 *
 * The handoff note on that component is explicit: in Figma the plot is drawn
 * once per variant, and "in code the polyline must be derived from the four
 * values, and the handles must be the thing that sets them". This module is
 * that derivation, kept pure so it can be unit-tested without a DOM and so the
 * component holds no envelope state of its own — the project store stays the
 * only ADSR model.
 *
 * Plot space is normalised 0–100 in both axes; y is inverted (0 = full
 * amplitude at the top, 100 = silence at the bottom) so it maps straight onto
 * SVG coordinates. Time is laid out as four fixed budgets rather than real
 * seconds: a 4-second release would otherwise squash attack into invisibility.
 * Each time budget is filled by the parameter's *normalised* position, so the
 * graph and the parameter's slider mapping (logarithmic for A/D/R) agree.
 */
export const PLOT_WIDTH = 100;
export const PLOT_HEIGHT = 100;

/** Horizontal budget per stage. Sustain is a fixed hold — it has no duration. */
export const ATTACK_SPAN = 25;
export const DECAY_SPAN = 25;
export const SUSTAIN_SPAN = 25;
export const RELEASE_SPAN = 25;

export interface Point {
  x: number;
  y: number;
}

export interface EnvelopeShape {
  /** Note on, silent. */
  start: Point;
  /** End of attack, full amplitude. */
  peak: Point;
  /** End of decay — the sustain level is reached here. */
  corner: Point;
  /** End of the sustain hold, where release begins. */
  sustainEnd: Point;
  /** End of release, back to silence. */
  end: Point;
  /** `points` attribute for the SVG polyline. */
  polyline: string;
  /** Closed path for the tinted area under the curve. */
  area: string;
  /** Mid-point x of each stage, for the A / D / S / R captions. */
  labels: { attack: number; decay: number; sustain: number; release: number };
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function round(value: number): number {
  // Three decimals is far below a pixel at any width we render, and keeps the
  // serialised SVG identical between server and client render.
  return Math.round(value * 1000) / 1000;
}

export function envelopeShape(env: AmpEnvelope): EnvelopeShape {
  const attackX = round(ATTACK_SPAN * valueToNorm("attack", env.attack));
  const decayX = round(attackX + DECAY_SPAN * valueToNorm("decay", env.decay));
  const sustainEndX = round(decayX + SUSTAIN_SPAN);
  const releaseX = round(sustainEndX + RELEASE_SPAN * valueToNorm("release", env.release));
  const sustainY = round(PLOT_HEIGHT * (1 - clamp01(env.sustain)));

  const start: Point = { x: 0, y: PLOT_HEIGHT };
  const peak: Point = { x: attackX, y: 0 };
  const corner: Point = { x: decayX, y: sustainY };
  const sustainEnd: Point = { x: sustainEndX, y: sustainY };
  const end: Point = { x: releaseX, y: PLOT_HEIGHT };

  const points = [start, peak, corner, sustainEnd, end];
  const polyline = points.map((p) => `${p.x},${p.y}`).join(" ");
  // The curve already starts and ends on the baseline, so closing it is all
  // the tinted area needs.
  const area = `M ${points.map((p) => `${p.x} ${p.y}`).join(" L ")} Z`;

  return {
    start,
    peak,
    corner,
    sustainEnd,
    end,
    polyline,
    area,
    labels: {
      attack: round(attackX / 2),
      decay: round((attackX + decayX) / 2),
      sustain: round((decayX + sustainEndX) / 2),
      release: round((sustainEndX + releaseX) / 2)
    }
  };
}

/** The three draggable handles, in the order the design names them. */
export type EnvelopeHandleId = "attack" | "decaySustain" | "release";

export function handlePosition(shape: EnvelopeShape, handle: EnvelopeHandleId): Point {
  if (handle === "attack") return shape.peak;
  if (handle === "decaySustain") return shape.corner;
  return shape.end;
}

export interface EnvelopeDragResult {
  attack?: number;
  decay?: number;
  sustain?: number;
  release?: number;
}

/**
 * Inverse of {@link envelopeShape}: a pointer position in plot space becomes
 * the parameter values that handle controls. The attack handle is horizontal
 * only, the release handle is horizontal only, and the decay/sustain corner
 * moves in both axes — which is exactly the pairing the graph teaches.
 */
export function dragToValues(
  handle: EnvelopeHandleId,
  point: Point,
  env: AmpEnvelope
): EnvelopeDragResult {
  switch (handle) {
    case "attack":
      return { attack: normToValue("attack", clamp01(point.x / ATTACK_SPAN)) };
    case "decaySustain": {
      const attackX = ATTACK_SPAN * valueToNorm("attack", env.attack);
      return {
        decay: normToValue("decay", clamp01((point.x - attackX) / DECAY_SPAN)),
        sustain: clamp01(1 - point.y / PLOT_HEIGHT)
      };
    }
    case "release": {
      const attackX = ATTACK_SPAN * valueToNorm("attack", env.attack);
      const sustainEndX = attackX + DECAY_SPAN * valueToNorm("decay", env.decay) + SUSTAIN_SPAN;
      return { release: normToValue("release", clamp01((point.x - sustainEndX) / RELEASE_SPAN)) };
    }
  }
}
