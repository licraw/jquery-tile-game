"use client";

import { uiStore, useUiState } from "@/synth-lab/state/uiStore";
import type { TrackId } from "@/synth-lab/state/types";
import styles from "@/synth-lab/styles.module.css";

/**
 * Concept Highlight (Figma 44:79): anchored explanation card, never modal —
 * the loop keeps playing. Source=Lesson uses the teaching cyan, Source=Agent
 * the agent magenta.
 */
export function ConceptHighlight({ trackId }: { trackId: TrackId }) {
  const highlight = useUiState((s) => s.highlight);
  if (!highlight || highlight.trackId !== trackId || !highlight.concept) return null;

  const agent = highlight.source === "agent";

  return (
    <aside
      className={`${styles.conceptHighlight} ${agent ? styles.conceptHighlightAgent : ""}`}
      aria-label="Concept explanation"
    >
      <div className={styles.agentCardHeader}>
        <span className={`${styles.conceptHighlightEyebrow} ${agent ? styles.conceptHighlightEyebrowAgent : ""}`}>
          {agent ? "CONCEPT  ·  FROM YOUR AGENT" : "CONCEPT"}
        </span>
        <button
          type="button"
          className={styles.agentCardClose}
          aria-label="Dismiss concept explanation"
          onClick={() =>
            uiStore.setHighlight(agent ? null : { ...highlight, concept: null })
          }
        >
          ✕
        </button>
      </div>
      {highlight.concept.title ? <h3 className={styles.lessonTitle}>{highlight.concept.title}</h3> : null}
      <p className={styles.lessonBody}>{highlight.concept.body}</p>
    </aside>
  );
}
