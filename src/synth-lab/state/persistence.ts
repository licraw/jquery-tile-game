import type { DrumStep, LessonProgress, Project, SynthLabState, TrackId } from "./types";
import { DRUM_LANES, STEP_COUNT, STEPS_PER_BAR, TRACK_IDS } from "./types";

/**
 * Local persistence (plan §13). Two keys so "Reset project" can clear the jam
 * while keeping concept mastery. History and agent activity are session-only.
 *
 * The storage key is deliberately unchanged across the v1→v2 schema bump: the
 * migration below upgrades old payloads in place rather than orphaning them
 * under a stale key, so a returning user keeps the jam they made.
 */
export const PROJECT_STORAGE_KEY = "soft-arcade-synth-lab-project-v1";
export const PROGRESS_STORAGE_KEY = "soft-arcade-synth-lab-progress-v1";
const SAVE_DEBOUNCE_MS = 500;

export const CURRENT_SCHEMA_VERSION = 2;

interface PersistedProject {
  schemaVersion: number;
  project: Project;
  selectedTrackId: TrackId;
}

/**
 * Brings a stored step array to the current 32-step length.
 *
 * A v1 array is one bar of 16. Repeating it into bar 2 is the only migration
 * that leaves the user's saved jam sounding exactly as it did before the loop
 * grew — a 16-step loop played twice is the same audio. Padding with rests
 * would silently gut half of everything they had made.
 */
function normalizeSteps<T>(steps: T[], rest: T): T[] {
  if (steps.length === STEP_COUNT) return steps;
  if (steps.length === STEPS_PER_BAR) return [...steps, ...steps];
  // Any other length is a corrupt payload rather than a known schema: keep
  // whatever content is there and pad to length instead of dropping the jam.
  const out = steps.slice(0, STEP_COUNT);
  while (out.length < STEP_COUNT) out.push(rest);
  return out;
}

function isDrumStep(value: unknown): value is DrumStep {
  return value === "off" || value === "on" || value === "accent";
}

/**
 * Validates a stored project and upgrades it to the current schema. Returns
 * null for payloads too damaged to trust, which fall back to the default jam.
 */
export function migrateProject(value: unknown): Project | null {
  if (typeof value !== "object" || value === null) return null;
  // Stored payloads predate the current schema, so the version is read as a
  // plain number rather than the literal type the live Project carries.
  const project = value as Omit<Project, "schemaVersion"> & { schemaVersion: number };
  // 1 = one-bar/16-step patterns, 2 = two-bar/32-step.
  if (project.schemaVersion !== 1 && project.schemaVersion !== CURRENT_SCHEMA_VERSION) return null;
  if (typeof project.tempoBpm !== "number" || typeof project.masterLevel !== "number") return null;
  if (typeof project.tracks !== "object" || project.tracks === null) return null;

  const valid = TRACK_IDS.every((id) => {
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
  if (!valid) return null;

  const { drums, bass, pads, lead } = project.tracks;
  if (drums.pattern.kind !== "drums" || typeof drums.pattern.lanes !== "object" || drums.pattern.lanes === null) {
    return null;
  }
  if (!DRUM_LANES.every((lane) => Array.isArray(drums.pattern.lanes[lane]))) return null;
  if (bass.pattern.kind !== "notes" || !Array.isArray(bass.pattern.steps)) return null;
  if (lead.pattern.kind !== "notes" || !Array.isArray(lead.pattern.steps)) return null;
  if (pads.pattern.kind !== "chords" || !Array.isArray(pads.pattern.steps)) return null;

  return {
    ...project,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    tracks: {
      drums: {
        ...drums,
        pattern: {
          kind: "drums",
          lanes: Object.fromEntries(
            DRUM_LANES.map((lane) => [
              lane,
              normalizeSteps(
                drums.pattern.lanes[lane].map((step) => (isDrumStep(step) ? step : "off")),
                "off" as DrumStep
              )
            ])
          ) as Record<(typeof DRUM_LANES)[number], DrumStep[]>
        }
      },
      bass: { ...bass, pattern: { kind: "notes", steps: normalizeSteps(bass.pattern.steps, null) } },
      pads: { ...pads, pattern: { kind: "chords", steps: normalizeSteps(pads.pattern.steps, null) } },
      lead: { ...lead, pattern: { kind: "notes", steps: normalizeSteps(lead.pattern.steps, null) } }
    }
  };
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
      // The envelope's version is informational — migrateProject reads the
      // project's own schemaVersion, so a mismatched envelope never discards
      // an otherwise-readable jam.
      const project = parsed ? migrateProject(parsed.project) : null;
      if (project) {
        state = {
          ...state,
          project,
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
      schemaVersion: CURRENT_SCHEMA_VERSION,
      project: state.project,
      selectedTrackId: state.selectedTrackId
    };
    window.localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(payload));
    window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(state.lessons));
  } catch {
    // Storage full/unavailable — persistence is best-effort.
  }
}
