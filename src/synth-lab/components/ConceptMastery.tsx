"use client";

import { getChallenge } from "@/synth-lab/lessons/challenges";
import { useSynthLabState } from "@/synth-lab/state/projectStore";
import type { ConceptId } from "@/synth-lab/state/types";
import styles from "@/synth-lab/styles.module.css";

/**
 * Concept Mastery (Figma 32:216 region): the five-concept progress list.
 * Reinforces mastery, not engagement metrics (brief §11).
 */
const CONCEPTS: { id: ConceptId; label: string }[] = [
  { id: "oscillators", label: "Oscillators" },
  { id: "envelopes", label: "Envelopes" },
  { id: "filters", label: "Filters" },
  { id: "polyphony", label: "Polyphony" },
  { id: "recipes", label: "Sound recipes" }
];

function footerCopy(concepts: Record<ConceptId, boolean>, activeChallengeId: string | null): string {
  const mastered = CONCEPTS.filter((c) => concepts[c.id]);
  if (mastered.length === 0) {
    return "Nothing unlocked yet. Challenge 0 takes about a minute.";
  }
  if (mastered.length === CONCEPTS.length) {
    return "All five concepts mastered. The lab is yours.";
  }
  const active = getChallenge(activeChallengeId);
  const activeConcept = active?.concept && !concepts[active.concept] ? active.concept : null;
  if (activeConcept) {
    const label = CONCEPTS.find((c) => c.id === activeConcept)?.label ?? activeConcept;
    return `${label} unlocks after this challenge.`;
  }
  const next = CONCEPTS.find((c) => !concepts[c.id]);
  if (next?.id === "recipes") {
    return "Two recipes unlock the last concept.";
  }
  return next ? `${next.label} is next.` : "";
}

export function ConceptMastery() {
  const concepts = useSynthLabState((s) => s.lessons.concepts);
  const activeChallengeId = useSynthLabState((s) => s.lessons.activeChallengeId);

  return (
    <section className={styles.conceptMastery} aria-label="Concept mastery">
      <span className={styles.conceptHeading}>Concept mastery</span>
      {CONCEPTS.map(({ id, label }) => {
        const done = concepts[id];
        return (
          <div key={id} className={styles.conceptRow}>
            <span
              className={`${styles.conceptMark} ${done ? styles.conceptMarkDone : ""}`}
              aria-hidden="true"
            />
            <span className={`${styles.conceptLabel} ${done ? styles.conceptLabelDone : ""}`}>
              {label}
              <span className={styles.srOnly}>{done ? ", mastered" : ", not yet mastered"}</span>
            </span>
          </div>
        );
      })}
      <span className={styles.conceptFooter}>{footerCopy(concepts, activeChallengeId)}</span>
    </section>
  );
}
