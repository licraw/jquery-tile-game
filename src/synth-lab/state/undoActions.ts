import { dispatch } from "./commands";
import { receiptForRedo, receiptForUndo } from "./receipts";
import { uiStore } from "./uiStore";

/**
 * Shared undo/redo entry points (keyboard, agent card, WebMCP tool) so every
 * path emits the same restoration receipt. Undo never asks for confirmation.
 */
export function performUndo(): boolean {
  const result = dispatch({ type: "undo" });
  if (!result.ok || !result.transaction) return false;
  const receipt = receiptForUndo(result.transaction);
  uiStore.showReceipt(receipt.message, receipt.detail);
  return true;
}

export function performRedo(): boolean {
  const result = dispatch({ type: "redo" });
  if (!result.ok || !result.transaction) return false;
  const receipt = receiptForRedo(result.transaction);
  uiStore.showReceipt(receipt.message, receipt.detail);
  return true;
}
