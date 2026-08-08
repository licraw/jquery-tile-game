"use client";

import { useState } from "react";
import { ESSENTIAL_PARAM_IDS, MORE_PARAM_IDS, type SynthParamId } from "@/synth-lab/engine/paramMap";
import { useSynthLabState } from "@/synth-lab/state/projectStore";
import { useUiState } from "@/synth-lab/state/uiStore";
import type { SynthTrackId } from "@/synth-lab/state/types";
import styles from "@/synth-lab/styles.module.css";
import { AgentActionCard } from "./AgentActionCard";
import { ConceptHighlight } from "./ConceptHighlight";
import { NoteGrid } from "./NoteGrid";
import { ParameterSlider } from "./ParameterSlider";
import { TRACK_META, toneStyle } from "./trackMeta";
import { VoicesControl } from "./VoicesControl";
import { WaveformSelector } from "./WaveformSelector";

/**
 * Selected Track Editor (Figma 32:154): header (name, voice chip, "other
 * tracks keep playing"), NoteGrid, oscillator group, parameter sliders with
 * the "+ More" disclosure. Drums are pattern-only by design.
 */
export function TrackEditor() {
  const trackId = useSynthLabState((s) => s.selectedTrackId);
  const highlight = useUiState((s) => s.highlight);
  const agentCardActionId = useUiState((s) => s.agentCardActionId);
  const agentActivity = useSynthLabState((s) => s.agentActivity);
  const [moreOpen, setMoreOpen] = useState(false);
  const meta = TRACK_META[trackId];
  const isSynth = trackId !== "drums";
  const synthTrackId = trackId as SynthTrackId;

  // Parameters the currently-shown agent action changed get the "Agent
  // changed" treatment, so the control and the card tell the same story.
  const agentChangedParams = new Set(
    (agentCardActionId
      ? agentActivity.find((action) => action.id === agentCardActionId && action.trackId === trackId)?.changes ?? []
      : []
    ).map((change) => change.path.split(".").pop() ?? "")
  );

  function paramHighlight(param: SynthParamId | "waveform" | "voices"): "lesson" | "agent" | null {
    if (agentChangedParams.has(param)) return "agent";
    if (!highlight || highlight.trackId !== trackId) return null;
    if (highlight.param !== param) return null;
    return highlight.treatment === "agentChanged" ? "agent" : "lesson";
  }

  return (
    <section className={styles.editor} style={toneStyle(trackId)} aria-label={`${meta.name} editor`}>
      <div className={styles.editorHeader}>
        <div className={styles.editorHeaderLeft}>
          <h2 className={styles.editorTitle}>{meta.name}</h2>
          <span className={styles.voiceChip}>{meta.voiceChip}</span>
        </div>
        <span className={styles.editorHint}>
          {"Editing the selected track  ·  other tracks keep playing"}
        </span>
      </div>

      <NoteGrid trackId={trackId} />

      <AgentActionCard trackId={trackId} />
      <ConceptHighlight trackId={trackId} />

      {isSynth ? (
        <>
          <div
            className={`${styles.editorGroup} ${
              paramHighlight("waveform") === "lesson"
                ? styles.groupHighlighted
                : paramHighlight("waveform") === "agent"
                  ? styles.groupHighlightedAgent
                  : ""
            }`}
          >
            <span className={styles.groupLabel}>{"OSCILLATOR  ·  THE STARTING WAVEFORM"}</span>
            <WaveformSelector trackId={synthTrackId} />
            {paramHighlight("waveform") === "lesson" ? (
              <span className={styles.teachBadge}>THIS IS THE CONTROL</span>
            ) : null}
          </div>

          {trackId === "pads" ? (
            <div
              className={`${styles.editorGroup} ${
                paramHighlight("voices") === "lesson"
                  ? styles.groupHighlighted
                  : paramHighlight("voices") === "agent"
                    ? styles.groupHighlightedAgent
                    : ""
              }`}
            >
              <span className={styles.groupLabel}>{"VOICES  ·  HOW MANY NOTES AT ONCE"}</span>
              <VoicesControl trackId="pads" />
              {paramHighlight("voices") === "lesson" ? (
                <span className={styles.teachBadge}>THIS IS THE CONTROL</span>
              ) : null}
            </div>
          ) : null}

          <div className={styles.parameters}>
            {ESSENTIAL_PARAM_IDS.map((param) => (
              <ParameterSlider
                key={param}
                trackId={synthTrackId}
                param={param}
                highlight={paramHighlight(param)}
              />
            ))}
            {moreOpen
              ? MORE_PARAM_IDS.map((param) => (
                  <ParameterSlider
                    key={param}
                    trackId={synthTrackId}
                    param={param}
                    highlight={paramHighlight(param)}
                  />
                ))
              : null}
          </div>

          <button
            type="button"
            className={styles.moreToggle}
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen((open) => !open)}
          >
            {moreOpen
              ? "− Less  ·  every parameter on this track is showing"
              : "+ More  ·  sustain, release, filter envelope amount, octave"}
          </button>
        </>
      ) : null}
    </section>
  );
}
