"use client";

import { usePlayheadBar } from "@/synth-lab/state/playheadStore";
import { BAR_INDICES } from "@/synth-lab/state/types";
import { uiStore, useVisibleBar } from "@/synth-lab/state/uiStore";
import styles from "@/synth-lab/styles.module.css";

/**
 * Bar page selector for the note grid. The loop is two bars; the grid shows
 * one at a time, the way a hardware groovebox pages a 16-step row.
 *
 * Viewing and playback are deliberately independent: the pip marks the bar
 * that is currently sounding, but choosing a bar never touches the transport
 * and the transport never changes the choice. That is what lets someone edit
 * bar 2 while bar 1 plays without the view being pulled out from under them.
 *
 * All four tracks share one selection (it lives in uiStore), so paging the
 * editor pages the whole workspace.
 */
export function BarSelector() {
  const visibleBar = useVisibleBar();
  const playingBar = usePlayheadBar();

  return (
    <div className={styles.barSelector} role="group" aria-label="Bar shown in the grid">
      {BAR_INDICES.map((bar) => {
        const selected = bar === visibleBar;
        const playing = playingBar === bar;
        return (
          <button
            key={bar}
            type="button"
            className={`${styles.barButton} ${selected ? styles.barButtonSelected : ""}`}
            aria-pressed={selected}
            aria-label={`Show bar ${bar + 1} of ${BAR_INDICES.length}${playing ? ", currently playing" : ""}`}
            onClick={() => uiStore.setVisibleBar(bar)}
          >
            BAR {bar + 1}
            {/* Always rendered so selecting a bar never shifts the row. */}
            <span
              className={`${styles.barPip} ${playing ? styles.barPipPlaying : ""}`}
              aria-hidden="true"
            />
          </button>
        );
      })}
    </div>
  );
}
