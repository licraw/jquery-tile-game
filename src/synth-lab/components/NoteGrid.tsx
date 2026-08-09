"use client";

import { useEffect, useRef, type KeyboardEvent } from "react";
import { BarSelector } from "@/synth-lab/components/BarSelector";
import { dispatch } from "@/synth-lab/state/commands";
import { usePlayheadStep } from "@/synth-lab/state/playheadStore";
import { useSynthLabState } from "@/synth-lab/state/projectStore";
import {
  BAR_COUNT,
  CHORD_IDS,
  DRUM_LANES,
  STEPS_PER_BAR,
  absoluteStep,
  barOfStep,
  chordAtStep,
  noteRowLabels,
  stepWithinBar,
  type ChordId,
  type DrumLaneId,
  type TrackId
} from "@/synth-lab/state/types";
import { uiStore, useVisibleBar } from "@/synth-lab/state/uiStore";
import styles from "@/synth-lab/styles.module.css";

/**
 * Note Grid (Figma 101:265): rows change meaning per track, columns are the
 * 16 steps of ONE bar of the two-bar loop — the visible bar is chosen by the
 * BAR selector in the header and shared by all four tracks. Patterns are
 * stored as 32 absolute steps; only this component pages them.
 * Lives only in the focused editor.
 * - Drums: four instrument lanes; taps cycle off → on → accent → off.
 * - Bass/Lead: eight scale rows, one note per column (monophony visible).
 * - Pads: four diatonic chords; a chord holds (Held cells) until replaced.
 * The playhead column is aria-hidden decoration, never cell state for AT.
 */

const DRUM_LANE_LABELS: Record<DrumLaneId, string> = {
  kick: "Kick",
  snare: "Snare",
  hat: "Hat",
  perc: "Perc"
};

interface GridRowModel {
  key: string;
  label: string;
  /** Row index in pattern terms (drum lane index / scale row / chord row). */
  cells: {
    state: "off" | "on" | "accent" | "note" | "held";
    /** Accessible state description. */
    stateLabel: string;
    onToggle: () => void;
  }[];
}

function useGridModel(trackId: TrackId): { rows: GridRowModel[]; eyebrow: string; note: string } {
  const pattern = useSynthLabState((s) => s.project.tracks[trackId].pattern);

  if (pattern.kind === "drums") {
    // Top→bottom: kick, snare, hat, perc (any number can fire in a column).
    const rows = DRUM_LANES.map((lane) => ({
      key: lane,
      label: DRUM_LANE_LABELS[lane],
      cells: pattern.lanes[lane].map((value, step) => ({
        state: value,
        stateLabel: value,
        onToggle: () => dispatch({ type: "cycleDrumStep", lane, step })
      }))
    }));
    return {
      rows,
      eyebrow: "SOUNDS  ·  KICK / SNARE / HAT / PERC",
      note: "Sounds can stack — any of them can fire on the same step"
    };
  }

  if (pattern.kind === "notes") {
    const noteTrackId = trackId as "bass" | "lead";
    const labels = noteRowLabels(noteTrackId);
    // Render top→bottom = highest row first.
    const rows = [...labels.keys()].reverse().map((row) => ({
      key: labels[row],
      label: labels[row],
      cells: pattern.steps.map((activeRow, step) => {
        const isOn = activeRow === row;
        return {
          state: (isOn ? "note" : "off") as "note" | "off",
          stateLabel: isOn ? "on" : "off",
          onToggle: () => dispatch({ type: "setStepNote", trackId: noteTrackId, step, row: isOn ? null : row })
        };
      })
    }));
    return {
      rows,
      eyebrow: "NOTES  ·  C MINOR  ·  ONE OCTAVE",
      note: `One note per step — the ${trackId} plays one at a time`
    };
  }

  // Pads: rows bottom→top are Fm, Eb, Ab, Cm → render top→bottom Cm..Fm.
  const chordRows = [...CHORD_IDS]; // ["Cm","Ab","Eb","Fm"] top→bottom
  const rows = chordRows.map((chord: ChordId) => ({
    key: chord,
    label: chord,
    cells: pattern.steps.map((startChord, step) => {
      const isStart = startChord === chord;
      const holding = !isStart && startChord === null ? chordAtStep(pattern.steps, step) : null;
      const isHeld = holding !== null && holding.chord === chord;
      return {
        state: (isStart ? "note" : isHeld ? "held" : "off") as "note" | "held" | "off",
        stateLabel: isStart ? "chord start" : isHeld ? "held" : "off",
        onToggle: () => {
          if (isStart) {
            dispatch({ type: "setStepChord", step, chord: null });
          } else if (isHeld && holding) {
            // Clicking a Held cell moves the chord that owns it (Figma rule).
            dispatch({ type: "setStepChord", step: holding.startStep, chord: null });
            dispatch({ type: "setStepChord", step, chord });
          } else {
            dispatch({ type: "setStepChord", step, chord });
          }
        }
      };
    })
  }));
  return {
    rows,
    eyebrow: "CHORDS  ·  C MINOR",
    note: "A chord holds until the next one replaces it"
  };
}

export function NoteGrid({ trackId }: { trackId: TrackId }) {
  const { rows, eyebrow, note } = useGridModel(trackId);
  const playheadStep = usePlayheadStep();
  const visibleBar = useVisibleBar();
  const gridRef = useRef<HTMLDivElement>(null);
  const focusPos = useRef<{ row: number; col: number }>({ row: 0, col: 0 });
  // Set when an arrow key walks off the edge of the visible bar: the cell to
  // focus once the newly selected bar has rendered.
  const pendingFocus = useRef<{ row: number; col: number } | null>(null);

  // The playhead only exists on screen while the bar it is in is the one being
  // shown; otherwise the grid renders no playhead at all rather than a stale one.
  const localPlayhead =
    playheadStep !== null && barOfStep(playheadStep) === visibleBar ? stepWithinBar(playheadStep) : null;

  function focusCell(row: number, col: number) {
    gridRef.current
      ?.querySelector<HTMLButtonElement>(`[data-row="${row}"][data-col="${col}"]`)
      ?.focus();
  }

  useEffect(() => {
    const target = pendingFocus.current;
    if (!target) return;
    pendingFocus.current = null;
    focusCell(target.row, target.col);
  }, [visibleBar]);

  // Roving tabindex + arrow-key navigation across the grid (plan §17).
  // Walking past either end of a bar pages to the neighbouring bar, so the
  // whole 32-step loop is reachable from the keyboard without leaving the grid.
  function moveFocus(row: number, col: number) {
    const clampedRow = Math.min(rows.length - 1, Math.max(0, row));
    const outOfBar = col < 0 || col >= STEPS_PER_BAR;
    const nextBar = visibleBar + (col < 0 ? -1 : 1);

    if (outOfBar && nextBar >= 0 && nextBar < BAR_COUNT) {
      const wrappedCol = col < 0 ? STEPS_PER_BAR - 1 : 0;
      focusPos.current = { row: clampedRow, col: wrappedCol };
      pendingFocus.current = { row: clampedRow, col: wrappedCol };
      uiStore.setVisibleBar(nextBar);
      return;
    }

    const clampedCol = Math.min(STEPS_PER_BAR - 1, Math.max(0, col));
    focusPos.current = { row: clampedRow, col: clampedCol };
    focusCell(clampedRow, clampedCol);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const { row, col } = focusPos.current;
    switch (event.key) {
      case "ArrowUp":
        event.preventDefault();
        moveFocus(row - 1, col);
        break;
      case "ArrowDown":
        event.preventDefault();
        moveFocus(row + 1, col);
        break;
      case "ArrowLeft":
        event.preventDefault();
        moveFocus(row, col - 1);
        break;
      case "ArrowRight":
        event.preventDefault();
        moveFocus(row, col + 1);
        break;
      case "Home":
        event.preventDefault();
        moveFocus(row, 0);
        break;
      case "End":
        event.preventDefault();
        moveFocus(row, STEPS_PER_BAR - 1);
        break;
      default:
        break;
    }
  }

  return (
    <div className={styles.noteGrid}>
      <div className={styles.noteGridHeader}>
        <span className={styles.noteGridEyebrow}>{eyebrow}</span>
        <span className={styles.noteGridNote}>{note}</span>
        <BarSelector />
      </div>
      <div className={styles.noteGridBody}>
        <div className={styles.rowLabels} aria-hidden="true">
          <div className={styles.rowLabelSpacer} />
          {rows.map((row) => (
            <div key={row.key} className={styles.rowLabel}>
              {row.label}
            </div>
          ))}
        </div>
        <div className={styles.gridColumns}>
          {/* Beats are numbered 1–4 within the bar on screen, matching how the
              bar is counted out loud, not 1–8 across the loop. */}
          <div className={styles.gridRuler} aria-hidden="true">
            {Array.from({ length: STEPS_PER_BAR }, (_, stepInBar) => {
              const isBeat = stepInBar % 4 === 0;
              const isActiveBeat =
                localPlayhead !== null && isBeat && Math.floor(localPlayhead / 4) === stepInBar / 4;
              return (
                <span
                  key={stepInBar}
                  className={`${styles.gridTick} ${isBeat ? styles.gridTickBeat : ""} ${
                    isActiveBeat ? styles.gridTickActive : ""
                  }`}
                >
                  {isBeat ? stepInBar / 4 + 1 : "·"}
                </span>
              );
            })}
          </div>
          <div
            role="grid"
            aria-label={`${trackId} pattern, bar ${visibleBar + 1} of ${BAR_COUNT}, ${STEPS_PER_BAR} steps`}
            className={styles.gridRows}
            ref={gridRef}
            onKeyDown={onKeyDown}
          >
            {rows.map((row, rowIndex) => (
              <div key={row.key} role="row" className={styles.gridRow}>
                {/* Cells are built for all 32 steps; only the visible bar's
                    slice renders, and each cell keeps its absolute step. */}
                {row.cells
                  .slice(absoluteStep(visibleBar, 0), absoluteStep(visibleBar, 0) + STEPS_PER_BAR)
                  .map((cell, step) => {
                    const isPlayhead = localPlayhead === step;
                    const stateClass =
                      cell.state === "on"
                        ? styles.stepCellOn
                        : cell.state === "accent"
                          ? styles.stepCellAccent
                          : cell.state === "note"
                            ? styles.stepCellNote
                            : cell.state === "held"
                              ? styles.stepCellHeld
                              : "";
                    const isTabStop =
                      focusPos.current.row === rowIndex && focusPos.current.col === step;
                    return (
                      <button
                        key={step}
                        type="button"
                        role="gridcell"
                        data-row={rowIndex}
                        data-col={step}
                        tabIndex={isTabStop ? 0 : -1}
                        className={`${styles.stepCell} ${stateClass} ${isPlayhead ? styles.stepCellPlayhead : ""}`}
                        // Naming the bar keeps the step unambiguous for screen
                        // readers, since step 1 exists in both bars.
                        aria-label={`${row.label}, bar ${visibleBar + 1}, step ${step + 1}, ${cell.stateLabel}`}
                        onClick={cell.onToggle}
                        onFocus={() => {
                          focusPos.current = { row: rowIndex, col: step };
                        }}
                      />
                    );
                  })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
