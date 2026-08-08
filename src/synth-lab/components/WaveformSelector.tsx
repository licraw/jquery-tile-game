"use client";

import { dispatch } from "@/synth-lab/state/commands";
import { useSynthLabState } from "@/synth-lab/state/projectStore";
import type { SynthTrackId, Waveform } from "@/synth-lab/state/types";
import styles from "@/synth-lab/styles.module.css";

/**
 * Waveform Selector (Figma 27:72): four segments pairing a waveform glyph
 * with its name — the glyph is the teaching device. Radiogroup semantics;
 * state is shown by glyph + label + selected treatment, never color alone.
 * Glyph path data comes from the Figma-exported assets (stroke recolored via
 * currentColor so the active segment can invert).
 */
const GLYPH_PATHS: Record<Waveform, string> = {
  sine: "M2 8C4 2 6 2 8 8C10 14 12 14 14 8C16 2 18 2 20 8C22 14 24 14 26 8",
  triangle: "M2 12L6 4L11 14L16 4L21 14L26 6",
  sawtooth: "M2 13V3L9 13V3L16 13V3L23 13",
  square: "M2 12V4H8V12H14V4H20V12H26"
};

const WAVEFORM_ORDER: { id: Waveform; label: string }[] = [
  { id: "sine", label: "Sine" },
  { id: "triangle", label: "Triangle" },
  { id: "sawtooth", label: "Saw" },
  { id: "square", label: "Square" }
];

export function WaveformSelector({ trackId }: { trackId: SynthTrackId }) {
  const waveform = useSynthLabState((s) => s.project.tracks[trackId].patch?.waveform);
  if (!waveform) return null;

  return (
    <div className={styles.segmented} role="radiogroup" aria-label="Oscillator waveform">
      {WAVEFORM_ORDER.map(({ id, label }) => {
        const active = waveform === id;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={active}
            className={`${styles.segment} ${active ? styles.segmentActive : ""}`}
            onClick={() => dispatch({ type: "setWaveform", trackId, waveform: id })}
          >
            <svg
              className={styles.segmentGlyph}
              viewBox="0 0 28 16"
              fill="none"
              aria-hidden="true"
              focusable="false"
            >
              <path
                d={GLYPH_PATHS[id]}
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {label}
          </button>
        );
      })}
    </div>
  );
}
