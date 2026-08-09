"use client";

import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import {
  dragToValues,
  envelopeShape,
  handlePosition,
  type EnvelopeHandleId
} from "@/synth-lab/engine/envelopeGeometry";
import { ENVELOPE_PARAM_IDS, type EnvelopeParamId } from "@/synth-lab/engine/paramGroups";
import { PARAM_DEFS, stepParam } from "@/synth-lab/engine/paramMap";
import { commitGesture, dispatch } from "@/synth-lab/state/commands";
import { getUndoStack } from "@/synth-lab/state/history";
import { beforePatchFor } from "@/synth-lab/state/patchDiff";
import { useSynthLabState } from "@/synth-lab/state/projectStore";
import { useUiState } from "@/synth-lab/state/uiStore";
import type { AmpEnvelope, SynthTrackId } from "@/synth-lab/state/types";
import styles from "@/synth-lab/styles.module.css";

/** Technical stage name shown after the perceptual one (decision D3). */
const STAGE_NAME: Record<EnvelopeParamId, string> = {
  attack: "ATTACK",
  decay: "DECAY",
  sustain: "SUSTAIN",
  release: "RELEASE"
};

interface EnvelopeEditorProps {
  trackId: SynthTrackId;
  /** Lesson (cyan) or agent (magenta) treatment. */
  highlight?: "lesson" | "agent" | null;
}

/**
 * ADSR Envelope (Figma 39:84) — the primary amplitude-envelope interface, and
 * the one exception to decision E2's "horizontal sliders for every continuous
 * parameter". Four scalars hide the thing being taught: the shape of a note
 * over time.
 *
 * The polyline is derived from the four project values (never stored here) and
 * the handles write straight back through the command layer, so undo, lesson
 * validation, agent changes, A/B and persistence all keep operating on the one
 * ADSR model in `patch.ampEnv`.
 *
 * Accessibility: the readout row is the keyboard surface, exactly as the
 * component's own note specifies. Each readout is a slider carrying the
 * perceptual name, the technical stage, the current value with units and the
 * range; the graph mirrors that state and is hidden from assistive tech.
 */
export function EnvelopeEditor({ trackId, highlight = null }: EnvelopeEditorProps) {
  const patch = useSynthLabState((s) => s.project.tracks[trackId].patch);
  const agentCardActionId = useUiState((s) => s.agentCardActionId);
  const agentActivity = useSynthLabState((s) => s.agentActivity);
  const plotRef = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState<EnvelopeHandleId | null>(null);

  if (!patch) return null;
  const env = patch.ampEnv;
  const shape = envelopeShape(env);

  // Ghost curve: the envelope as it stood before the agent action currently on
  // screen, rebuilt from that transaction's inverse patches — the same source
  // the Agent Action Card auditions, so the two never disagree.
  const action = agentCardActionId
    ? agentActivity.find((a) => a.id === agentCardActionId && a.trackId === trackId)
    : undefined;
  const transaction = action ? getUndoStack().find((t) => t.id === action.transactionId) : undefined;
  const beforeEnv: AmpEnvelope | null = transaction
    ? beforePatchFor(trackId, transaction, patch).ampEnv
    : null;
  const ghost =
    beforeEnv &&
    ENVELOPE_PARAM_IDS.some((param) => beforeEnv[param] !== env[param])
      ? envelopeShape(beforeEnv)
      : null;

  function pointToPlot(event: PointerEvent<HTMLElement>): { x: number; y: number } | null {
    const rect = plotRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return null;
    return {
      x: ((event.clientX - rect.left) / rect.width) * 100,
      y: ((event.clientY - rect.top) / rect.height) * 100
    };
  }

  function onHandlePointerDown(handle: EnvelopeHandleId, event: PointerEvent<HTMLElement>) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(handle);
  }

  function onHandlePointerMove(handle: EnvelopeHandleId, event: PointerEvent<HTMLElement>) {
    if (dragging !== handle) return;
    const point = pointToPlot(event);
    if (!point) return;
    // One dispatch per move, one coalesced transaction per drag: the corner
    // handle moves decay and sustain together and still undoes as one step.
    dispatch({ type: "setEnvelope", trackId, env: dragToValues(handle, point, env) });
  }

  function endDrag(event: PointerEvent<HTMLElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setDragging(null);
    commitGesture();
  }

  function onReadoutKeyDown(param: EnvelopeParamId, event: KeyboardEvent<HTMLDivElement>) {
    const def = PARAM_DEFS[param];
    const value = env[param];
    let next: number | null = null;
    switch (event.key) {
      case "ArrowRight":
      case "ArrowUp":
        next = stepParam(param, value, 1, event.shiftKey);
        break;
      case "ArrowLeft":
      case "ArrowDown":
        next = stepParam(param, value, -1, event.shiftKey);
        break;
      case "Home":
        next = def.min;
        break;
      case "End":
        next = def.max;
        break;
      default:
        return;
    }
    event.preventDefault();
    dispatch({ type: "setSynthParam", trackId, param, value: next });
  }

  const cardClass = [
    styles.envelope,
    highlight === "lesson" ? styles.envelopeHighlighted : "",
    highlight === "agent" ? styles.envelopeAgent : ""
  ]
    .filter(Boolean)
    .join(" ");

  const handles: EnvelopeHandleId[] = ["attack", "decaySustain", "release"];

  return (
    <div className={cardClass}>
      <div className={styles.envelopeHeader}>
        <div className={styles.envelopeLabels}>
          <span className={styles.envelopeTitle}>Shape</span>
          <span className={styles.envelopeTechnical}>{"AMP ENVELOPE  ·  A  D  S  R"}</span>
        </div>
        <span className={styles.envelopeHint}>Drag the shape</span>
      </div>

      <div className={styles.envelopePlot}>
        {/* Inset drawing area: the baseline sits above the A/D/S/R captions so
            the release handle is never clipped or sat on top of them. */}
        <div className={styles.envelopeCanvas} ref={plotRef}>
          <svg
            className={styles.envelopeSvg}
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
            focusable="false"
          >
            <line className={styles.envelopeGrid} x1="0" y1="0" x2="100" y2="0" />
            <line
              className={styles.envelopeGrid}
              x1="0"
              y1={shape.corner.y}
              x2="100"
              y2={shape.corner.y}
            />
            {/* Stage boundaries, so each caption reads against its segment. */}
            {[shape.peak.x, shape.corner.x, shape.sustainEnd.x].map((x, index) => (
              <line key={index} className={styles.envelopeGrid} x1={x} y1="0" x2={x} y2="100" />
            ))}
            {ghost ? <polyline className={styles.envelopeGhost} points={ghost.polyline} /> : null}
            <path className={styles.envelopeArea} d={shape.area} />
            <polyline className={styles.envelopeLine} points={shape.polyline} />
          </svg>

          {handles.map((handle) => {
            const position = handlePosition(shape, handle);
            return (
              <span
                key={handle}
                // The graph is a pointer enhancement, never the only way in:
                // the readout row below carries the accessible semantics.
                aria-hidden="true"
                className={`${styles.envelopeHandle} ${dragging === handle ? styles.envelopeHandleActive : ""}`}
                data-handle={handle}
                style={{ left: `${position.x}%`, top: `${position.y}%` }}
                onPointerDown={(event) => onHandlePointerDown(handle, event)}
                onPointerMove={(event) => onHandlePointerMove(handle, event)}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
              />
            );
          })}
        </div>

        <span className={styles.envelopeStages} aria-hidden="true">
          {ENVELOPE_PARAM_IDS.map((param) => (
            <span
              key={param}
              className={styles.envelopeStage}
              style={{ left: `${shape.labels[param]}%` }}
            >
              {STAGE_NAME[param][0]}
            </span>
          ))}
        </span>
      </div>

      <div className={styles.envelopeReadouts}>
        {ENVELOPE_PARAM_IDS.map((param) => {
          const def = PARAM_DEFS[param];
          const value = env[param];
          return (
            <div
              key={param}
              className={styles.envelopeReadout}
              role="slider"
              tabIndex={0}
              aria-label={`${def.label}, ${def.technical.replace(/\s+·\s+/g, ", ").toLowerCase()}`}
              aria-valuenow={value}
              aria-valuemin={def.min}
              aria-valuemax={def.max}
              aria-valuetext={def.formatSpoken(value)}
              data-param={param}
              onKeyDown={(event) => onReadoutKeyDown(param, event)}
              onBlur={commitGesture}
            >
              <span className={styles.envelopeReadoutLabel}>
                {`${def.label.toUpperCase()}  ·  ${STAGE_NAME[param]}`}
              </span>
              <span className={styles.envelopeReadoutValue}>{def.format(value)}</span>
            </div>
          );
        })}
      </div>

      {highlight === "lesson" ? <span className={styles.teachBadge}>THIS IS THE SHAPE</span> : null}
      {highlight === "agent" && beforeEnv ? (
        <span className={`${styles.teachBadge} ${styles.teachBadgeAgent}`}>
          {agentBadgeCopy(beforeEnv, env)}
        </span>
      ) : null}
    </div>
  );
}

/** Figma copy pattern: "CHANGED BY AGENT · SUSTAIN 80% → 20%". */
function agentBadgeCopy(before: AmpEnvelope, after: AmpEnvelope): string {
  const moved = ENVELOPE_PARAM_IDS.filter((param) => before[param] !== after[param]);
  if (moved.length === 0) return "CHANGED BY AGENT";
  const shown = moved
    .slice(0, 2)
    .map((param) => {
      const def = PARAM_DEFS[param];
      return `${STAGE_NAME[param]} ${def.format(before[param])} → ${def.format(after[param])}`;
    })
    .join("  ·  ");
  const rest = moved.length - 2;
  return `CHANGED BY AGENT  ·  ${shown}${rest > 0 ? `  ·  +${rest} MORE` : ""}`;
}
