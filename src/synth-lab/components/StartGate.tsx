"use client";

import { useEffect, useRef } from "react";
import styles from "@/synth-lab/styles.module.css";

interface StartGateProps {
  starting: boolean;
  error: string | null;
  onStart: (mode: "challenge" | "free") => void;
}

/**
 * Start Gate (Figma 48:459): the only audio initializer. Both actions are the
 * required user gesture; "Skip to free play" starts audio too but lands in
 * Free Play instead of Challenge 0.
 */
export function StartGate({ starting, error, onStart }: StartGateProps) {
  const startRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    startRef.current?.focus();
  }, []);

  return (
    <div className={styles.gateOverlay}>
      <section className={styles.gate} role="dialog" aria-label="Start Synth Lab">
        <h2 className={styles.gateTitle}>Make something first.</h2>
        <p className={styles.gateBody}>
          Four tracks are already loaded and looping. Start the audio, listen once, then change one
          control and hear exactly what it did. Browsers will not make sound until you ask them to —
          this is that ask.
        </p>
        <div className={styles.gateActions}>
          <button
            ref={startRef}
            type="button"
            className={styles.buttonPrimary}
            disabled={starting}
            onClick={() => onStart("challenge")}
          >
            {starting ? "Starting…" : "Start Synth Lab"}
          </button>
          <button
            type="button"
            className={styles.buttonSecondary}
            disabled={starting}
            onClick={() => onStart("free")}
          >
            Skip to free play
          </button>
        </div>
        {error ? <p className={styles.gateError}>{error}</p> : null}
      </section>
    </div>
  );
}
