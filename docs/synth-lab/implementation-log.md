# Synth Lab — Implementation Log

**Status:** MVP implemented and validated
**Date:** 2026-08-08
**Sources of truth:** `synth-lab-product-brief.md`, `docs/synth-lab/implementation-plan.md`,
Figma `Soft Arcade Synth Lab`, Figma `Soft Arcade Design System V1`

This log records what shipped, how it was validated, and every place the
implementation departs from the plan or the Figma file. It does not restate the
plan — read that first.

---

## 1. Phases completed

All nine phases in plan §21 are implemented.

| Phase | State | Notes |
| --- | --- | --- |
| 1 — Shell, state spine, audio start | Done | Route `/synth-lab`, nav item, `projectStore` + `dispatch` with transaction recording, engine skeleton, Start gate, transport |
| 2 — Drums + Bass | Done | In-house drum samples, `Tone.Players`, drum grid with off/on/accent, bass MonoSynth + full editor, playhead, mute/level, persistence |
| 3 — Pads + Lead | Done | `PolySynth(MonoSynth)` pads, chord grid with derived Held cells, releaseAll-on-replace, Voices control, Lead reusing the bass editor |
| 4 — Lessons | Done | 6 challenges + 2 recipes, LessonCard states, Concept Highlight, highlighted-parameter state, forgiving validators, Concept Mastery, Free Play |
| 5 — Undo surface + A/B | Done | Undo/redo over the existing transactions, restoration receipt, Hear Before/After via engine audition, reset patch/project dialogs |
| 6 — Persistence hardening | Done | Debounced writes, versioned schema, corrupt-payload fallback, reload = stopped, mastery survives project reset |
| 7 — WebMCP | Done | 15 tools behind feature detection, Agent Action Card (working/applied/error), activity chip + popover, connection chips, `focus_control`, `present_coach_message` |
| 8 — Responsive + a11y | Done | 900/640 behaviors, keyboard grid navigation, `aria-valuetext` audit, reduced-motion, iOS/suspend handling |
| 9 — Figma comparison | Done | §4 below |

## 2. Files added / changed

**Added — application core**

```
src/app/synth-lab/page.tsx                     server component: metadata + <SynthLabApp/>
src/synth-lab/SynthLabApp.tsx                  "use client" root: gate → workspace, undo keybinding
src/synth-lab/styles.module.css                all Synth Lab styling, bound to globals.css tokens
src/synth-lab/engine/SynthLabEngine.ts         every Tone node; sequences, playhead, audition, disposal
src/synth-lab/engine/paramMap.ts               parameter registry: ranges, curves, formatting, Tone mappings
src/synth-lab/state/types.ts                   domain model + note/chord derivation helpers
src/synth-lab/state/defaultProject.ts          the prebuilt jam and default patches
src/synth-lab/state/projectStore.ts            module store + useSynthLabState
src/synth-lab/state/playheadStore.ts           isolated ~9 Hz playhead store
src/synth-lab/state/commands.ts                command layer: dispatch, validation, dispatchBatch
src/synth-lab/state/history.ts                 inverse-patch transactions, drag coalescing, undo/redo
src/synth-lab/state/persistence.ts             localStorage, schema guard, debounce
src/synth-lab/state/derive.ts                  lane pattern-strip derivation
src/synth-lab/state/uiStore.ts                 ephemeral UI: highlight, receipt, agent status, coach message
src/synth-lab/state/receipts.ts                undo receipt copy
src/synth-lab/state/undoActions.ts             shared undo/redo entry points
src/synth-lab/lessons/challenges.ts            challenge + recipe definitions and validators
src/synth-lab/lessons/lessonEngine.ts          challenge lifecycle, context setup, validation subscription
src/synth-lab/webmcp/registerTools.ts          WebMCP adapter (15 tools)
src/synth-lab/webmcp/agentLog.ts               agent action log + change formatting
```

**Added — components** (`src/synth-lab/components/`)

`StartGate`, `SynthLabBar`, `Transport` (incl. activity chip), `TrackLaneList`,
`TrackEditor`, `NoteGrid`, `ParameterSlider`, `WaveformSelector`,
`VoicesControl`, `LessonCard`, `ConceptMastery`, `ConceptHighlight`,
`AgentActionCard`, `RestorationReceipt`, `ConfirmDialog`, `trackMeta.ts`

**Added — tests / assets / config**

```
src/synth-lab/state/__tests__/{commands,history,mappings,persistence}.test.ts
src/synth-lab/lessons/__tests__/validators.test.ts
public/audio/synth-lab/{kick,snare,hat,perc}.wav + README.md   provenance note
vitest.config.ts
```

**Changed**

- `src/components/Header.tsx` — added the "Synth Lab" nav item.
- `package.json` — added `tone@15.1.22` (exact), `vitest` (dev), `"test": "vitest run"`.

No existing game, component, or global style was modified. `globals.css` was not
touched (see the token gap in §5).

## 3. Tests and validation performed

**Automated — `vitest run`: 45 tests, 5 files, all passing**

- Commands: step/row/chord/param validation, clamping to the §8 registry
  ranges, invalid input leaves state untouched, drum step cycle,
  one-note-per-column replacement, chord replace, multi-param `applyPatch` as
  one transaction, partial-application rejection, `resetPatch`, `resetProject`.
- History: drag coalescing (one transaction, pre-drag `before` value), no
  coalescing across params or after commit, drag returning to its start value
  drops the transaction, discrete actions one each, undo/redo round-trip, redo
  cleared on new mutation, depth cap at 100.
- Mappings: log cutoff round-trip and exact range ends, all display/spoken
  formats, keyboard stepping and clamping, resonance→Q, row→note per track and
  octave, row labels, chord voicings, held-chord derivation including loop
  wrap, lane strip derivation (accent beats on, starts only).
- Persistence: round-trip, corrupt and wrong-schema fallback, transport never
  persisted, mastery under its own key.
- Lesson validators: pass and near-miss for every challenge, recipe steps in
  sequence, `prepare()` headroom behavior.

**Automated — `npx tsc --noEmit` clean; `npm run build` compiles, `/synth-lab` prerenders.**

**Manual, in the running app (Chrome, desktop)**

- Start gate: no audio on load; both gate actions start audio and the loop
  plays; the gate is the only initializer.
- Four tracks audibly in sync from one transport; loop indicator advances and
  wraps; `BAR n · BEAT n — LOOPING`.
- Edit while playing: drum cell cycles off → on → accent → off; bass note
  placement replaces the note in the same column; both audible next pass.
- Accessible names verified live, e.g. `"Kick, step 2, accent"`,
  `"G1, step 3, on"`, `"Brightness, filter cutoff, low-pass"` with
  `aria-valuetext="4.8 kilohertz"`.
- Slider keyboard: Shift+Arrow takes large perceptual steps and clamps at the
  range end with `aria-valuetext` tracking (4.8 kHz → 100 Hz over 12 presses).
- Pads: 4 chord starts and 12 derived Held cells; Held is never stored.
- `+ More` reveals Body / Tail / Sweep / Register and the label flips to `− Less`.
- Undo (⌘Z) restores the replaced note and shows the restoration receipt.
- Reset project returns tempo to 112 and the jam to its default.
- Persistence: a prior session's project and progress (tempo, level, active
  challenge, completed list) restored correctly on load; clearing storage falls
  back to the default jam.
- Transport correctly reports **stopped** when the AudioContext is suspended by
  backgrounding, rather than showing a silent "playing".

**Manual — WebMCP, driven through a dev harness that installs `document.modelContext`**

- All 15 tools register; the `AGENT CONNECTED` chip appears; nothing renders
  when `modelContext` is absent (verified in the same session before the
  harness was installed).
- Flow B: `apply_synth_patch` with a reason produced one Agent Action Card with
  five before→after rows (Punch 20→5 ms, Length 131→140 ms, Body 20→18%,
  Brightness 462→720 Hz, Sharpness 38→18%), magnitude bars, the why text, and
  Hear Before / Hear After / Undo. Card Undo reversed **all five** parameters in
  one step and emitted "Bass · patch — restored · the agent change was reversed".
- Flow C: `focus_control` highlighted the control and opened the Concept
  Highlight with agent attribution; `present_coach_message` wrote into the
  Lesson Card, not a second surface.
- `audition_change` changed no project state and created no history.
- Error path: a non-numeric value returned
  `{ok: false, error: "Parameter value must be a number.", hint: "Nothing was changed."}`
  and rendered the `BASS — AGENT ERROR` card state.
- Agent cannot bypass the state rules: out-of-range row, step 40, and chord
  `G7` were each rejected by the command layer with nothing changed.

**Manual — responsive**

Verified at 390 / 640 / 834 / 1024 / 1357 px: no horizontal page overflow at
any width; at <900 the coach rail reflows to a full-width band under the
transport with Lesson Card and Concept Mastery side by side and the transport
becomes sticky; at <640 lane pattern strips are hidden (lanes become a track
selector), Concept Mastery is hidden, parameters stack one column full-width,
and the step area scrolls with row labels pinned.

**Not covered by automated tests** (per plan §18): that audio *sounds* correct,
timing tightness, click-free parameter changes, and iOS Safari behavior.
Real-device iOS testing has **not** been performed — see §7.

## 4. Figma comparison (Phase 9)

Compared against `07 — Final / Desktop` (32:5 lesson-active, 48:176 first
entry incl. Start Gate 48:459, 50:374 free play), `08 — Final / Responsive`
(60:2 narrow 834, 65:416 mobile 390), the `09 — Interaction States` sheet, and
the `06 — Components` descriptions.

Matching as designed: shell + nav item, Synth Lab bar (identity, mode chip,
project actions), transport anatomy and loop-progress-not-timeline treatment,
four track lanes with tone bars / identity / read-only derived strips / mute /
level, selected-lane 2px tone border on `--panel-2`, editor header with voice
chip and "other tracks keep playing", note grid per-track row models and
captions, 30px steps with 4px gaps, playhead as a derived outline, waveform
selector with glyphs and inverted active segment, parameter cards with
perceptual label / live value / permanent technical label, `+ More` disclosure
and its copy, coach rail at 300px, Lesson Card states (active / complete / free
play / recipe), Concept Mastery with its conditional footer line, Concept
Highlight, Agent Action Card anatomy, undo receipt, reset dialogs, agent chips.

The bass pattern, pad chord placement, tempo (112), and default parameter
values in the shipped jam match the values shown in the 07 frames.

### Deviations from Figma

1. **Tempo is an editable control.** Figma shows static text `112 BPM` with the
   label `TEMPO`. The transport requires an editable tempo (brief §7), so the
   number is an `<input type="number">` with a static `BPM` suffix and the
   `TEMPO` label. Same anatomy and type ramp; the value is operable.
2. **Agent Action Card bars render increases.** The Figma component can only
   draw a decrease; code normalizes each row to the parameter's full range and
   draws before/after in either direction. This is the flagged behavior in the
   Figma file itself (plan §22.4), not silent drift.
3. **`focus_control` uses the Highlighted treatment, not "Agent changed".**
   Pointing at a control is not a change, so `focus_control` renders the cyan
   Highlighted slider state and the Concept Highlight carries the agent
   attribution (`Source=Agent`). The magenta "Agent changed" treatment is
   reserved for parameters an agent actually modified, which the Agent Action
   Card and the affected sliders show together.
4. **Note grid scrolls at any width it does not fit, not only on mobile.**
   Figma specifies the pinned-labels/scrolling step area for the 390 frame.
   Applying it whenever the 16 steps exceed the panel keeps the grid inside the
   editor between 640 and ~1100px instead of overflowing the panel border. The
   desktop appearance at Figma's 1440 is unchanged.
5. **Waveform glyphs are inlined SVG paths** (exact path data exported from the
   Figma component) with `currentColor` strokes, so the active segment can
   invert its glyph. Visually identical, no external asset requests.

### Deviations from the implementation plan

1. **`maxPolyphony` is 12, not 8** (plan §8-Pads / §4). The plan's 8 came from a
   spike patch with a short release; the designed pad character (brief §8.3)
   uses a ~1.2 s release, so a 3-note chord changing every beat at 112 BPM
   keeps three generations of voices alive (~9) and Tone logged
   "Max polyphony exceeded. Note dropped." in the running app. 12 removes the
   drop and the graph stays trivially small. The alternative — shortening the
   pad release — would have traded product character for an implementation
   constant.
2. **Challenges may establish their starting context.** Added
   `Challenge.prepare()`, dispatched as one lesson-origin transaction on
   challenge start. Without it, relative validators are not always completable:
   a user who has already parked Brightness at 100 Hz can never satisfy
   "reduce cutoff by an octave". Used by challenge 3 (restore brightness),
   challenge 4 (leave sweep headroom), and challenge 5 (start from one voice —
   the plan already required this behavior, now expressed through the same
   hook rather than a special case in the lesson engine).
3. **`dispatchBatch` added to the command layer** so multi-command agent and
   lesson operations record exactly one transaction, with rollback if any
   command in the batch fails. The plan requires the one-transaction outcome
   but did not name the mechanism.
4. **Sweep displays as a percentage of its range** (`40%`), matching the 50:374
   frame, rather than the plan §8 table's `2.0 oct`. Figma owns display detail;
   the stored value is still octaves and the technical label still reads
   `FILTER ENVELOPE · AMOUNT`.

## 5. Design-system gap (flagged, not hidden)

The Figma files bind several semantic tokens that production `globals.css` does
not define: `--game-bg` (`#08090f`), `--game-muted` (`#9a9aa3`), `--action-ink`
(`#061016`), `--border-strong` (`rgba(244,242,238,0.16)`), and the dimension
scale (`--space-*`, `--radius-*`, `--border-width-*`).

Per `AGENTS.md` ("flag the system gap instead of hiding a one-off") these are
scoped locally as `--sl-*` custom properties on `.app` in
`src/synth-lab/styles.module.css` rather than promoted into `globals.css`.
Promoting them is a design-system change that belongs to a design-system pass,
not to this feature. Track colors, focus ring, typography, and panel/line
colors all use the existing global tokens.

Handoff "do not promote yet" candidates (Segmented Control, Toggle,
Tooltip/Popover, Range/Slider) remain Synth Lab-local, as instructed.

## 6. Deferred scope (not built, by design)

Per brief §26/§27 and plan §23: metronome/count-in, pattern length ≠ 16,
key/scale changes, transpose, accidentals, note lengths/velocity beyond the
drum accent, MIDI, effects, export/recording, share URLs, accounts/cloud,
additional kits, an embedded LLM/chat backend.

Also deliberately not built:

- **ADSR envelope graph** (`EnvelopeEditor`, Figma 39:84). The brief lists a
  visual envelope representation under "Strongly preferred", not Required, and
  Figma resolves its accessibility as "the readout row is the keyboard surface;
  the graph is a pointer-only enhancement, hidden on mobile". The four envelope
  parameters ship as accessible sliders with live values, which is that readout
  surface. The graph is the remaining piece of that component — see §7.
- Playwright/E2E automation (plan §18 defers it).
- Expanded activity-log presentation: shipped as the collapsed count plus a
  simple popover listing transactions, exactly as plan §24 open question 1
  prescribes pending usage data.

## 7. Remaining issues

1. **ADSR graph not implemented** (see §6). The envelope is fully editable via
   the four sliders; the direct-manipulation graph with the ghost before-curve
   is outstanding. It is the one Figma component from `06 — Components` with no
   code counterpart.
2. **iOS Safari not verified on hardware.** Suspend/resume handling is
   implemented (`visibilitychange` + context `statechange` → transport reports
   stopped) and was confirmed in desktop Chrome by backgrounding the tab, but
   plan §22.1 asks for real-device time and that has not happened.
3. **Audio quality is unverified by machine.** The drum samples are synthesized
   in-house and the default jam is authored, but nobody has confirmed by ear
   that the loop is musically satisfying, that parameter changes are
   click-free, or that timing stays tight under load. Plan §22.5 budgets
   listening time for this; it remains open.
4. **WebMCP verified only through a dev harness.** `document.modelContext` was
   stubbed to exercise all 15 tools and both agent flows end to end. No test
   against a real Chrome origin-trial agent has been done, and the API surface
   has already moved once (`navigator` → `document`); both spellings are
   feature-detected.
5. **Reduced-motion playhead** ships as discrete per-16th stepping (plan §4
   decision, §24 open question 2) — implemented, not yet user-validated.

## 8. Conformance statement

The implementation matches the product brief, the implementation plan, and the
approved Figma designs, with the deviations in §4 and the gap in §5 documented
rather than silently resolved. Every deviation is either (a) Figma-vs-code
detail the design file itself flags, (b) an implementation constant the plan
derived empirically and that measurement in the running app contradicted, or
(c) a completability fix the brief's own flow requirements demand. No MVP scope
was expanded, no deferred DAW feature was built, and no approved interaction
was substituted for an easier one: pitch entry is the scale-locked grid, chords
are one-tap with derived sustain, drums are the three-state step cycle,
synthesis exposes the real subtractive parameters with dual labels, lessons
validate against project state with forgiving bands, and every agent action
goes through the same command layer and history as a human edit.

The two items that would prevent calling the MVP fully signed off are in §7:
the ADSR graph (strongly-preferred, not required, scope) and the absence of
real-device iOS plus by-ear audio validation (verification, not
implementation).
