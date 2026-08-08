import type { Project } from "./types";

/**
 * Inverse-patch transaction history (plan §12). One transaction per user
 * gesture (slider drags coalesce), one per agent/lesson patch regardless of
 * parameter count. Single shared stack, depth 100. Session-only.
 */
export type ChangePath = (string | number)[];

export interface Change {
  path: ChangePath;
  before: unknown;
  after: unknown;
}

export type TransactionOrigin = "user" | "lesson" | "agent";

export interface Transaction {
  id: string;
  origin: TransactionOrigin;
  /** Human-readable label, e.g. "Bass · Brightness". */
  label: string;
  changes: Change[];
  at: number;
}

const HISTORY_DEPTH = 100;
const COALESCE_IDLE_MS = 500;

interface OpenGesture {
  coalesceKey: string;
  /** Project snapshot before the first event of the gesture. */
  baseBefore: Project;
  lastTouch: number;
}

let undoStack: Transaction[] = [];
let redoStack: Transaction[] = [];
let openGesture: OpenGesture | null = null;
let txnCounter = 0;
let suppressed = false;

/**
 * Batch support: while suppressed, individual command dispatches record no
 * transactions; the batch caller records one transaction over the whole
 * span (agent tools: "one card per user-visible action").
 */
export function setRecordingSuppressed(value: boolean): void {
  suppressed = value;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Structural diff producing leaf-level inverse patches. */
export function diffValue(before: unknown, after: unknown, path: ChangePath, out: Change[]): void {
  if (Object.is(before, after)) return;
  if (Array.isArray(before) && Array.isArray(after) && before.length === after.length) {
    for (let i = 0; i < before.length; i += 1) {
      diffValue(before[i], after[i], [...path, i], out);
    }
    return;
  }
  if (isPlainObject(before) && isPlainObject(after)) {
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    keys.forEach((key) => {
      diffValue(before[key], after[key], [...path, key], out);
    });
    return;
  }
  out.push({ path, before, after });
}

export function diffProject(before: Project, after: Project): Change[] {
  const out: Change[] = [];
  diffValue(before, after, [], out);
  return out;
}

function cloneContainer<T>(value: T): T {
  if (Array.isArray(value)) return [...value] as T;
  if (isPlainObject(value)) return { ...value } as T;
  throw new Error(`Cannot apply patch through non-container value at ${String(value)}`);
}

function setAtPath<T>(root: T, path: ChangePath, value: unknown): T {
  if (path.length === 0) return value as T;
  const next = cloneContainer(root) as Record<string | number, unknown>;
  const [head, ...rest] = path;
  next[head] = setAtPath(next[head], rest, value);
  return next as T;
}

function applyChanges(project: Project, changes: Change[], direction: "undo" | "redo"): Project {
  return changes.reduce(
    (acc, change) => setAtPath(acc, change.path, direction === "undo" ? change.before : change.after),
    project
  );
}

export interface RecordMeta {
  origin: TransactionOrigin;
  label: string;
  /** Present for slider-drag style bursts that should merge into one step. */
  coalesceKey?: string;
}

/** Records a committed mutation; returns the transaction (merged or new). */
export function recordTransaction(before: Project, after: Project, meta: RecordMeta): Transaction | null {
  if (suppressed) return null;
  const now = Date.now();
  if (
    meta.coalesceKey &&
    openGesture &&
    openGesture.coalesceKey === meta.coalesceKey &&
    now - openGesture.lastTouch <= COALESCE_IDLE_MS &&
    undoStack.length > 0
  ) {
    const top = undoStack[undoStack.length - 1];
    const changes = diffProject(openGesture.baseBefore, after);
    openGesture.lastTouch = now;
    if (changes.length === 0) {
      // Drag returned to its starting value — drop the transaction entirely.
      undoStack = undoStack.slice(0, -1);
      openGesture = null;
      return null;
    }
    const merged: Transaction = { ...top, changes, at: now };
    undoStack = [...undoStack.slice(0, -1), merged];
    redoStack = [];
    return merged;
  }

  const changes = diffProject(before, after);
  if (changes.length === 0) return null;

  txnCounter += 1;
  const txn: Transaction = {
    id: `txn-${now.toString(36)}-${txnCounter}`,
    origin: meta.origin,
    label: meta.label,
    changes,
    at: now
  };
  undoStack = [...undoStack, txn].slice(-HISTORY_DEPTH);
  redoStack = [];
  openGesture = meta.coalesceKey ? { coalesceKey: meta.coalesceKey, baseBefore: before, lastTouch: now } : null;
  return txn;
}

/** Closes any open slider-drag gesture (pointer-up / blur). */
export function commitGesture(): void {
  openGesture = null;
}

export function canUndo(): boolean {
  return undoStack.length > 0;
}

export function canRedo(): boolean {
  return redoStack.length > 0;
}

export interface UndoResult {
  project: Project;
  transaction: Transaction;
}

export function undoTransaction(project: Project): UndoResult | null {
  const txn = undoStack[undoStack.length - 1];
  if (!txn) return null;
  openGesture = null;
  undoStack = undoStack.slice(0, -1);
  redoStack = [...redoStack, txn];
  return { project: applyChanges(project, txn.changes, "undo"), transaction: txn };
}

export function redoTransaction(project: Project): UndoResult | null {
  const txn = redoStack[redoStack.length - 1];
  if (!txn) return null;
  openGesture = null;
  redoStack = redoStack.slice(0, -1);
  undoStack = [...undoStack, txn];
  return { project: applyChanges(project, txn.changes, "redo"), transaction: txn };
}

export function getUndoStack(): Transaction[] {
  return undoStack;
}

/** Test/dev helper — history is session-only state. */
export function resetHistory(): void {
  undoStack = [];
  redoStack = [];
  openGesture = null;
}
