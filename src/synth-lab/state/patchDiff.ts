import type { Transaction } from "./history";
import type { SynthPatch, SynthTrackId } from "./types";

/**
 * Rebuilds the patch as it stood before a transaction, from that transaction's
 * inverse patches. Used by the Agent Action Card's "Hear before" audition and
 * by the ADSR Envelope's ghost curve, so both show the same "before" without
 * either of them storing one.
 */
export function beforePatchFor(
  trackId: SynthTrackId,
  txn: Transaction,
  current: SynthPatch
): SynthPatch {
  const patch: SynthPatch = { ...current, ampEnv: { ...current.ampEnv } };
  for (const change of txn.changes) {
    const [tracks, id, patchKey, ...rest] = change.path;
    if (tracks !== "tracks" || id !== trackId || patchKey !== "patch") continue;
    if (rest[0] === "ampEnv" && typeof rest[1] === "string") {
      (patch.ampEnv as unknown as Record<string, unknown>)[rest[1]] = change.before;
    } else if (typeof rest[0] === "string") {
      (patch as unknown as Record<string, unknown>)[rest[0]] = change.before;
    }
  }
  return patch;
}
