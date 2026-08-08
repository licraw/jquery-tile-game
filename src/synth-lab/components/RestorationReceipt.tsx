"use client";

import { dispatch } from "@/synth-lab/state/commands";
import { receiptForRedo } from "@/synth-lab/state/receipts";
import { uiStore, useUiState } from "@/synth-lab/state/uiStore";
import styles from "@/synth-lab/styles.module.css";

/**
 * Undo restoration receipt (Figma 72:171): transient, never a dialog. Names
 * the parameter and the restored value, and offers Redo.
 */
export function RestorationReceipt() {
  const receipt = useUiState((s) => s.receipt);
  if (!receipt) return null;

  return (
    <div className={styles.receipt} role="status">
      <div className={styles.receiptCopy}>
        <span className={styles.receiptTitle}>Change undone</span>
        <span className={styles.receiptDetail}>
          {receipt.message}
          {receipt.detail ? `  ·  ${receipt.detail}` : ""}
        </span>
      </div>
      <button
        type="button"
        className={styles.buttonSecondary}
        onClick={() => {
          const result = dispatch({ type: "redo" });
          if (result.ok && result.transaction) {
            const redone = receiptForRedo(result.transaction);
            uiStore.showReceipt(redone.message, redone.detail);
          } else {
            uiStore.dismissReceipt();
          }
        }}
      >
        Redo
      </button>
    </div>
  );
}
