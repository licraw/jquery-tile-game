import type { LessonProgress, Project, SynthLabState, TrackId } from "./types";
import { TRACK_IDS } from "./types";

/**
 * Local persistence (plan §13). Two keys so "Reset project" can clear the jam
 * while keeping concept mastery. History and agent activity are session-only.
 */
export const PROJECT_STORAGE_KEY = "soft-arcade-synth-lab-project-v1";
export const PROGRESS_STORAGE_KEY = "soft-arcade-synth-lab-progress-v1";
const SAVE_DEBOUNCE_MS = 500;

interface PersistedProject {
  schemaVersion: 1;
  project: Project;
  selectedTrackId: TrackId;
}

function isValidProject(value: unknown): value is Project {
  if (typeof value !== "object" || value === null) return false;
  const project = value as Project;
  if (project.schemaVersion !== 1) return false;
  if (typeof project.tempoBpm !== "number" || typeof project.masterLevel !== "number") return false;
  if (typeof project.tracks !== "object" || project.tracks === null) return false;
  return TRACK_IDS.every((id) => {
    const track = project.tracks[id];
    return (
      typeof track === "object" &&
      track !== null &&
      typeof track.muted === "boolean" &&
      typeof track.level === "number" &&
      typeof track.pattern === "object" &&
      track.pattern !== null
    );
  });
}

function isValidProgress(value: unknown): value is LessonProgress {
  if (typeof value !== "object" || value === null) return false;
  const progress = value as LessonProgress;
  return (
    (progress.activeChallengeId === null || typeof progress.activeChallengeId === "string") &&
    Array.isArray(progress.completed) &&
    typeof progress.concepts === "object" &&
    progress.concepts !== null
  );
}

/** Restores persisted state over the defaults; corrupt payloads fall back silently. */
export function loadPersistedState(defaults: SynthLabState): SynthLabState {
  if (typeof window === "undefined") return defaults;
  let state = defaults;
  try {
    const raw = window.localStorage.getItem(PROJECT_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PersistedProject;
      if (parsed && parsed.schemaVersion === 1 && isValidProject(parsed.project)) {
        state = {
          ...state,
          project: parsed.project,
          selectedTrackId: TRACK_IDS.includes(parsed.selectedTrackId) ? parsed.selectedTrackId : state.selectedTrackId
        };
      }
    }
  } catch {
    // Corrupt project payload — keep the default jam.
  }
  try {
    const raw = window.localStorage.getItem(PROGRESS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as LessonProgress;
      if (isValidProgress(parsed)) {
        state = {
          ...state,
          lessons: {
            activeChallengeId: parsed.activeChallengeId,
            completed: parsed.completed.filter((id): id is string => typeof id === "string"),
            concepts: { ...state.lessons.concepts, ...parsed.concepts }
          }
        };
      }
    }
  } catch {
    // Corrupt progress payload — start progress fresh.
  }
  return state;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

export function schedulePersist(getState: () => SynthLabState): void {
  if (typeof window === "undefined") return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    persistNow(getState());
  }, SAVE_DEBOUNCE_MS);
}

export function persistNow(state: SynthLabState): void {
  if (typeof window === "undefined") return;
  try {
    const payload: PersistedProject = {
      schemaVersion: 1,
      project: state.project,
      selectedTrackId: state.selectedTrackId
    };
    window.localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(payload));
    window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(state.lessons));
  } catch {
    // Storage full/unavailable — persistence is best-effort.
  }
}
