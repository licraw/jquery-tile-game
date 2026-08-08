import { dispatch, dispatchBatch } from "@/synth-lab/state/commands";
import { schedulePersist } from "@/synth-lab/state/persistence";
import { projectStore } from "@/synth-lab/state/projectStore";
import { uiStore } from "@/synth-lab/state/uiStore";
import type { Project, SynthLabState } from "@/synth-lab/state/types";
import { CHALLENGES, getChallenge, nextIncompleteChallenge, type Challenge } from "./challenges";

/**
 * Lesson engine (plan §10/§21 Phase 4): subscribes to the store and inspects
 * state after user commands. Lessons never mutate through side doors — any
 * project change they make goes through `dispatch` with origin "lesson".
 * Progress mutations (activeChallengeId/completed/concepts) are lesson
 * bookkeeping, deliberately outside history (plan §12).
 */
let startSnapshot: Project | null = null;
let activeStepIndex = 0;
let unsubscribe: (() => void) | null = null;

function setLessons(update: (s: SynthLabState) => SynthLabState): void {
  projectStore.set(update(projectStore.get()));
  schedulePersist(projectStore.get);
}

function applyChallengeHighlight(challenge: Challenge | null): void {
  if (challenge?.highlight) {
    uiStore.setHighlight({ ...challenge.highlight, source: "lesson", treatment: "teach" });
  } else {
    uiStore.setHighlight(null);
  }
}

/** Starts (or restarts) a challenge: selects its track, arms its validator. */
export function startChallenge(id: string): void {
  const challenge = getChallenge(id);
  if (!challenge) return;
  activeStepIndex = 0;
  setLessons((s) => ({ ...s, lessons: { ...s.lessons, activeChallengeId: id } }));
  if (challenge.trackId) {
    dispatch({ type: "selectTrack", trackId: challenge.trackId }, "lesson");
  }
  // Establish a completable musical context, then snapshot: the validators
  // measure change from where the challenge actually begins.
  const prepareCommands = challenge.prepare?.(projectStore.get().project) ?? [];
  if (prepareCommands.length > 0) {
    dispatchBatch(prepareCommands, "lesson", `${challenge.tag} · set up`);
  }
  startSnapshot = projectStore.get().project;
  applyChallengeHighlight(challenge);
}

export function enterFreePlay(): void {
  startSnapshot = null;
  activeStepIndex = 0;
  setLessons((s) => ({ ...s, lessons: { ...s.lessons, activeChallengeId: null } }));
  uiStore.setHighlight(null);
}

export function advanceFromComplete(): void {
  const { lessons } = projectStore.get();
  const next = nextIncompleteChallenge(lessons.completed, lessons.activeChallengeId);
  if (next) {
    startChallenge(next.id);
  } else {
    enterFreePlay();
  }
}

export function getActiveStepIndex(): number {
  return activeStepIndex;
}

function isComplete(state: SynthLabState, challenge: Challenge): boolean {
  return state.lessons.completed.includes(challenge.id);
}

function markComplete(challenge: Challenge): void {
  setLessons((s) => ({
    ...s,
    lessons: {
      ...s.lessons,
      completed: s.lessons.completed.includes(challenge.id)
        ? s.lessons.completed
        : [...s.lessons.completed, challenge.id],
      concepts: challenge.concept
        ? { ...s.lessons.concepts, [challenge.concept]: true }
        : s.lessons.concepts
    }
  }));
  uiStore.setHighlight(null);
}

function checkActiveChallenge(): void {
  const state = projectStore.get();
  const challenge = getChallenge(state.lessons.activeChallengeId);
  if (!challenge || isComplete(state, challenge)) return;
  if (!startSnapshot) startSnapshot = state.project;

  if (challenge.kind === "recipe" && challenge.steps) {
    // Recipes advance step by step; steps already satisfied count through.
    let index = activeStepIndex;
    while (index < challenge.steps.length && challenge.steps[index].validate(state.project, startSnapshot)) {
      index += 1;
    }
    if (index !== activeStepIndex) {
      activeStepIndex = index;
      // Nudge subscribers (LessonCard) — step index lives in this module.
      projectStore.set({ ...state });
    }
    if (index >= challenge.steps.length) {
      markComplete(challenge);
    }
    return;
  }

  if (challenge.validate(state.project, startSnapshot)) {
    markComplete(challenge);
  }
}

/** Wires validation; called once from SynthLabApp. Returns a cleanup. */
export function attachLessonEngine(): () => void {
  if (unsubscribe) return unsubscribe;
  const state = projectStore.get();
  const active = getChallenge(state.lessons.activeChallengeId);
  if (active && !isComplete(state, active)) {
    startSnapshot = state.project;
    applyChallengeHighlight(active);
  }
  const detach = projectStore.subscribe(checkActiveChallenge);
  unsubscribe = () => {
    detach();
    unsubscribe = null;
  };
  return unsubscribe;
}

export function listChallenges(): Challenge[] {
  return CHALLENGES;
}
