"use client";

import { useEffect, useRef } from "react";
import { PARAM_DEFS, valueToNorm, type SynthParamId } from "@/synth-lab/engine/paramMap";
import { getUndoStack, type Transaction } from "@/synth-lab/state/history";
import { useSynthLabState } from "@/synth-lab/state/projectStore";
import { performUndo } from "@/synth-lab/state/undoActions";
import { uiStore, useUiState } from "@/synth-lab/state/uiStore";
import type { AgentAction, SynthPatch, SynthTrackId, TrackId } from "@/synth-lab/state/types";
import styles from "@/synth-lab/styles.module.css";
import { TRACK_META } from "./trackMeta";

/**
 * Agent Action Card (Figma 29:114): makes an agent change inspectable,
 * audible and reversible. One card = one transaction, so a single Undo
 * reverts every parameter it changed. Anchored beside the affected control
 * (rendered inside the affected track's editor), not in a side panel.
 * Before→after bars are normalized per row to the parameter's full range —
 * and unlike the Figma component, they render increases too.
 */
const PARAM_SEGMENTS = new Set(Object.keys(PARAM_DEFS));

function paramIdForPath(path: string): SynthParamId | null {
  const tail = path.split(".").pop() ?? "";
  return PARAM_SEGMENTS.has(tail) ? (tail as SynthParamId) : null;
}

function beforePatchFor(trackId: SynthTrackId, txn: Transaction, current: SynthPatch): SynthPatch {
  const patch: SynthPatch = { ...current, ampEnv: { ...current.ampEnv } };
  for (const change of txn.changes) {
    const [tracks, id, patchKey, ...rest] = change.path;
    if (tracks !== "tracks" || id !== trackId || patchKey !== "patch") continue;
    if (rest[0] === "ampEnv" && typeof rest[1] === "string") {
      (patch.ampEnv as unknown as Record<string, unknown>)[rest[1]] = change.before;
    } else if (typeof rest[0] === "string") {
      (patch as unknown as Record<string, unknown>)[rest[0]] = change.before;
    }
  }
  return patch;
}

export function AgentActionCard({ trackId }: { trackId: TrackId }) {
  const cardActionId = useUiState((s) => s.agentCardActionId);
  const agentActivity = useSynthLabState((s) => s.agentActivity);
  const patch = useSynthLabState((s) => s.project.tracks[trackId].patch);
  const auditioning = useRef<SynthTrackId | null>(null);

  useEffect(() => {
    return () => {
      // Never leave a stuck audition behind if the card unmounts mid-press.
      if (auditioning.current) {
        void import("@/synth-lab/engine/SynthLabEngine").then((mod) =>
          mod.getEngineIfStarted()?.endAudition(auditioning.current as SynthTrackId)
        );
        auditioning.current = null;
      }
    };
  }, []);

  const action: AgentAction | undefined = agentActivity.find((a) => a.id === cardActionId);
  if (!action || action.trackId !== trackId) return null;

  const transaction = getUndoStack().find((t) => t.id === action.transactionId) ?? null;
  const isTop = transaction !== null && getUndoStack()[getUndoStack().length - 1]?.id === transaction.id;
  const isSynth = trackId !== "drums";
  const canAudition = isSynth && transaction !== null && patch !== null;

  function startHearBefore() {
    if (!canAudition || !transaction || !patch) return;
    void import("@/synth-lab/engine/SynthLabEngine").then((mod) => {
      const engine = mod.getEngineIfStarted();
      if (!engine) return;
      auditioning.current = trackId as SynthTrackId;
      engine.audition(trackId as SynthTrackId, beforePatchFor(trackId as SynthTrackId, transaction, patch));
    });
  }

  function endHearBefore() {
    if (!auditioning.current) return;
    void import("@/synth-lab/engine/SynthLabEngine").then((mod) => {
      mod.getEngineIfStarted()?.endAudition(trackId as SynthTrackId);
    });
    auditioning.current = null;
  }

  const trackName = TRACK_META[trackId].name.toUpperCase();

  return (
    <div className={styles.agentCard}>
      <div className={styles.agentCardHeader}>
        <div className={styles.agentCardHeaderLeft}>
          <span className={`${styles.agentDot} ${action.status === "working" ? styles.agentDotPulse : ""}`} />
          <span className={styles.agentCardEyebrow}>
            {action.status === "error" ? `${trackName} — AGENT ERROR` : `${trackName} — AGENT CHANGE`}
          </span>
        </div>
        <button
          type="button"
          className={styles.agentCardClose}
          aria-label="Dismiss agent change card"
          onClick={() => uiStore.setAgentCardAction(null)}
        >
          ✕
        </button>
      </div>

      {action.status === "error" ? (
        <p className={styles.agentCardWhyBody}>
          {action.error ?? "The request was invalid."} Nothing was changed.
        </p>
      ) : (
        <>
          <div className={styles.agentDeltas}>
            {action.changes.map((change) => {
              const param = paramIdForPath(change.path);
              const beforeNorm =
                param && typeof change.before === "number" ? valueToNorm(param, change.before) : null;
              const afterNorm =
                param && typeof change.after === "number" ? valueToNorm(param, change.after) : null;
              return (
                <div key={change.path} className={styles.agentDelta}>
                  <div className={styles.agentDeltaTop}>
                    <span className={styles.agentDeltaLabel}>{change.label}</span>
                    <span className={styles.agentDeltaValues}>
                      {change.formattedBefore ? (
                        <>
                          <span className={styles.agentDeltaBefore}>{change.formattedBefore}</span>
                          <span className={styles.agentDeltaArrow}>→</span>
                        </>
                      ) : null}
                      <span className={styles.agentDeltaAfter}>{change.formattedAfter}</span>
                    </span>
                  </div>
                  {beforeNorm !== null && afterNorm !== null ? (
                    <div className={styles.agentDeltaTrack}>
                      <span className={styles.agentDeltaBarBefore} style={{ width: `${beforeNorm * 100}%` }} />
                      <span className={styles.agentDeltaBarAfter} style={{ width: `${afterNorm * 100}%` }} />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          {action.reason ? (
            <div className={styles.agentCardWhy}>
              <span className={styles.agentCardWhyLabel}>WHY</span>
              <p className={styles.agentCardWhyBody}>{action.reason}</p>
            </div>
          ) : null}

          <div className={styles.agentCardActions}>
            {canAudition ? (
              <button
                type="button"
                className={styles.buttonSecondary}
                onPointerDown={startHearBefore}
                onPointerUp={endHearBefore}
                onPointerLeave={endHearBefore}
                onKeyDown={(e) => {
                  if (e.key === " " || e.key === "Enter") startHearBefore();
                }}
                onKeyUp={endHearBefore}
                title="Hold to hear the sound before this change"
              >
                Hear Before
              </button>
            ) : null}
            {canAudition ? (
              <button type="button" className={styles.buttonPrimary} onClick={endHearBefore}>
                Hear After
              </button>
            ) : null}
            <button
              type="button"
              className={styles.buttonSecondary}
              disabled={!isTop}
              title={isTop ? undefined : "Later changes exist — press ⌘Z to walk back through them"}
              onClick={() => {
                endHearBefore();
                if (performUndo()) uiStore.setAgentCardAction(null);
              }}
            >
              Undo
            </button>
          </div>
        </>
      )}
    </div>
  );
}
