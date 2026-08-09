"use client";

import { useState, type ReactNode } from "react";
import {
  ENVELOPE_PARAM_IDS,
  groupsForTrack,
  locateControl,
  type GroupControlId,
  type ParameterGroupDef,
  type ParameterGroupId
} from "@/synth-lab/engine/paramGroups";
import { type SynthParamId } from "@/synth-lab/engine/paramMap";
import { useSynthLabState } from "@/synth-lab/state/projectStore";
import { useUiState } from "@/synth-lab/state/uiStore";
import type { SynthTrackId } from "@/synth-lab/state/types";
import styles from "@/synth-lab/styles.module.css";
import { AgentActionCard } from "./AgentActionCard";
import { ConceptHighlight } from "./ConceptHighlight";
import { EnvelopeEditor } from "./EnvelopeEditor";
import { NoteGrid } from "./NoteGrid";
import { ParameterGroup } from "./ParameterGroup";
import { ParameterSlider } from "./ParameterSlider";
import { TRACK_META, toneStyle } from "./trackMeta";
import { VoicesControl } from "./VoicesControl";
import { WaveformSelector } from "./WaveformSelector";

type ControlHighlight = "lesson" | "agent" | null;

interface DisclosureState {
  expanded: boolean;
  moreOpen: boolean;
}

/** Groups open, secondary parameters closed — the design's default order of usefulness. */
const DEFAULT_DISCLOSURE: DisclosureState = { expanded: true, moreOpen: false };

/**
 * Selected Track Editor (Figma 32:154): header (name, voice chip, "other
 * tracks keep playing"), NoteGrid, then the parameter groups from
 * `paramGroups.ts` — Oscillator, Voices, Amp Envelope, Filter. Drums are
 * pattern-only by design.
 *
 * Disclosure is component state, never a command: there is no "open the group"
 * in the domain model. A lesson or agent pointing at a hidden parameter opens
 * the group holding it rather than highlighting something nobody can see.
 */
export function TrackEditor() {
  const trackId = useSynthLabState((s) => s.selectedTrackId);
  const highlight = useUiState((s) => s.highlight);
  const agentCardActionId = useUiState((s) => s.agentCardActionId);
  const agentActivity = useSynthLabState((s) => s.agentActivity);
  const [disclosure, setDisclosure] = useState<Partial<Record<ParameterGroupId, DisclosureState>>>({});
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

  function paramHighlight(param: GroupControlId): ControlHighlight {
    if (agentChangedParams.has(param)) return "agent";
    if (!highlight || highlight.trackId !== trackId) return null;
    if (highlight.param !== param) return null;
    return highlight.treatment === "agentChanged" ? "agent" : "lesson";
  }

  /**
   * Groups a lesson or an agent is currently pointing into. A group holding a
   * targeted control opens even if the user collapsed it, and its "+ More"
   * tier opens when the target lives there.
   */
  const targetedGroups = new Set<ParameterGroupId>();
  const targetedMore = new Set<ParameterGroupId>();
  if (isSynth) {
    const targets: GroupControlId[] = [...agentChangedParams] as GroupControlId[];
    if (highlight && highlight.trackId === trackId) targets.push(highlight.param);
    for (const control of targets) {
      const location = locateControl(synthTrackId, control);
      if (!location) continue;
      targetedGroups.add(location.groupId);
      if (location.secondary) targetedMore.add(location.groupId);
    }
  }

  function disclosureFor(group: ParameterGroupDef): DisclosureState {
    const stored = disclosure[group.id] ?? DEFAULT_DISCLOSURE;
    return {
      expanded: stored.expanded || targetedGroups.has(group.id),
      moreOpen: stored.moreOpen || targetedMore.has(group.id)
    };
  }

  function updateDisclosure(groupId: ParameterGroupId, patch: Partial<DisclosureState>) {
    setDisclosure((current) => ({
      ...current,
      [groupId]: { ...(current[groupId] ?? DEFAULT_DISCLOSURE), ...patch }
    }));
  }

  function renderControl(control: GroupControlId): ReactNode {
    const state = paramHighlight(control);
    switch (control) {
      case "waveform":
        return (
          <div key="waveform" className={styles.groupControl}>
            <WaveformSelector trackId={synthTrackId} />
            {state === "lesson" ? <span className={styles.teachBadge}>THIS IS THE CONTROL</span> : null}
          </div>
        );
      case "voices":
        return (
          <div key="voices" className={styles.groupControl}>
            <VoicesControl trackId="pads" />
            {state === "lesson" ? <span className={styles.teachBadge}>THIS IS THE CONTROL</span> : null}
          </div>
        );
      case "ampEnvelope":
        return (
          <EnvelopeEditor
            key="ampEnvelope"
            trackId={synthTrackId}
            highlight={envelopeHighlight(paramHighlight)}
          />
        );
      default:
        return (
          <ParameterSlider
            key={control}
            trackId={synthTrackId}
            param={control as SynthParamId}
            highlight={state}
          />
        );
    }
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
        <div className={styles.parameterGroups}>
          {groupsForTrack(synthTrackId).map((group) => {
            const { expanded, moreOpen } = disclosureFor(group);
            // Waveform and Voices have no highlighted state of their own, so
            // the group carries the treatment for them. Sliders and the
            // envelope highlight themselves — outlining both would double it.
            const groupHighlight =
              group.controls.includes("waveform") || group.controls.includes("voices")
                ? paramHighlight(group.controls[0])
                : null;

            return (
              <ParameterGroup
                key={group.id}
                title={group.title}
                technical={group.technical}
                chip={group.chip}
                summary={group.summary}
                expanded={expanded}
                onToggle={(next) => updateDisclosure(group.id, { expanded: next })}
                highlight={groupHighlight}
                more={
                  group.more.length > 0 ? (
                    <div className={styles.parameters}>{group.more.map(renderControl)}</div>
                  ) : null
                }
                moreLabel={group.moreLabel}
                moreOpen={moreOpen}
                onToggleMore={(next) => updateDisclosure(group.id, { moreOpen: next })}
              >
                <div className={styles.parameters}>{group.controls.map(renderControl)}</div>
              </ParameterGroup>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

/** The envelope is one control for four parameters — any of them lights it. */
function envelopeHighlight(paramHighlight: (control: GroupControlId) => ControlHighlight): ControlHighlight {
  const states = ENVELOPE_PARAM_IDS.map((param) => paramHighlight(param));
  if (states.includes("agent")) return "agent";
  if (states.includes("lesson")) return "lesson";
  return null;
}
