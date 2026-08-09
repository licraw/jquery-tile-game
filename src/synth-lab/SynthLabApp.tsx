"use client";

import { useCallback, useEffect, useState } from "react";
import { challengeChipLabel, LessonCard } from "@/synth-lab/components/LessonCard";
import { ConceptMastery } from "@/synth-lab/components/ConceptMastery";
import { StartGate } from "@/synth-lab/components/StartGate";
import { Transport } from "@/synth-lab/components/Transport";
import { TrackEditor } from "@/synth-lab/components/TrackEditor";
import { TrackLaneList } from "@/synth-lab/components/TrackLaneList";
import { SynthLabBar } from "@/synth-lab/components/SynthLabBar";
import { RestorationReceipt } from "@/synth-lab/components/RestorationReceipt";
import { attachLessonEngine, enterFreePlay, startChallenge } from "@/synth-lab/lessons/lessonEngine";
import { dispatch } from "@/synth-lab/state/commands";
import { useSynthLabState } from "@/synth-lab/state/projectStore";
import { performRedo, performUndo } from "@/synth-lab/state/undoActions";
import styles from "@/synth-lab/styles.module.css";

type EngineModule = typeof import("@/synth-lab/engine/SynthLabEngine");

// Module-level so React Strict Mode double-mounts share one engine lifecycle.
let engineModule: EngineModule | null = null;
let audioStartedGlobal = false;
let pendingDispose: ReturnType<typeof setTimeout> | null = null;

function cancelScheduledDispose(): void {
  if (pendingDispose) {
    clearTimeout(pendingDispose);
    pendingDispose = null;
  }
}

function scheduleDispose(): void {
  cancelScheduledDispose();
  // Deferred so a Strict Mode remount can cancel it; only a real route
  // unmount lets it fire (plan §11 generation guard).
  pendingDispose = setTimeout(() => {
    pendingDispose = null;
    engineModule?.disposeEngine();
    audioStartedGlobal = false;
  }, 0);
}

export function SynthLabApp() {
  const [audioStarted, setAudioStarted] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [sampleWarning, setSampleWarning] = useState<string | null>(null);
  const activeChallengeId = useSynthLabState((s) => s.lessons.activeChallengeId);

  useEffect(() => {
    cancelScheduledDispose();
    if (audioStartedGlobal) setAudioStarted(true);
    const detachLessons = attachLessonEngine();
    function onKeyDown(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "z") return;
      event.preventDefault();
      if (event.shiftKey) {
        performRedo();
      } else {
        performUndo();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      detachLessons();
      scheduleDispose();
    };
  }, []);

  const startAudio = useCallback(async (mode: "challenge" | "free"): Promise<boolean> => {
    setStarting(true);
    setStartError(null);
    try {
      // Dynamic import keeps Tone (~150 KB) out of the route's initial JS.
      engineModule = engineModule ?? (await import("@/synth-lab/engine/SynthLabEngine"));
      const engine = await engineModule.startEngine();
      audioStartedGlobal = true;
      setAudioStarted(true);
      // WebMCP registration stays behind the command layer; no-ops when the
      // browser has no modelContext (plan §14).
      const { registerWebMcpTools } = await import("@/synth-lab/webmcp/registerTools");
      registerWebMcpTools();
      const failed = Object.entries(engine.sampleStatus)
        .filter(([, status]) => status === "error")
        .map(([lane]) => lane);
      setSampleWarning(
        failed.length > 0
          ? `Some sounds failed to load (${failed.join(", ")}) — those lanes will be silent this visit.`
          : null
      );
      if (mode === "free") {
        enterFreePlay();
      } else if (!activeChallengeId) {
        startChallenge("challenge-0");
      }
      dispatch({ type: "play" });
      return true;
    } catch {
      setStartError("Audio could not start. Check the tab's sound permissions and try again.");
      return false;
    } finally {
      setStarting(false);
    }
  }, [activeChallengeId]);

  // Transport play before the gate was dismissed is still a user gesture —
  // route it through the same start flow so audio never plays un-gated.
  const requestPlay = useCallback(() => {
    if (audioStartedGlobal) {
      dispatch({ type: "play" });
    } else {
      void startAudio("challenge");
    }
  }, [startAudio]);

  return (
    <main className={styles.app}>
      <SynthLabBar audioStarted={audioStarted} chipLabel={challengeChipLabel(activeChallengeId)} />
      <div className={styles.body}>
        <Transport onRequestPlay={requestPlay} />
        {sampleWarning ? <p className={styles.gateError}>{sampleWarning}</p> : null}
        <div className={styles.workspace}>
          <div className={styles.workspaceMain}>
            <TrackLaneList />
            <TrackEditor />
          </div>
          <div className={styles.coachRail}>
            <LessonCard audioStarted={audioStarted} />
            <ConceptMastery />
          </div>
        </div>
      </div>
      {!audioStarted ? (
        <StartGate starting={starting} error={startError} onStart={(mode) => void startAudio(mode)} />
      ) : null}
      <RestorationReceipt />
    </main>
  );
}
