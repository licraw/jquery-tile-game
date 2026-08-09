"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { commitGesture, dispatch } from "@/synth-lab/state/commands";
import { usePlayheadStep } from "@/synth-lab/state/playheadStore";
import { useSynthLabState } from "@/synth-lab/state/projectStore";
import { BAR_COUNT, STEP_COUNT, barOfStep, stepWithinBar } from "@/synth-lab/state/types";
import styles from "@/synth-lab/styles.module.css";

interface TransportProps {
  onRequestPlay: () => void;
}

/**
 * Collapsed agent activity log (decision C3): lives in the transport because
 * agent changes are project-level state. Appears only once an agent has made
 * at least one change; expanding it is the entry point to history/undo.
 */
function ActivityChip() {
  const agentActivity = useSynthLabState((s) => s.agentActivity);
  const [open, setOpen] = useState(false);
  if (agentActivity.length === 0) return null;

  const label = `${agentActivity.length} agent change${agentActivity.length === 1 ? "" : "s"}`;
  return (
    <div className={styles.activityWrap}>
      <button
        type="button"
        className={styles.activityChip}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={styles.agentDot} aria-hidden="true" />
        {label}
        <span aria-hidden="true">▾</span>
      </button>
      {open ? (
        <div className={styles.activityPopover} role="list" aria-label="Agent activity">
          {[...agentActivity].reverse().map((action) => (
            <div key={action.id} className={styles.activityRow} role="listitem">
              <span className={styles.activityRowLabel}>
                {action.changes.length > 0
                  ? action.changes.map((c) => c.label).join(", ")
                  : action.status === "error"
                    ? "Rejected request"
                    : "Change"}
              </span>
              <span className={styles.activityRowMeta}>
                {(action.trackId ?? "project").toUpperCase()} ·{" "}
                {new Date(action.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} ·{" "}
                {action.status}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Transport (Figma 28:260): 44px play/stop, tempo, loop position, master
 * level. Position renders as loop progress — there is no timeline to scrub.
 * The collapsed agent-activity chip mounts here in the WebMCP phase.
 */
export function Transport({ onRequestPlay }: TransportProps) {
  const transportStatus = useSynthLabState((s) => s.transportStatus);
  const tempoBpm = useSynthLabState((s) => s.project.tempoBpm);
  const masterLevel = useSynthLabState((s) => s.project.masterLevel);
  const step = usePlayheadStep();
  const playing = transportStatus === "playing";

  const [tempoDraft, setTempoDraft] = useState<string | null>(null);

  useEffect(() => {
    setTempoDraft(null);
  }, [tempoBpm]);

  // BAR is the position inside the two-bar loop (1 or 2), not a count of how
  // many times the loop has come round — the loop has no elapsed time to show.
  const bar = step === null ? null : barOfStep(step) + 1;
  const beat = step === null ? null : Math.floor(stepWithinBar(step) / 4) + 1;
  const progress = step === null ? 0 : ((step + 1) / STEP_COUNT) * 100;

  return (
    <div className={styles.transport}>
      <button
        type="button"
        className={`${styles.playButton} ${playing ? styles.playButtonPlaying : ""}`}
        aria-label={playing ? "Stop" : "Play"}
        onClick={() => {
          if (playing) {
            dispatch({ type: "stop" });
          } else {
            onRequestPlay();
          }
        }}
      >
        {playing ? "◼" : "▶"}
      </button>

      <div className={styles.transportTempo}>
        <span className={styles.tempoValue}>
          <input
            className={styles.tempoInput}
            type="number"
            min={60}
            max={180}
            inputMode="numeric"
            aria-label="Tempo in beats per minute, 60 to 180"
            value={tempoDraft ?? String(tempoBpm)}
            onChange={(event) => {
              setTempoDraft(event.target.value);
              const bpm = Number(event.target.value);
              if (Number.isFinite(bpm) && bpm >= 60 && bpm <= 180) {
                dispatch({ type: "setTempo", bpm });
              }
            }}
            onBlur={() => {
              setTempoDraft(null);
              commitGesture();
            }}
          />
          BPM
        </span>
        <span className={styles.transportLabel}>Tempo</span>
      </div>

      <div className={styles.transportPosition}>
        <div className={styles.loopTrack} aria-hidden="true">
          <div className={styles.loopFill} style={{ width: `${progress}%` }} />
          {/* Marks where bar 1 ends, so loop progress reads as two bars. */}
          <div className={styles.loopBarMark} />
        </div>
        <span
          className={`${styles.positionLabel} ${playing ? styles.positionPlaying : styles.positionStopped}`}
          role="status"
        >
          {playing && bar !== null && beat !== null
            ? `BAR ${bar} · BEAT ${beat}   —   LOOPING`
            : `STOPPED   —   ${BAR_COUNT} BAR LOOP`}
        </span>
      </div>

      <ActivityChip />

      <div className={styles.transportMaster}>
        <input
          className={`${styles.range} ${styles.masterRange}`}
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={masterLevel}
          aria-label="Master level"
          aria-valuetext={`${Math.round(masterLevel * 100)} percent`}
          style={{ "--sl-fill": `${masterLevel * 100}%` } as CSSProperties}
          onChange={(event) => dispatch({ type: "setMasterLevel", level: Number(event.target.value) })}
          onPointerUp={commitGesture}
          onBlur={commitGesture}
        />
        <span className={styles.transportLabel}>Master</span>
      </div>
    </div>
  );
}
