import { getEngineIfStarted } from "@/synth-lab/engine/SynthLabEngine";
import { PARAM_DEFS, getParamValue, type SynthParamId } from "@/synth-lab/engine/paramMap";
import { dispatch, dispatchBatch, type CommandResult, type SynthLabCommand } from "@/synth-lab/state/commands";
import { projectStore } from "@/synth-lab/state/projectStore";
import { performUndo } from "@/synth-lab/state/undoActions";
import { uiStore } from "@/synth-lab/state/uiStore";
import {
  SYNTH_TRACK_IDS,
  TRACK_IDS,
  type SynthPatch,
  type SynthTrackId,
  type TrackId
} from "@/synth-lab/state/types";
import { beginAgentAction, completeAgentAction } from "./agentLog";

/**
 * WebMCP adapter (plan §14): semantic tools that are thin wrappers over the
 * command layer — no privileged side doors, every mutation is one history
 * transaction plus one AgentAction entry. Feature-detected; when WebMCP is
 * absent nothing registers and the product is unchanged.
 */
interface ModelContextTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: { readOnlyHint?: boolean };
  execute: (input: unknown) => Promise<{ content: { type: "text"; text: string }[] }>;
}

interface ModelContext {
  registerTool(tool: ModelContextTool): unknown;
}

function getModelContext(): ModelContext | null {
  if (typeof document !== "undefined" && "modelContext" in document) {
    return (document as { modelContext?: ModelContext }).modelContext ?? null;
  }
  // navigator.modelContext is deprecated as of Chrome 150 — still detected.
  if (typeof navigator !== "undefined" && "modelContext" in navigator) {
    return (navigator as { modelContext?: ModelContext }).modelContext ?? null;
  }
  return null;
}

function text(payload: unknown): { content: { type: "text"; text: string }[] } {
  return { content: [{ type: "text", text: JSON.stringify(payload) }] };
}

function trackSlice(trackId: TrackId) {
  const track = projectStore.get().project.tracks[trackId];
  const patch = track.patch;
  return {
    id: trackId,
    muted: track.muted,
    level: track.level,
    pattern: track.pattern,
    patch,
    formattedParams: patch
      ? Object.fromEntries(
          (Object.keys(PARAM_DEFS) as SynthParamId[]).map((id) => [
            id,
            PARAM_DEFS[id].format(getParamValue(patch, id))
          ])
        )
      : null
  };
}

function isTrackId(value: unknown): value is TrackId {
  return typeof value === "string" && (TRACK_IDS as string[]).includes(value);
}

function isSynthTrackId(value: unknown): value is SynthTrackId {
  return typeof value === "string" && (SYNTH_TRACK_IDS as string[]).includes(value);
}

/** Runs a mutating tool call: agent action bookkeeping around the commands. */
function runMutating(
  trackId: TrackId | null,
  reason: string | undefined,
  run: () => CommandResult
): { content: { type: "text"; text: string }[] } {
  const actionId = beginAgentAction(trackId, reason);
  const result = run();
  if (!result.ok) {
    completeAgentAction(actionId, null, result.error);
    return text({ ok: false, error: result.error, hint: "Nothing was changed." });
  }
  completeAgentAction(actionId, result.transaction);
  if (trackId) {
    dispatch({ type: "selectTrack", trackId }, "agent");
  }
  return text({ ok: true, track: trackId ? trackSlice(trackId) : undefined, tempoBpm: projectStore.get().project.tempoBpm });
}

const patchSchema = {
  type: "object",
  properties: {
    waveform: { type: "string", enum: ["sine", "triangle", "sawtooth", "square"] },
    cutoffHz: { type: "number" },
    resonance: { type: "number" },
    filterEnvAmount: { type: "number" },
    octaveOffset: { type: "number", enum: [-1, 0, 1] },
    voices: { type: "number", enum: [1, 2, 4] },
    ampEnv: {
      type: "object",
      properties: {
        attack: { type: "number" },
        decay: { type: "number" },
        sustain: { type: "number" },
        release: { type: "number" }
      }
    }
  }
} as const;

function buildTools(): ModelContextTool[] {
  return [
    {
      name: "get_project_state",
      description:
        "Read the full Synth Lab project: tempo, master level, transport status, all four tracks (patterns, patches, formatted parameter values), selection and lesson progress. Patterns are 32 steps — two bars of sixteenth notes, where steps 0-15 are bar 1 and steps 16-31 are bar 2.",
      inputSchema: { type: "object", properties: {} },
      annotations: { readOnlyHint: true },
      execute: async () => {
        const state = projectStore.get();
        return text({
          tempoBpm: state.project.tempoBpm,
          masterLevel: state.project.masterLevel,
          transportStatus: state.transportStatus,
          selectedTrackId: state.selectedTrackId,
          lessons: state.lessons,
          tracks: Object.fromEntries(TRACK_IDS.map((id) => [id, trackSlice(id)]))
        });
      }
    },
    {
      name: "get_track_state",
      description: "Read one track: pattern, patch, formatted parameter values. track is drums|bass|pads|lead.",
      inputSchema: {
        type: "object",
        properties: { track: { type: "string", enum: TRACK_IDS } },
        required: ["track"]
      },
      annotations: { readOnlyHint: true },
      execute: async (input) => {
        const { track } = (input ?? {}) as { track?: unknown };
        if (!isTrackId(track)) return text({ ok: false, error: "Unknown track." });
        return text(trackSlice(track));
      }
    },
    {
      name: "set_tempo",
      description: "Set the project tempo in BPM (60–180).",
      inputSchema: {
        type: "object",
        properties: { bpm: { type: "number" }, reason: { type: "string" } },
        required: ["bpm"]
      },
      execute: async (input) => {
        const { bpm, reason } = (input ?? {}) as { bpm?: number; reason?: string };
        return runMutating(null, reason, () => dispatch({ type: "setTempo", bpm: Number(bpm) }, "agent"));
      }
    },
    {
      name: "set_pattern",
      description:
        "Set drum steps. steps is a list of {lane: kick|snare|hat|perc, step: 0-31, value: off|on|accent}. The loop is two bars of sixteenths: steps 0-15 are bar 1 and steps 16-31 are bar 2. Applied as one undoable change.",
      inputSchema: {
        type: "object",
        properties: {
          steps: {
            type: "array",
            items: {
              type: "object",
              properties: {
                lane: { type: "string", enum: ["kick", "snare", "hat", "perc"] },
                step: { type: "number" },
                value: { type: "string", enum: ["off", "on", "accent"] }
              },
              required: ["lane", "step", "value"]
            }
          },
          reason: { type: "string" }
        },
        required: ["steps"]
      },
      execute: async (input) => {
        const { steps, reason } = (input ?? {}) as {
          steps?: { lane: string; step: number; value: string }[];
          reason?: string;
        };
        if (!Array.isArray(steps) || steps.length === 0) {
          return text({ ok: false, error: "steps must be a non-empty array." });
        }
        const commands: SynthLabCommand[] = steps.map((s) => ({
          type: "setDrumStep",
          lane: s.lane as never,
          step: s.step,
          value: s.value as never
        }));
        return runMutating("drums", reason, () => dispatchBatch(commands, "agent", "Drums · pattern"));
      }
    },
    {
      name: "set_notes",
      description:
        "Set bass or lead notes. notes is a list of {step: 0-31, row: 0-7 or null to clear}. The loop is two bars of sixteenths: steps 0-15 are bar 1 and steps 16-31 are bar 2. Rows are C-minor scale degrees from the root. One note per step is enforced.",
      inputSchema: {
        type: "object",
        properties: {
          track: { type: "string", enum: ["bass", "lead"] },
          notes: {
            type: "array",
            items: {
              type: "object",
              properties: {
                step: { type: "number" },
                row: { type: ["number", "null"] }
              },
              required: ["step", "row"]
            }
          },
          reason: { type: "string" }
        },
        required: ["track", "notes"]
      },
      execute: async (input) => {
        const { track, notes, reason } = (input ?? {}) as {
          track?: string;
          notes?: { step: number; row: number | null }[];
          reason?: string;
        };
        if (track !== "bass" && track !== "lead") return text({ ok: false, error: "track must be bass or lead." });
        if (!Array.isArray(notes) || notes.length === 0) {
          return text({ ok: false, error: "notes must be a non-empty array." });
        }
        const commands: SynthLabCommand[] = notes.map((n) => ({
          type: "setStepNote",
          trackId: track,
          step: n.step,
          row: n.row
        }));
        return runMutating(track, reason, () =>
          dispatchBatch(commands, "agent", `${track === "bass" ? "Bass" : "Lead"} · notes`)
        );
      }
    },
    {
      name: "set_chords",
      description:
        "Set pad chords. chords is a list of {step: 0-31, chord: Cm|Ab|Eb|Fm or null to clear}. The loop is two bars of sixteenths: steps 0-15 are bar 1 and steps 16-31 are bar 2. A chord holds until the next chord start, including across the bar boundary.",
      inputSchema: {
        type: "object",
        properties: {
          chords: {
            type: "array",
            items: {
              type: "object",
              properties: {
                step: { type: "number" },
                chord: { type: ["string", "null"], enum: ["Cm", "Ab", "Eb", "Fm", null] }
              },
              required: ["step", "chord"]
            }
          },
          reason: { type: "string" }
        },
        required: ["chords"]
      },
      execute: async (input) => {
        const { chords, reason } = (input ?? {}) as {
          chords?: { step: number; chord: "Cm" | "Ab" | "Eb" | "Fm" | null }[];
          reason?: string;
        };
        if (!Array.isArray(chords) || chords.length === 0) {
          return text({ ok: false, error: "chords must be a non-empty array." });
        }
        const commands: SynthLabCommand[] = chords.map((c) => ({
          type: "setStepChord",
          step: c.step,
          chord: c.chord
        }));
        return runMutating("pads", reason, () => dispatchBatch(commands, "agent", "Pads · chords"));
      }
    },
    {
      name: "set_synth_parameter",
      description:
        "Set one synth parameter on bass, pads or lead. parameter is one of cutoffHz (100-8000), resonance (0-1), attack/decay (seconds), sustain (0-1), release (seconds), filterEnvAmount (0-4 octaves), octaveOffset (-1|0|1).",
      inputSchema: {
        type: "object",
        properties: {
          track: { type: "string", enum: SYNTH_TRACK_IDS },
          parameter: { type: "string", enum: Object.keys(PARAM_DEFS) },
          value: { type: "number" },
          reason: { type: "string" }
        },
        required: ["track", "parameter", "value"]
      },
      execute: async (input) => {
        const { track, parameter, value, reason } = (input ?? {}) as {
          track?: unknown;
          parameter?: string;
          value?: number;
          reason?: string;
        };
        if (!isSynthTrackId(track)) return text({ ok: false, error: "track must be bass, pads or lead." });
        return runMutating(track, reason, () =>
          dispatch(
            { type: "setSynthParam", trackId: track, param: parameter as SynthParamId, value: Number(value) },
            "agent"
          )
        );
      }
    },
    {
      name: "apply_synth_patch",
      description:
        "Apply several patch fields to bass, pads or lead as ONE undoable change (waveform, ampEnv, cutoffHz, resonance, filterEnvAmount, octaveOffset, voices). Include a short reason for the user.",
      inputSchema: {
        type: "object",
        properties: {
          track: { type: "string", enum: SYNTH_TRACK_IDS },
          patch: patchSchema,
          reason: { type: "string" }
        },
        required: ["track", "patch"]
      },
      execute: async (input) => {
        const { track, patch, reason } = (input ?? {}) as {
          track?: unknown;
          patch?: Partial<SynthPatch>;
          reason?: string;
        };
        if (!isSynthTrackId(track)) return text({ ok: false, error: "track must be bass, pads or lead." });
        if (!patch || typeof patch !== "object") return text({ ok: false, error: "patch must be an object." });
        return runMutating(track, reason, () => dispatch({ type: "applyPatch", trackId: track, patch }, "agent"));
      }
    },
    {
      name: "play",
      description: "Start the loop.",
      inputSchema: { type: "object", properties: {} },
      execute: async () => {
        if (!getEngineIfStarted()) {
          return text({ ok: false, error: "Audio has not been started by the user yet — ask them to press Start." });
        }
        dispatch({ type: "play" }, "agent");
        return text({ ok: true, transportStatus: "playing" });
      }
    },
    {
      name: "stop",
      description: "Stop the loop.",
      inputSchema: { type: "object", properties: {} },
      execute: async () => {
        dispatch({ type: "stop" }, "agent");
        return text({ ok: true, transportStatus: "idle" });
      }
    },
    {
      name: "audition_change",
      description:
        "Temporarily audition patch values on a track WITHOUT changing project state or history (A/B demonstration). Reverts automatically after durationMs (default 2000, max 8000).",
      inputSchema: {
        type: "object",
        properties: {
          track: { type: "string", enum: SYNTH_TRACK_IDS },
          patch: patchSchema,
          durationMs: { type: "number" }
        },
        required: ["track", "patch"]
      },
      execute: async (input) => {
        const { track, patch, durationMs } = (input ?? {}) as {
          track?: unknown;
          patch?: Partial<SynthPatch>;
          durationMs?: number;
        };
        if (!isSynthTrackId(track)) return text({ ok: false, error: "track must be bass, pads or lead." });
        const engine = getEngineIfStarted();
        if (!engine) return text({ ok: false, error: "Audio has not been started by the user yet." });
        const current = projectStore.get().project.tracks[track].patch;
        if (!current) return text({ ok: false, error: "Track has no patch." });
        const temp: SynthPatch = {
          ...current,
          ...patch,
          ampEnv: { ...current.ampEnv, ...(patch?.ampEnv ?? {}) }
        };
        engine.audition(track, temp);
        const duration = Math.min(8000, Math.max(250, Number(durationMs) || 2000));
        setTimeout(() => engine.endAudition(track), duration);
        return text({ ok: true, auditioning: true, revertsInMs: duration });
      }
    },
    {
      name: "focus_control",
      description:
        "Visually highlight one control so the user can see what you are talking about, optionally with a short concept explanation. parameter is a synth parameter id, 'waveform' or 'voices'.",
      inputSchema: {
        type: "object",
        properties: {
          track: { type: "string", enum: SYNTH_TRACK_IDS },
          parameter: { type: "string" },
          conceptTitle: { type: "string" },
          conceptBody: { type: "string" }
        },
        required: ["track", "parameter"]
      },
      execute: async (input) => {
        const { track, parameter, conceptTitle, conceptBody } = (input ?? {}) as {
          track?: unknown;
          parameter?: string;
          conceptTitle?: string;
          conceptBody?: string;
        };
        if (!isSynthTrackId(track)) return text({ ok: false, error: "track must be bass, pads or lead." });
        const valid = parameter && (parameter in PARAM_DEFS || parameter === "waveform" || parameter === "voices");
        if (!valid) return text({ ok: false, error: "Unknown parameter." });
        dispatch({ type: "selectTrack", trackId: track }, "agent");
        uiStore.setHighlight({
          trackId: track,
          param: parameter as never,
          source: "agent",
          treatment: "teach",
          concept: conceptTitle || conceptBody ? { title: conceptTitle ?? "", body: conceptBody ?? "" } : null
        });
        return text({ ok: true, highlighted: `${track}.${parameter}` });
      }
    },
    {
      name: "present_coach_message",
      description:
        "Show a short teaching message in the coach card (the lesson surface). Perceptual language first; name the real concept.",
      inputSchema: {
        type: "object",
        properties: { message: { type: "string" } },
        required: ["message"]
      },
      execute: async (input) => {
        const { message } = (input ?? {}) as { message?: string };
        if (!message) return text({ ok: false, error: "message is required." });
        uiStore.setCoachMessage({ message });
        return text({ ok: true });
      }
    },
    {
      name: "undo_last_change",
      description: "Undo the most recent change (yours or the user's) — same undo stack as the UI.",
      inputSchema: { type: "object", properties: {} },
      execute: async () => {
        const undone = performUndo();
        return text(undone ? { ok: true } : { ok: false, error: "Nothing to undo." });
      }
    },
    {
      name: "reset_track",
      description: "Reset one track. scope is 'pattern' (restore the default jam pattern) or 'patch' (synth tracks only).",
      inputSchema: {
        type: "object",
        properties: {
          track: { type: "string", enum: TRACK_IDS },
          scope: { type: "string", enum: ["pattern", "patch"] },
          reason: { type: "string" }
        },
        required: ["track", "scope"]
      },
      execute: async (input) => {
        const { track, scope, reason } = (input ?? {}) as { track?: unknown; scope?: string; reason?: string };
        if (!isTrackId(track)) return text({ ok: false, error: "Unknown track." });
        if (scope === "patch") {
          if (!isSynthTrackId(track)) return text({ ok: false, error: "Drums have no patch." });
          return runMutating(track, reason, () => dispatch({ type: "resetPatch", trackId: track }, "agent"));
        }
        return runMutating(track, reason, () => dispatch({ type: "resetTrackPattern", trackId: track }, "agent"));
      }
    }
  ];
}

let registered = false;

/**
 * Called once from SynthLabApp after audio start. No-ops (and leaves zero UI
 * residue) when WebMCP is unavailable.
 */
export function registerWebMcpTools(): void {
  if (registered) return;
  const modelContext = getModelContext();
  if (!modelContext) return;
  const tools = buildTools();
  try {
    for (const tool of tools) {
      modelContext.registerTool({
        ...tool,
        execute: async (input: unknown) => {
          uiStore.setAgentStatus("working");
          try {
            return await tool.execute(input);
          } finally {
            uiStore.setAgentStatus("connected");
          }
        }
      });
    }
    registered = true;
    uiStore.setAgentStatus("connected");
  } catch {
    // Origin-trial API surface may shift — failure must never break the app.
  }
}
