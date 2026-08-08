"use client";

import { type CSSProperties, type KeyboardEvent } from "react";
import {
  PARAM_DEFS,
  getParamValue,
  normToValue,
  stepParam,
  valueToNorm,
  type SynthParamId
} from "@/synth-lab/engine/paramMap";
import { commitGesture, dispatch } from "@/synth-lab/state/commands";
import { useSynthLabState } from "@/synth-lab/state/projectStore";
import type { SynthTrackId } from "@/synth-lab/state/types";
import styles from "@/synth-lab/styles.module.css";

interface ParameterSliderProps {
  trackId: SynthTrackId;
  param: SynthParamId;
  /** Lesson/agent teaching highlight (Figma State=Highlighted / Agent changed). */
  highlight?: "lesson" | "agent" | null;
}

/**
 * Parameter Slider (Figma 26:74): perceptual label, live value, technical
 * label. Native range input; the log curve lives in the value mapping, not
 * the input (input is 0–1000 linear). Keyboard: arrows step, Shift+arrows
 * large step, Home/End range ends — handled explicitly so log params step
 * perceptually.
 */
export function ParameterSlider({ trackId, param, highlight = null }: ParameterSliderProps) {
  const patch = useSynthLabState((s) => s.project.tracks[trackId].patch);
  if (!patch) return null;

  const def = PARAM_DEFS[param];
  const value = getParamValue(patch, param);
  const norm = valueToNorm(param, value);

  function setValue(next: number) {
    dispatch({ type: "setSynthParam", trackId, param, value: next });
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    let next: number | null = null;
    switch (event.key) {
      case "ArrowRight":
      case "ArrowUp":
        next = stepParam(param, value, 1, event.shiftKey);
        break;
      case "ArrowLeft":
      case "ArrowDown":
        next = stepParam(param, value, -1, event.shiftKey);
        break;
      case "Home":
        next = def.min;
        break;
      case "End":
        next = def.max;
        break;
      default:
        return;
    }
    event.preventDefault();
    setValue(next);
  }

  const cardClass = `${styles.paramCard} ${
    highlight === "lesson" ? styles.paramCardHighlighted : highlight === "agent" ? styles.paramCardAgent : ""
  }`;

  return (
    <div className={cardClass}>
      <div className={styles.paramHeader}>
        <span>{def.label}</span>
        <span className={styles.paramValue}>{def.format(value)}</span>
      </div>
      <input
        className={`${styles.range} ${styles.paramRange}`}
        type="range"
        min={0}
        max={1000}
        step={1}
        value={Math.round(norm * 1000)}
        aria-label={`${def.label}, ${def.technical.replace(/\s+·\s+/g, ", ").toLowerCase()}`}
        aria-valuetext={def.formatSpoken(value)}
        style={{ "--sl-fill": `${norm * 100}%` } as CSSProperties}
        onChange={(event) => setValue(normToValue(param, Number(event.target.value) / 1000))}
        onKeyDown={onKeyDown}
        onPointerUp={commitGesture}
        onBlur={commitGesture}
      />
      <span className={styles.paramTechnical}>{def.technical}</span>
      {highlight === "lesson" ? <span className={styles.teachBadge}>THIS IS THE CONTROL</span> : null}
      {highlight === "agent" ? (
        <span className={`${styles.teachBadge} ${styles.teachBadgeAgent}`}>CHANGED BY AGENT</span>
      ) : null}
    </div>
  );
}
