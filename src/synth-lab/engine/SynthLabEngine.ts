import * as Tone from "tone";
import { dispatch } from "@/synth-lab/state/commands";
import { playheadStore } from "@/synth-lab/state/playheadStore";
import { projectStore } from "@/synth-lab/state/projectStore";
import {
  BAR_COUNT,
  CHORD_VOICINGS,
  DRUM_LANES,
  STEP_COUNT,
  rowToNoteName,
  type DrumLaneId,
  type SynthLabState,
  type SynthPatch,
  type SynthTrackId,
  type TrackId
} from "@/synth-lab/state/types";
import { levelToGain, resonanceToQ } from "./paramMap";
import { createAudioStartup } from "./audioStartup";

/**
 * SynthLabEngine (plan §6) owns every Tone node. React never touches Tone;
 * the engine subscribes to the store and mirrors state onto the audio graph.
 * The musical clock is the single global Tone.Transport; pattern edits are
 * picked up live because sequence callbacks read the store at fire time.
 */
export type SampleStatus = "loading" | "loaded" | "error";

const DRUM_SAMPLE_URLS: Record<DrumLaneId, string> = {
  kick: "/audio/synth-lab/kick.wav",
  snare: "/audio/synth-lab/snare.wav",
  hat: "/audio/synth-lab/hat.wav",
  perc: "/audio/synth-lab/perc.wav"
};

/** Absolute step indices 0–31: two bars of sixteenths, one Sequence event each. */
const STEP_INDICES = Array.from({ length: STEP_COUNT }, (_, i) => i);

// Fixed filter-envelope shape (not user-exposed): fast attack, audible sweep.
const FILTER_ENV_SHAPE = { attack: 0.005, decay: 0.25, sustain: 0.15, release: 0.4 };

type MonoSynthOptions = Parameters<Tone.MonoSynth["set"]>[0];

function patchToMonoSynthOptions(patch: SynthPatch): MonoSynthOptions {
  return {
    oscillator: { type: patch.waveform },
    envelope: {
      attack: patch.ampEnv.attack,
      decay: patch.ampEnv.decay,
      sustain: patch.ampEnv.sustain,
      release: patch.ampEnv.release
    },
    filter: { type: "lowpass", Q: resonanceToQ(patch.resonance) },
    filterEnvelope: {
      ...FILTER_ENV_SHAPE,
      baseFrequency: patch.cutoffHz,
      octaves: patch.filterEnvAmount
    }
  };
}

export class SynthLabEngine {
  private readonly masterGain: Tone.Gain;
  private readonly trackGains: Record<TrackId, Tone.Gain>;
  private readonly drumPlayers: Record<DrumLaneId, Tone.Player>;
  private readonly bass: Tone.MonoSynth;
  private readonly pads: Tone.PolySynth<Tone.MonoSynth>;
  private readonly lead: Tone.MonoSynth;
  private readonly sequences: Tone.Sequence<number>[] = [];
  private unsubscribe: (() => void) | null = null;
  private prevState: SynthLabState | null = null;
  private auditionTracks = new Set<SynthTrackId>();
  private disposed = false;
  private readonly onVisibility = () => this.checkContextRunning();
  private readonly onStateChange = () => this.checkContextRunning();

  readonly sampleStatus: Record<DrumLaneId, SampleStatus> = {
    kick: "loading",
    snare: "loading",
    hat: "loading",
    perc: "loading"
  };
  readonly loaded: Promise<void>;

  constructor() {
    this.masterGain = new Tone.Gain(1).toDestination();
    this.trackGains = {
      drums: new Tone.Gain(1).connect(this.masterGain),
      bass: new Tone.Gain(1).connect(this.masterGain),
      pads: new Tone.Gain(1).connect(this.masterGain),
      lead: new Tone.Gain(1).connect(this.masterGain)
    };

    const loadPromises: Promise<void>[] = [];
    this.drumPlayers = {} as Record<DrumLaneId, Tone.Player>;
    for (const lane of DRUM_LANES) {
      loadPromises.push(
        new Promise<void>((resolve) => {
          const player = new Tone.Player({
            url: DRUM_SAMPLE_URLS[lane],
            onload: () => {
              this.sampleStatus[lane] = "loaded";
              resolve();
            },
            onerror: () => {
              // Missing sample = silent lane, never a crash (plan §8-Drums).
              this.sampleStatus[lane] = "error";
              resolve();
            }
          }).connect(this.trackGains.drums);
          this.drumPlayers[lane] = player;
        })
      );
    }
    this.loaded = Promise.all(loadPromises).then(() => undefined);

    this.bass = new Tone.MonoSynth().connect(this.trackGains.bass);
    this.pads = new Tone.PolySynth(Tone.MonoSynth).connect(this.trackGains.pads);
    // Plan §8 specifies 8 from a spike patch with a short release. The designed
    // pad character (brief §8.3) uses a ~1.2 s release, so a 3-note chord
    // changing every beat at 96 BPM keeps three generations of voices alive
    // (~9) and Tone drops notes at 8. 12 covers it and the graph stays trivial.
    this.pads.maxPolyphony = 12;
    this.lead = new Tone.MonoSynth().connect(this.trackGains.lead);

    const transport = Tone.getTransport();
    transport.loop = true;
    transport.loopStart = 0;
    // Two bars. Each Sequence below holds 32 "16n" events, so its own length is
    // also 2 measures — the sequences and the transport loop stay phase-locked,
    // which is what keeps all four tracks synchronized across the bar boundary.
    transport.loopEnd = `${BAR_COUNT}m`;
    transport.timeSignature = 4;

    this.sequences.push(
      new Tone.Sequence<number>((time, step) => this.triggerDrums(time, step), STEP_INDICES, "16n"),
      new Tone.Sequence<number>((time, step) => this.triggerNoteTrack("bass", time, step), STEP_INDICES, "16n"),
      new Tone.Sequence<number>((time, step) => this.triggerPads(time, step), STEP_INDICES, "16n"),
      new Tone.Sequence<number>((time, step) => this.triggerNoteTrack("lead", time, step), STEP_INDICES, "16n"),
      // Playhead publication: Draw-deferred so no DOM/react work happens in
      // the audio callback path (plan §9).
      new Tone.Sequence<number>((time, step) => {
        Tone.getDraw().schedule(() => playheadStore.set(step), time);
      }, STEP_INDICES, "16n")
    );
    this.sequences.forEach((seq) => seq.start(0));
  }

  /** Subscribes to the store and applies the current snapshot to the graph. */
  attach(): void {
    const initial = projectStore.get();
    this.applyState(initial, null);
    this.prevState = initial;
    this.unsubscribe = projectStore.subscribe(() => {
      const next = projectStore.get();
      this.applyState(next, this.prevState);
      this.prevState = next;
    });
    document.addEventListener("visibilitychange", this.onVisibility);
    Tone.getContext().on("statechange", this.onStateChange);
  }

  private checkContextRunning(): void {
    if (this.disposed) return;
    // iOS backgrounding can suspend the context; reflect it as stopped rather
    // than pretending audio continues (plan §17/§19).
    if (Tone.getContext().state !== "running" && projectStore.get().transportStatus === "playing") {
      dispatch({ type: "stop" });
    }
  }

  private triggerDrums(time: number, step: number): void {
    const { drums } = projectStore.get().project.tracks;
    for (const lane of DRUM_LANES) {
      const value = drums.pattern.lanes[lane][step];
      if (value === "off") continue;
      const player = this.drumPlayers[lane];
      if (!player.loaded) continue;
      // Accent = 0 dB, normal hit = −6 dB (plan §8-Drums).
      player.volume.setValueAtTime(value === "accent" ? 0 : -6, time);
      player.start(time);
    }
  }

  private triggerNoteTrack(trackId: "bass" | "lead", time: number, step: number): void {
    const track = projectStore.get().project.tracks[trackId];
    const row = track.pattern.steps[step];
    const patch = track.patch;
    if (row === null || !patch) return;
    const note = rowToNoteName(row, trackId, patch.octaveOffset);
    const synth = trackId === "bass" ? this.bass : this.lead;
    synth.triggerAttackRelease(note, "16n", time);
  }

  private triggerPads(time: number, step: number): void {
    const track = projectStore.get().project.tracks.pads;
    const chordId = track.pattern.steps[step];
    const patch = track.patch;
    if (!chordId || !patch) return;
    const voicing = CHORD_VOICINGS[chordId].slice(0, patch.voices);
    // A chord holds until the next chord start replaces it.
    this.pads.releaseAll(time);
    const shifted =
      patch.octaveOffset === 0
        ? voicing
        : voicing.map((note) => Tone.Frequency(note).transpose(patch.octaveOffset * 12).toNote());
    this.pads.triggerAttack(shifted, time);
  }

  /** Diff-based sync: only touched parameters hit Tone (plan §6). */
  applyState(state: SynthLabState, prev: SynthLabState | null): void {
    if (this.disposed) return;
    const transport = Tone.getTransport();
    const project = state.project;
    const prevProject = prev?.project ?? null;

    if (!prev || state.transportStatus !== prev.transportStatus) {
      if (state.transportStatus === "playing") {
        transport.start();
      } else {
        transport.stop();
        this.pads.releaseAll();
        Tone.getDraw().cancel();
        playheadStore.set(null);
      }
    }

    if (!prevProject || project.tempoBpm !== prevProject.tempoBpm) {
      if (prevProject) {
        transport.bpm.rampTo(project.tempoBpm, 0.1);
      } else {
        transport.bpm.value = project.tempoBpm;
      }
    }

    if (!prevProject || project.masterLevel !== prevProject.masterLevel) {
      this.masterGain.gain.rampTo(levelToGain(project.masterLevel), 0.05);
    }

    for (const trackId of Object.keys(this.trackGains) as TrackId[]) {
      const track = project.tracks[trackId];
      const prevTrack = prevProject?.tracks[trackId];
      if (!prevTrack || track.muted !== prevTrack.muted || track.level !== prevTrack.level) {
        this.trackGains[trackId].gain.rampTo(track.muted ? 0 : levelToGain(track.level), 0.05);
      }
      if (trackId !== "drums") {
        const synthTrackId = trackId as SynthTrackId;
        const patch = track.patch;
        const prevPatch = prevTrack?.patch;
        if (patch && patch !== prevPatch && !this.auditionTracks.has(synthTrackId)) {
          this.applyPatchToNodes(synthTrackId, patch);
        }
      }
    }
  }

  private applyPatchToNodes(trackId: SynthTrackId, patch: SynthPatch): void {
    const options = patchToMonoSynthOptions(patch);
    if (trackId === "bass") {
      this.bass.set(options);
    } else if (trackId === "lead") {
      this.lead.set(options);
    } else {
      // set() propagates live to all PolySynth voices (spike-verified).
      this.pads.set(options);
    }
  }

  /**
   * A/B audition (plan §12): apply a temporary patch directly to nodes with
   * no store mutation and no history; release restores the store's patch.
   */
  audition(trackId: SynthTrackId, patch: SynthPatch): void {
    this.auditionTracks.add(trackId);
    this.applyPatchToNodes(trackId, patch);
  }

  endAudition(trackId: SynthTrackId): void {
    this.auditionTracks.delete(trackId);
    const patch = projectStore.get().project.tracks[trackId].patch;
    if (patch) this.applyPatchToNodes(trackId, patch);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.unsubscribe?.();
    this.unsubscribe = null;
    document.removeEventListener("visibilitychange", this.onVisibility);
    Tone.getContext().off("statechange", this.onStateChange);

    const transport = Tone.getTransport();
    transport.stop();
    transport.cancel();
    playheadStore.set(null);

    // Spike-verified teardown order: sequences → instruments → gains.
    this.sequences.forEach((seq) => seq.dispose());
    for (const lane of DRUM_LANES) this.drumPlayers[lane].dispose();
    this.bass.dispose();
    this.pads.dispose();
    this.lead.dispose();
    (Object.keys(this.trackGains) as TrackId[]).forEach((id) => this.trackGains[id].dispose());
    this.masterGain.dispose();
  }
}

const audioStartup = createAudioStartup(
  () => {
    const started = Tone.start();
    return started.then(() => {
      if (Tone.getContext().state !== "running") {
        throw new Error(`AudioContext remained ${Tone.getContext().state} after Tone.start()`);
      }
    });
  },
  async () => {
    const engine = new SynthLabEngine();
    engine.attach();
    await engine.loaded;
    return engine;
  },
  (engine) => engine.dispose()
);

/**
 * Start gesture entry point: resumes the AudioContext (must be called from a
 * user gesture), creates the singleton engine, and waits for drum samples.
 */
export async function startEngine(): Promise<SynthLabEngine> {
  return audioStartup.start();
}

export function getEngineIfStarted(): SynthLabEngine | null {
  return audioStartup.get();
}

/** Quiet, on-demand diagnostics for development failures; never logs during normal playback. */
export function getAudioDiagnostics() {
  const context = Tone.getContext();
  const engine = audioStartup.get();
  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    userActivation: navigator.userActivation
      ? { isActive: navigator.userActivation.isActive, hasBeenActive: navigator.userActivation.hasBeenActive }
      : "unavailable",
    contextState: context.state,
    toneContextState: Tone.getContext().state,
    transportState: Tone.getTransport().state,
    destination: {
      mute: Tone.getDestination().mute,
      volumeDb: Tone.getDestination().volume.value
    },
    engineCreated: engine !== null,
    sampleStatus: engine ? { ...engine.sampleStatus } : null
  };
}

export function disposeEngine(): void {
  audioStartup.clear()?.dispose();
}
