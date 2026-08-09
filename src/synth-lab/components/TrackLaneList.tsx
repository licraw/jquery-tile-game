"use client";

import { type CSSProperties } from "react";
import { commitGesture, dispatch } from "@/synth-lab/state/commands";
import { trackStrip } from "@/synth-lab/state/derive";
import { useSynthLabState } from "@/synth-lab/state/projectStore";
import { STEPS_PER_BAR, TRACK_IDS, type TrackId } from "@/synth-lab/state/types";
import styles from "@/synth-lab/styles.module.css";
import { TRACK_META, toneStyle } from "./trackMeta";

/**
 * Track Lanes (Figma 28:231): the four tracks, always visible. Selecting a
 * lane opens it in the editor; it never hides the other three. The pattern
 * strip is a read-only summary derived from the same pattern array.
 */
function TrackLane({ trackId }: { trackId: TrackId }) {
  const selected = useSynthLabState((s) => s.selectedTrackId) === trackId;
  const track = useSynthLabState((s) => s.project.tracks[trackId]);
  const meta = TRACK_META[trackId];
  const strip = trackStrip(track.pattern);

  return (
    <div
      className={`${styles.trackLane} ${selected ? styles.trackLaneSelected : ""}`}
      style={toneStyle(trackId)}
    >
      <div className={styles.toneBar} aria-hidden="true" />
      <button
        type="button"
        className={styles.laneIdentity}
        aria-pressed={selected}
        aria-label={`Select ${meta.name} track for editing`}
        onClick={() => dispatch({ type: "selectTrack", trackId })}
      >
        <span className={styles.laneName}>{meta.name}</span>
        <span className={styles.laneMeta}>{meta.meta}</span>
      </button>
      {/* The strip shows the WHOLE two-bar loop, unlike the editor grid which
          pages one bar — it is the at-a-glance overview, so the extra gap at
          the bar boundary is the only thing needed to read it as two bars. */}
      <div className={styles.laneStrip} aria-hidden="true">
        {strip.map((cell, index) => (
          <span
            key={index}
            className={`${styles.stripCell} ${
              index > 0 && index % STEPS_PER_BAR === 0 ? styles.stripCellBarStart : ""
            } ${cell === "accent" ? styles.stripCellAccent : cell === "on" ? styles.stripCellOn : ""}`}
          />
        ))}
      </div>
      <button
        type="button"
        className={`${styles.muteButton} ${track.muted ? styles.muteButtonActive : ""}`}
        aria-pressed={track.muted}
        aria-label={`Mute ${meta.name}`}
        onClick={() => dispatch({ type: "setTrackMute", trackId, muted: !track.muted })}
      >
        M
      </button>
      <div className={styles.laneLevel}>
        <input
          className={`${styles.range} ${styles.levelRange}`}
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={track.level}
          aria-label={`${meta.name} level`}
          aria-valuetext={`${Math.round(track.level * 100)} percent`}
          style={{ "--sl-fill": `${track.level * 100}%` } as CSSProperties}
          onChange={(event) =>
            dispatch({ type: "setTrackLevel", trackId, level: Number(event.target.value) })
          }
          onPointerUp={commitGesture}
          onBlur={commitGesture}
        />
        <span className={styles.laneLevelLabel}>Level</span>
      </div>
    </div>
  );
}

export function TrackLaneList() {
  return (
    <div className={styles.trackLanes}>
      {TRACK_IDS.map((trackId) => (
        <TrackLane key={trackId} trackId={trackId} />
      ))}
    </div>
  );
}
