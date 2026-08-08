"use client";

import { useState } from "react";
import { CHALLENGES, CHALLENGE_COUNT, getChallenge } from "@/synth-lab/lessons/challenges";
import {
  advanceFromComplete,
  getActiveStepIndex,
  startChallenge
} from "@/synth-lab/lessons/lessonEngine";
import { useSynthLabState } from "@/synth-lab/state/projectStore";
import { uiStore, useUiState } from "@/synth-lab/state/uiStore";
import styles from "@/synth-lab/styles.module.css";

/** present_coach_message renders inside the Lesson Card — never a second surface. */
function CoachMessage() {
  const coachMessage = useUiState((s) => s.coachMessage);
  if (!coachMessage) return null;
  return (
    <div className={styles.coachMessage}>
      <div className={styles.coachMessageHeader}>
        <span className={styles.coachMessageEyebrow}>FROM YOUR AGENT</span>
        <button
          type="button"
          className={styles.agentCardClose}
          aria-label="Dismiss agent message"
          onClick={() => uiStore.setCoachMessage(null)}
        >
          ✕
        </button>
      </div>
      <p className={styles.lessonBody}>{coachMessage.message}</p>
    </div>
  );
}

/**
 * Lesson Card (Figma 42:200): the single voice of the coach rail. One shape
 * across every teaching state — Eyebrow / Title / Body / Status / optional
 * Action. Active challenges have no action button: the way forward is the
 * instrument.
 */
export function LessonCard({ audioStarted }: { audioStarted: boolean }) {
  const lessons = useSynthLabState((s) => s.lessons);
  const [browserOpen, setBrowserOpen] = useState(false);
  const challenge = getChallenge(lessons.activeChallengeId);
  const masteredCount = Object.values(lessons.concepts).filter(Boolean).length;

  if (!audioStarted) {
    return (
      <section className={styles.lessonCard} aria-label="Lesson">
        <span className={styles.lessonEyebrow}>FIRST SESSION</span>
        <h3 className={styles.lessonTitle}>Ready when you are.</h3>
        <p className={styles.lessonBody}>
          A four-track jam is already loaded. Start the audio, listen once, then change one control
          and hear exactly what it did. Challenge 0 begins right after.
        </p>
        <div className={styles.lessonStatus}>
          <span className={styles.lessonStatusDot} aria-hidden="true" />
          <span className={styles.lessonStatusText}>Waiting for you to start audio</span>
        </div>
      </section>
    );
  }

  if (!challenge) {
    // Free Play (brief §12): lessons never trap the user.
    return (
      <section className={`${styles.lessonCard} ${styles.lessonCardFree}`} aria-label="Lesson">
        <span className={`${styles.lessonEyebrow} ${styles.lessonEyebrowFree}`}>FREE PLAY</span>
        <h3 className={styles.lessonTitle}>Your lab. Nothing is being graded.</h3>
        <p className={styles.lessonBody}>
          Every control is open and every change is undoable. Pick a challenge back up whenever you
          want one.
        </p>
        <div className={styles.lessonStatus}>
          <span className={`${styles.lessonStatusDot} ${styles.lessonStatusDotNeutral}`} aria-hidden="true" />
          <span className={`${styles.lessonStatusText} ${styles.lessonStatusTextNeutral}`}>
            {`5 concepts  ·  ${masteredCount} mastered`}
          </span>
        </div>
        <CoachMessage />
        <button
          type="button"
          className={styles.buttonSecondary}
          aria-expanded={browserOpen}
          onClick={() => setBrowserOpen((open) => !open)}
        >
          Browse challenges
        </button>
        {browserOpen ? (
          <ul className={styles.challengeList}>
            {CHALLENGES.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={styles.challengeListItem}
                  onClick={() => {
                    setBrowserOpen(false);
                    startChallenge(item.id);
                  }}
                >
                  <span>
                    {item.kind === "recipe" ? "Recipe · " : `Challenge ${item.number} · `}
                    {item.title.replace(/^Recipe: /, "").replace(/\.$/, "")}
                  </span>
                  {lessons.completed.includes(item.id) ? <span aria-label="complete">✓</span> : null}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    );
  }

  const complete = lessons.completed.includes(challenge.id);
  const isRecipe = challenge.kind === "recipe";
  const stepIndex = getActiveStepIndex();
  const eyebrow = isRecipe
    ? `RECIPE  ·  ${challenge.tag}`
    : `CHALLENGE ${challenge.number}  ·  ${challenge.tag}`;

  if (complete) {
    return (
      <section className={`${styles.lessonCard} ${styles.lessonCardComplete}`} aria-label="Lesson">
        <span className={`${styles.lessonEyebrow} ${styles.lessonEyebrowComplete}`}>
          {`${eyebrow}  ·  COMPLETE`}
        </span>
        <h3 className={styles.lessonTitle}>{challenge.successTitle}</h3>
        <p className={styles.lessonBody}>{challenge.successBody}</p>
        <div className={styles.lessonStatus}>
          <span className={`${styles.lessonStatusDot} ${styles.lessonStatusDotComplete}`} aria-hidden="true" />
          <span className={`${styles.lessonStatusText} ${styles.lessonStatusTextComplete}`}>
            {challenge.concept ? `Concept unlocked: ${challenge.tag.toLowerCase()}` : "Challenge complete"}
          </span>
        </div>
        <CoachMessage />
        <button type="button" className={styles.buttonPrimary} onClick={advanceFromComplete}>
          Next challenge
        </button>
      </section>
    );
  }

  const body = isRecipe && challenge.steps ? challenge.steps[stepIndex]?.instruction ?? challenge.body : challenge.body;
  const status =
    isRecipe && challenge.steps
      ? `Step ${Math.min(stepIndex + 1, challenge.steps.length)} of ${challenge.steps.length}  ·  ${challenge.listening}`
      : challenge.listening;

  return (
    <section className={styles.lessonCard} aria-label="Lesson">
      <span className={styles.lessonEyebrow}>{eyebrow}</span>
      <h3 className={styles.lessonTitle}>{challenge.title}</h3>
      <p className={styles.lessonBody}>{body}</p>
      <div className={styles.lessonStatus}>
        <span className={styles.lessonStatusDot} aria-hidden="true" />
        <span className={styles.lessonStatusText} role="status">
          {status}
        </span>
      </div>
      <CoachMessage />
    </section>
  );
}

export function challengeChipLabel(activeChallengeId: string | null): string {
  const challenge = getChallenge(activeChallengeId);
  if (!challenge) return "FREE PLAY";
  if (challenge.kind === "recipe") return `RECIPE  ·  ${challenge.tag}`;
  return `CHALLENGE ${challenge.number} OF ${CHALLENGE_COUNT}`;
}
