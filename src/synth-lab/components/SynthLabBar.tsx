"use client";

import { useState } from "react";
import { dispatch } from "@/synth-lab/state/commands";
import { useSynthLabState } from "@/synth-lab/state/projectStore";
import { useUiState } from "@/synth-lab/state/uiStore";
import styles from "@/synth-lab/styles.module.css";
import { ConfirmDialog } from "./ConfirmDialog";
import { TRACK_META } from "./trackMeta";

interface SynthLabBarProps {
  audioStarted: boolean;
  chipLabel: string;
}

/**
 * Synth Lab Bar (Figma 32:15): identity, mode chip, project actions.
 * Reset patch is small and recoverable; Reset project is destructive and
 * keeps concept mastery (Figma reset dialog contract).
 */
export function SynthLabBar({ audioStarted, chipLabel }: SynthLabBarProps) {
  const selectedTrackId = useSynthLabState((s) => s.selectedTrackId);
  const agentStatus = useUiState((s) => s.agentStatus);
  const [dialog, setDialog] = useState<"reset-patch" | "reset-project" | "help" | null>(null);
  const synthSelected = selectedTrackId !== "drums";
  const trackName = TRACK_META[selectedTrackId].name;

  return (
    <header className={styles.bar}>
      <div className={styles.barIdentity}>
        <h1 className={styles.barTitle}>Synth Lab</h1>
        <span className={styles.modeChip}>{audioStarted ? chipLabel : "AUDIO NOT STARTED"}</span>
        {agentStatus !== "absent" ? (
          <span className={`${styles.modeChip} ${styles.modeChipAgent}`}>
            <span
              className={`${styles.agentDot} ${agentStatus === "working" ? styles.agentDotPulse : ""}`}
              aria-hidden="true"
            />
            {agentStatus === "working" ? "AGENT WORKING…" : "AGENT CONNECTED"}
          </span>
        ) : null}
      </div>
      <div className={styles.barActions}>
        <button
          type="button"
          className={styles.barAction}
          disabled={!synthSelected}
          style={synthSelected ? undefined : { opacity: 0.45, cursor: "default" }}
          onClick={() => setDialog("reset-patch")}
        >
          Reset patch
        </button>
        <button type="button" className={styles.barAction} onClick={() => setDialog("reset-project")}>
          Reset project
        </button>
        <button type="button" className={styles.barAction} onClick={() => setDialog("help")}>
          Help
        </button>
      </div>

      {dialog === "reset-patch" && synthSelected ? (
        <ConfirmDialog
          title={`Reset the ${trackName} patch?`}
          body={`Waveform, envelope and filter settings on ${trackName} go back to their defaults. The pattern stays, and you can undo this.`}
          confirmLabel="Reset patch"
          danger={false}
          onConfirm={() => {
            dispatch({ type: "resetPatch", trackId: selectedTrackId as "bass" | "pads" | "lead" });
            setDialog(null);
          }}
          onCancel={() => setDialog(null)}
        />
      ) : null}

      {dialog === "reset-project" ? (
        <ConfirmDialog
          title="Reset the whole project?"
          body="Every pattern, patch, tempo and level goes back to the starting jam. Concept mastery is yours — it stays. You can undo this."
          confirmLabel="Reset project"
          danger
          onConfirm={() => {
            dispatch({ type: "resetProject" });
            setDialog(null);
          }}
          onCancel={() => setDialog(null)}
        />
      ) : null}

      {dialog === "help" ? (
        <ConfirmDialog
          title="How Synth Lab works"
          body="Four tracks loop two bars, forever. Select a lane to edit its pattern and sound — the loop keeps playing while you change things, and BAR 1 / BAR 2 switches which bar the grid is showing without interrupting it. The coach card on the right offers challenges; Free Play is always one click away. Every change can be undone."
          confirmLabel="Got it"
          danger={false}
          onConfirm={() => setDialog(null)}
          onCancel={() => setDialog(null)}
        />
      ) : null}
    </header>
  );
}
