"use client";

import { useEffect, useRef } from "react";
import styles from "@/synth-lab/styles.module.css";

interface ConfirmDialogProps {
  title: string;
  body: string;
  confirmLabel: string;
  danger: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Shared confirmation dialog following the DS V1 Dialog pattern (labelled
 * modal, title/body/buttons) used by the reset flows.
 */
export function ConfirmDialog({ title, body, confirmLabel, danger, onConfirm, onCancel }: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    confirmRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div className={styles.dialogOverlay} onClick={onCancel}>
      <div
        className={styles.dialog}
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className={styles.dialogTitle}>{title}</h2>
        <p className={styles.dialogBody}>{body}</p>
        <div className={styles.gateActions}>
          <button
            ref={confirmRef}
            type="button"
            className={danger ? styles.buttonDanger : styles.buttonPrimary}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
          <button type="button" className={styles.buttonSecondary} onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
