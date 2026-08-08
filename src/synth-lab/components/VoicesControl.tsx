"use client";

import { dispatch } from "@/synth-lab/state/commands";
import { useSynthLabState } from "@/synth-lab/state/projectStore";
import styles from "@/synth-lab/styles.module.css";

/**
 * Voices control: Mono / 2 / 4 segmented control reusing the DS V1
 * Difficulty Tabs pattern. Trims the pad voicing so mono-vs-poly is audibly
 * demonstrable with one control (the polyphony lesson's A/B).
 */
const OPTIONS: { value: 1 | 2 | 4; label: string }[] = [
  { value: 1, label: "Mono" },
  { value: 2, label: "2" },
  { value: 4, label: "4" }
];

export function VoicesControl({ trackId }: { trackId: "pads" | "lead" }) {
  const voices = useSynthLabState((s) => s.project.tracks[trackId].patch?.voices);
  if (!voices) return null;

  return (
    <div className={styles.segmented} role="radiogroup" aria-label="Voices, how many notes sound at once">
      {OPTIONS.map(({ value, label }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={voices === value}
          className={`${styles.segment} ${styles.segmentCompact} ${voices === value ? styles.segmentActive : ""}`}
          onClick={() => dispatch({ type: "setVoices", trackId, voices: value })}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
