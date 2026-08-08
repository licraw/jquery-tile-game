import type { SynthPatch } from "@/synth-lab/state/types";

/**
 * Parameter registry (implementation plan §8) — the single source of ranges,
 * curves, and display formatting. The UI and command layer never invent
 * ranges; the engine maps these fields onto Tone nodes.
 */
export type SynthParamId =
  | "cutoffHz"
  | "resonance"
  | "attack"
  | "decay"
  | "sustain"
  | "release"
  | "filterEnvAmount"
  | "octaveOffset";

export type ParamCurve = "log" | "linear" | "discrete";

export interface ParamDef {
  id: SynthParamId;
  /** Perceptual label (Figma slider header). */
  label: string;
  /** Permanent technical label (Figma slider footer). */
  technical: string;
  min: number;
  max: number;
  curve: ParamCurve;
  /** Discrete step for keyboard/arrow input, in value units. */
  step: number;
  /** Larger Shift+arrow step, in value units. */
  largeStep: number;
  format: (value: number) => string;
  /** Spoken form for aria-valuetext, e.g. "4.8 kilohertz". */
  formatSpoken: (value: number) => string;
  /** Shown in the collapsed "+ More" summary line and used for grouping. */
  group: "essential" | "more";
}

function formatHz(value: number): string {
  return value >= 1000 ? `${(value / 1000).toFixed(1)} kHz` : `${Math.round(value)} Hz`;
}

function spokenHz(value: number): string {
  return value >= 1000 ? `${(value / 1000).toFixed(1)} kilohertz` : `${Math.round(value)} hertz`;
}

function formatSeconds(value: number): string {
  return value < 1 ? `${Math.round(value * 1000)} ms` : `${value.toFixed(1)} s`;
}

function spokenSeconds(value: number): string {
  return value < 1 ? `${Math.round(value * 1000)} milliseconds` : `${value.toFixed(1)} seconds`;
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function spokenPercent(value: number): string {
  return `${Math.round(value * 100)} percent`;
}

function formatOctave(value: number): string {
  if (value > 0) return `+${value} oct`;
  if (value < 0) return `−${Math.abs(value)} oct`;
  return "0 oct";
}

export const PARAM_DEFS: Record<SynthParamId, ParamDef> = {
  cutoffHz: {
    id: "cutoffHz",
    label: "Brightness",
    technical: "FILTER CUTOFF  ·  LOW-PASS",
    min: 100,
    max: 8000,
    curve: "log",
    step: 0, // log params step in normalized space; see stepParam()
    largeStep: 0,
    format: formatHz,
    formatSpoken: spokenHz,
    group: "essential"
  },
  resonance: {
    id: "resonance",
    label: "Sharpness",
    technical: "RESONANCE",
    min: 0,
    max: 1,
    curve: "linear",
    step: 0.01,
    largeStep: 0.1,
    format: formatPercent,
    formatSpoken: spokenPercent,
    group: "essential"
  },
  attack: {
    id: "attack",
    label: "Punch",
    technical: "AMP ENVELOPE  ·  ATTACK",
    min: 0.001,
    max: 2,
    curve: "log",
    step: 0,
    largeStep: 0,
    format: formatSeconds,
    formatSpoken: spokenSeconds,
    group: "essential"
  },
  decay: {
    id: "decay",
    label: "Length",
    technical: "AMP ENVELOPE  ·  DECAY",
    min: 0.01,
    max: 2,
    curve: "log",
    step: 0,
    largeStep: 0,
    format: formatSeconds,
    formatSpoken: spokenSeconds,
    group: "essential"
  },
  sustain: {
    id: "sustain",
    label: "Body",
    technical: "AMP ENVELOPE  ·  SUSTAIN",
    min: 0,
    max: 1,
    curve: "linear",
    step: 0.01,
    largeStep: 0.1,
    format: formatPercent,
    formatSpoken: spokenPercent,
    group: "more"
  },
  release: {
    id: "release",
    label: "Tail",
    technical: "AMP ENVELOPE  ·  RELEASE",
    min: 0.01,
    max: 4,
    curve: "log",
    step: 0,
    largeStep: 0,
    format: formatSeconds,
    formatSpoken: spokenSeconds,
    group: "more"
  },
  filterEnvAmount: {
    id: "filterEnvAmount",
    label: "Sweep",
    technical: "FILTER ENVELOPE  ·  AMOUNT",
    min: 0,
    max: 4,
    curve: "linear",
    step: 0.04,
    largeStep: 0.4,
    // Figma product frames display Sweep as a percentage of the full range.
    format: (value) => `${Math.round((value / 4) * 100)}%`,
    formatSpoken: (value) => `${Math.round((value / 4) * 100)} percent`,
    group: "more"
  },
  octaveOffset: {
    id: "octaveOffset",
    label: "Register",
    technical: "OSCILLATOR  ·  OCTAVE",
    min: -1,
    max: 1,
    curve: "discrete",
    step: 1,
    largeStep: 1,
    format: formatOctave,
    formatSpoken: (value) => (value === 0 ? "0 octaves" : `${value > 0 ? "up" : "down"} ${Math.abs(value)} octave`),
    group: "more"
  }
};

export const ESSENTIAL_PARAM_IDS: SynthParamId[] = ["cutoffHz", "resonance", "attack", "decay"];
export const MORE_PARAM_IDS: SynthParamId[] = ["sustain", "release", "filterEnvAmount", "octaveOffset"];

/** Normalized slider position (0–1) → parameter value. */
export function normToValue(id: SynthParamId, norm: number): number {
  const def = PARAM_DEFS[id];
  const t = Math.min(1, Math.max(0, norm));
  if (t === 0) return def.min;
  if (t === 1) return def.max;
  let value: number;
  if (def.curve === "log") {
    value = def.min * Math.exp(t * Math.log(def.max / def.min));
  } else {
    value = def.min + t * (def.max - def.min);
  }
  if (def.curve === "discrete") {
    value = Math.round(value);
  }
  return value;
}

/** Parameter value → normalized slider position (0–1). */
export function valueToNorm(id: SynthParamId, value: number): number {
  const def = PARAM_DEFS[id];
  const v = clampParam(id, value);
  if (def.curve === "log") {
    return Math.log(v / def.min) / Math.log(def.max / def.min);
  }
  return (v - def.min) / (def.max - def.min);
}

export function clampParam(id: SynthParamId, value: number): number {
  const def = PARAM_DEFS[id];
  let v = Math.min(def.max, Math.max(def.min, value));
  if (def.curve === "discrete") {
    v = Math.round(v);
  }
  return v;
}

/**
 * Keyboard step: arrows move log params by 1% of the normalized range
 * (10% with Shift); linear/discrete params use their declared value steps.
 */
export function stepParam(id: SynthParamId, value: number, direction: 1 | -1, large: boolean): number {
  const def = PARAM_DEFS[id];
  if (def.curve === "log" || def.step === 0) {
    const norm = valueToNorm(id, value);
    return clampParam(id, normToValue(id, norm + direction * (large ? 0.1 : 0.01)));
  }
  return clampParam(id, value + direction * (large ? def.largeStep : def.step));
}

export function getParamValue(patch: SynthPatch, id: SynthParamId): number {
  switch (id) {
    case "cutoffHz":
      return patch.cutoffHz;
    case "resonance":
      return patch.resonance;
    case "attack":
      return patch.ampEnv.attack;
    case "decay":
      return patch.ampEnv.decay;
    case "sustain":
      return patch.ampEnv.sustain;
    case "release":
      return patch.ampEnv.release;
    case "filterEnvAmount":
      return patch.filterEnvAmount;
    case "octaveOffset":
      return patch.octaveOffset;
  }
}

export function withParamValue(patch: SynthPatch, id: SynthParamId, value: number): SynthPatch {
  const v = clampParam(id, value);
  switch (id) {
    case "cutoffHz":
      return { ...patch, cutoffHz: v };
    case "resonance":
      return { ...patch, resonance: v };
    case "attack":
      return { ...patch, ampEnv: { ...patch.ampEnv, attack: v } };
    case "decay":
      return { ...patch, ampEnv: { ...patch.ampEnv, decay: v } };
    case "sustain":
      return { ...patch, ampEnv: { ...patch.ampEnv, sustain: v } };
    case "release":
      return { ...patch, ampEnv: { ...patch.ampEnv, release: v } };
    case "filterEnvAmount":
      return { ...patch, filterEnvAmount: v };
    case "octaveOffset":
      return { ...patch, octaveOffset: v as -1 | 0 | 1 };
  }
}

/** UI resonance 0–1 → filter Q 0.5–12 (engine mapping, plan §8). */
export function resonanceToQ(resonance: number): number {
  return 0.5 + resonance * 11.5;
}

/** Track/master level 0–1 → decibels for a Tone.Gain (−60 dB floor ≈ silent). */
export function levelToGain(level: number): number {
  if (level <= 0) return 0;
  // Perceptual-ish curve: quadratic keeps low slider travel useful.
  return level * level;
}
