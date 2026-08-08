# Synth Lab — Product Brief

**Product:** Synth Lab  
**Platform:** SoftArcade  
**Status:** Product definition / pre-design  
**Version:** 0.1  
**Date:** August 2026

---

## 1. Product summary

**Synth Lab is a playful, browser-based four-track groovebox that teaches synthesis by helping people make small instrumental jams.**

The product combines:

- a simple drum sequencer
- a bass synth
- a pad synth
- a lead synth
- short, contextual synthesis lessons
- an optional AI/agent collaboration layer exposed through WebMCP

The core idea is:

> **Make something first. Learn why it sounds that way while you make it.**

Synth Lab should not feel like a textbook placed next to a synthesizer, and it should not feel like a full DAW made smaller. It should feel like a SoftArcade game that happens to teach real music-production concepts through direct manipulation, listening, experimentation, and short creative challenges.

The agent is a collaborator and teacher, not an opaque music generator. When an agent changes the track, it should operate the same underlying controls available to the user and make those changes visible, understandable, and reversible.

---

## 2. Product vision

Many beginners can hear differences between sounds — bright vs. dark, plucky vs. smooth, thin vs. wide — without understanding which synthesizer controls create those differences.

Traditional synthesizers expose parameters such as oscillators, filters, envelopes, and polyphony all at once. That is powerful for experienced musicians but creates a high conceptual load for beginners.

At the other extreme, generative music tools can create finished audio without teaching the user how the sound was made.

Synth Lab should occupy the space between those approaches:

**an instrument that helps the user understand sound by making music with it.**

The intended emotional progression is:

**play → notice → change → hear → understand → make**

The user should leave a short session with both:

1. a small musical jam they helped create
2. a clearer mental model of one or more synthesis concepts

---

## 3. Why this belongs in SoftArcade

Synth Lab should feel like a natural expansion of SoftArcade rather than a separate educational product.

SoftArcade provides the product framing:

- immediate interaction
- small, self-contained experiences
- playful visual language
- short sessions
- clear goals
- low setup cost
- experimentation without serious consequences

Synth Lab extends that model from conventional games into a **creative music game/tool**.

It should reuse the existing SoftArcade Design System v1 wherever appropriate and extend it only when the new product demonstrates a real need.

The design process should explicitly distinguish:

### SoftArcade-global components
Reusable across future games/features.

Examples may include:
- buttons
- dialogs
- tooltips
- panels
- navigation
- status feedback
- focus treatment

### Synth Lab-specific components
Components whose semantics belong specifically to music creation.

Examples may include:
- sequencer step
- synth knob/slider
- track strip
- transport
- ADSR editor
- oscillator selector
- piano/note selector
- agent-change indicator

Do not promote a Synth Lab-specific pattern into the global SoftArcade system without evidence that it is broadly reusable.

---

## 4. Target user

### Primary user

A curious beginner or casual musician who:

- likes electronic music, games, or creative software
- has little or inconsistent synthesis knowledge
- understands perceptual words such as “brighter,” “shorter,” or “bassier”
- may recognize terms like filter or oscillator but cannot confidently use them
- wants to make something quickly rather than complete a traditional course
- is comfortable experimenting in a browser

No prior DAW, MIDI, keyboard, or synthesis experience is required.

### Secondary user

A musician or producer who already uses presets but wants a clearer understanding of subtractive synthesis fundamentals.

### Not the primary user

Synth Lab is not initially designed for:

- professional sound designers
- advanced modular-synthesis users
- users looking for full DAW functionality
- users primarily seeking AI-generated finished music

---

## 5. Core problem

> **How might we teach the causal relationship between synth controls and sound while the user is actively making music?**

The product should help users answer questions like:

- What does an oscillator actually change?
- Why does a saw wave sound brighter than a sine wave?
- Why does this sound “plucky”?
- Why does lowering the filter make it darker?
- What do attack, decay, sustain, and release actually do?
- Why can this patch play a chord while another only plays one note?
- How would I make something bass-like, brass-like, pad-like, or flute-like?
- What changed when an agent modified my sound?

---

## 6. Product principles

### 6.1 Sound before terminology

Whenever possible, let the user hear a concept before requiring them to understand its name.

Prefer:

> Hear the difference between these two waveforms.

Then introduce:

> These shapes are called oscillators.

Do not begin with definitions when direct experience can establish the concept first.

### 6.2 Make before reading

The primary activity is music making.

Lessons should interrupt the creative flow as little as possible.

A successful lesson changes the user's actual jam rather than existing only as a detached tutorial exercise.

### 6.3 Cause and effect must be obvious

When a parameter changes:

- the control changes visibly
- the sound changes audibly
- the changed value is identifiable
- the user can compare before/after when useful

The user should be able to connect:

**this control → this audible result**

### 6.4 Progressive disclosure, not fake simplicity

Beginner mode may emphasize perceptual concepts such as:

- Brightness
- Shape
- Punch
- Length

But the product should teach the real synthesis term rather than permanently hiding it.

For example:

**Brightness**  
Filter cutoff

The goal is to bridge intuitive language into legitimate synthesis knowledge.

### 6.5 The agent uses the instrument

The agent must not secretly replace the user's patch with generated audio.

For MVP agent interactions, the agent changes the same sequencer and synthesizer state available to the human.

This keeps the result:

- inspectable
- teachable
- editable
- reproducible
- reversible

### 6.6 Every agent change is understandable and reversible

Agent actions should expose:

- what changed
- previous value
- new value
- why the change was made when educationally relevant
- an Undo action
- an A/B comparison where useful

### 6.7 Musical legitimacy without DAW complexity

Controls should behave in musically credible ways.

The product may simplify workflows, but should avoid teaching misleading mental models merely to make the UI easier.

### 6.8 Short-session success

A first-time user should be able to make an audible, intentional change within roughly one minute and complete a useful introductory challenge within a few minutes.

---

## 7. MVP product model

The MVP is better described as a **four-track loop-based groovebox** than a full DAW.

There is one shared transport and four musical tracks:

1. **Drums**
2. **Bass**
3. **Pads**
4. **Lead**

The experience revolves around a short repeating loop.

The exact pattern length and note-grid representation should be explored during design, but the MVP should favor immediate comprehension over arrangement depth.

### Shared transport

Required:

- Play
- Stop
- Tempo/BPM
- Looping
- Current play position
- Master volume/mute

Optional only if design proves it necessary:

- metronome
- count-in

Do not add a full arrangement timeline in MVP.

---

## 8. Track responsibilities

### 8.1 Drums

Purpose:

- introduce sequencing and rhythm
- establish the musical foundation of the jam
- provide immediate gratification before deeper synthesis concepts

MVP:

- simple step sequencer
- small fixed kit, such as kick / snare / closed hat / percussion
- mute
- level
- editable pattern

The drum track does not need to teach drum synthesis in MVP.

### 8.2 Bass

Purpose:

Teach foundational subtractive synthesis through a constrained monophonic instrument.

Core concepts:

- waveform
- oscillator register/octave
- amp envelope
- filter cutoff
- resonance
- filter movement/envelope
- monophony

The Bass track should be one of the main teaching instruments.

### 8.3 Pads

Purpose:

Introduce sustained sounds, chords, and polyphony.

Core concepts:

- polyphony
- multiple simultaneous notes
- longer attack/release
- harmonic richness
- filter shaping
- optional detune/voice thickness if included in MVP

### 8.4 Lead

Purpose:

Provide another expressive context for applying learned concepts.

Core concepts may include:

- waveform
- register
- envelope
- filtering
- mono/poly comparison

Do not introduce additional synthesis architecture solely to make the Lead track more sophisticated.

Reuse the same mental model whenever possible.

---

## 9. Synth architecture for MVP

The design should be based around subtractive synthesis.

The exact implementation may use Tone.js or equivalent Web Audio abstractions, but the conceptual model should remain stable.

### Required concepts

#### Oscillator
At minimum:
- sine
- triangle
- saw
- square

Teach that the starting waveform changes harmonic content and therefore the character of the sound.

#### Pitch / register
At minimum:
- octave/register

Fine detune may be introduced if needed for a pad/thickness lesson.

#### Amp envelope
Expose:
- Attack
- Decay
- Sustain
- Release

The envelope should have a visual representation so the user can connect parameter values to the shape of the sound over time.

#### Filter
At minimum:
- low-pass cutoff
- resonance

#### Filter movement
The product should support enough filter-envelope behavior to demonstrate why a sound can start bright and become darker.

The exact UI for this should be determined during design.

#### Polyphony
The product must be able to demonstrate the difference between:
- monophonic playback
- polyphonic playback

It does not need an advanced voice-allocation interface.

### Deferred synthesis concepts

Unless required by a validated lesson, do not include in MVP:

- modulation matrix
- multiple LFO routing
- FM synthesis
- wavetable synthesis
- granular synthesis
- advanced unison
- complex effects routing
- modular patching

---

## 10. Learning model

Synth Lab should teach through **small creative challenges**, not a linear textbook.

A challenge should:

1. establish an audible goal
2. focus attention on one or two concepts
3. let the user experiment
4. produce a musical result inside the current jam
5. briefly explain why the result changed

### Example learning progression

#### Challenge 0 — Build the beat
**Goal:** Create a simple groove.

Teaches:
- loop
- step
- rhythm
- transport

#### Challenge 1 — Change the source
**Goal:** Make the bass sound richer/brighter.

Teaches:
- oscillator
- waveform
- harmonics at an introductory level

#### Challenge 2 — Make it pluck
**Goal:** Turn a sustained bass into a short, punchy sound.

Teaches:
- attack
- decay
- sustain
- release
- amplitude envelope

#### Challenge 3 — Make it darker
**Goal:** Reduce brightness without simply reducing volume.

Teaches:
- filter cutoff
- resonance
- frequency shaping

#### Challenge 4 — Add movement
**Goal:** Make the bass or pad start bright and become darker.

Teaches:
- filter envelope
- modulation over time

#### Challenge 5 — Build a pad
**Goal:** Turn a single-note sound into a chordal pad.

Teaches:
- monophony
- polyphony
- chord
- slower attack/release

#### Challenge 6 — Sound recipe
**Goal:** Build a recognizable sound using learned concepts.

Possible recipes:
- sub bass
- pluck
- brass-like pad
- flute-like lead
- warm pad

These should be described as synthesis approximations rather than claims of perfectly recreating acoustic instruments.

---

## 11. Gamification

Gamification should reinforce mastery and experimentation rather than engagement metrics.

### Use

- short challenges
- visible concept progression
- completion states
- unlocked sound recipes
- optional remix challenges
- a lightweight “Lab” or mastery map

Example:

- Oscillators ✓
- Envelopes ✓
- Filters ✓
- Polyphony ○
- Sound Recipes ○

### Avoid

Do not make the experience depend on:

- streaks
- daily retention pressure
- arbitrary XP grinding
- leaderboards
- punitive failure
- excessive badges
- fake scoring unrelated to musical understanding

A user's main reward should be:

> **My jam sounds better/different because I now understand how I changed it.**

---

## 12. Free Play

Lessons should not trap the user in tutorial mode.

The product needs a clear **Free Play** state where the user can:

- play/stop the jam
- edit patterns
- edit synth parameters
- switch tracks
- mute tracks
- change tempo
- reset a patch
- reset the project
- revisit a concept explanation

Lessons may suggest changes, but the instrument remains usable throughout.

The user should be allowed to discover sounds that do not match the lesson's expected result.

---

## 13. AI / agent experience

The AI layer is an enhancement to the instrument, not the instrument itself.

### Core agent use cases

A user should be able to ask a compatible agent things like:

- “Make the bass darker.”
- “Make this more plucky.”
- “Why does this sound so short?”
- “Show me what the filter is doing.”
- “Turn the pad into something brass-like.”
- “Make the lead softer without making it much quieter.”
- “Add a simple bass pattern that works with this drum loop.”
- “Explain what you changed.”

### Agent interaction principle

The agent should manipulate structured product state rather than simulate clicks or operate arbitrary DOM elements.

The same command layer should power:

- human UI controls
- WebMCP tools
- undo/history
- lesson actions

### Agent action visibility

When the agent performs a meaningful change, the application should be able to show something like:

**Bass — Agent change**

Filter cutoff  
`4.8 kHz → 720 Hz`

Resonance  
`8% → 18%`

**Why:** Lowering the cutoff removes more high-frequency harmonics, making the bass sound darker.

Actions:

- Hear Before
- Hear After
- Undo

The exact visual treatment should be explored in Figma.

### Explicit vs unsolicited agent actions

If the user explicitly asks the agent to change something, the agent may apply the change directly as long as it is immediately visible and reversible.

If the agent is merely suggesting an improvement without being asked to make it, prefer a preview/proposal before modification.

---

## 14. WebMCP contract

WebMCP should expose meaningful musical/product operations.

Do **not** expose a tool for every button or raw DOM action.

The tool layer should be semantic and stable.

Candidate tools:

- `get_project_state`
- `get_track_state`
- `set_tempo`
- `set_pattern`
- `set_notes`
- `set_chords`
- `set_synth_parameter`
- `apply_synth_patch`
- `play`
- `stop`
- `audition_track`
- `audition_change`
- `focus_control`
- `present_coach_message`
- `undo_last_change`
- `reset_track`

Exact schemas belong in the implementation specification, but the product contract is:

1. Tools operate through the application's command/state layer.
2. Tool inputs are validated.
3. Agent changes are grouped into understandable actions.
4. Every mutation can be undone.
5. Tool results return enough state for the agent to understand what actually happened.
6. The app remains completely usable when WebMCP is unavailable.

### WebMCP availability

As of this brief, Chrome's WebMCP Imperative API uses `document.modelContext.registerTool()` and remains experimental.

Therefore:

- feature-detect WebMCP support
- do not make core functionality depend on WebMCP
- provide a graceful “agent features unavailable” state
- keep the manual interface complete

An embedded LLM/chat backend is **not required for MVP**.

A compatible browser agent can use the registered WebMCP tools while Synth Lab exposes relevant changes and teaching feedback in the application.

---

## 15. Agent teaching behavior

When explaining synthesis, the agent should follow these rules.

### Prefer perceptual language first

Good:

> Lowering the filter cutoff removes some of the brighter harmonics.

Better than:

> Set the LPF frequency to 700 Hz.

The numeric value can accompany the explanation but should not replace it.

### Name the real concept

Do not permanently hide technical vocabulary.

Good:

> This Brightness control is the synth's low-pass filter cutoff.

### Explain the changed variable, not everything

If a user asks why the patch is plucky, focus on the envelope characteristics actually responsible.

Do not respond with a full synthesis lecture.

### Use A/B demonstrations

When practical, help the user hear the concept by temporarily comparing:

- old vs. new
- sine vs. saw
- filter envelope on vs. off
- mono vs. poly

### Never imply certainty about subjective taste

Use language such as:
- “This should make it darker.”
- “This is closer to a brass-like synth patch.”

Avoid presenting one patch as the objectively correct sound.

---

## 16. Core information architecture

The design agent should explore the final layout, but the product needs these conceptual areas.

### Global
- SoftArcade shell/navigation
- Synth Lab identity
- transport
- project/reset/help actions

### Track workspace
- four track identities
- pattern content
- mute/level
- selected track state

### Instrument editor
For synth tracks:
- oscillator
- envelope
- filter
- polyphony where relevant

### Learning layer
- current challenge
- concise instruction
- concept progress
- completion/next action

### Agent layer
- agent status when available
- visible agent actions
- explanations
- A/B
- undo

These areas may be combined or progressively disclosed. They do not need to become five permanent panels.

---

## 17. Design requirements

### 17.1 Use the SoftArcade Design System

The Figma design must start from **SoftArcade Design System v1 — Baseline**.

Reuse:
- foundations
- typography
- semantic colors
- spacing
- focus treatment
- existing components
- responsive patterns

Extend only when Synth Lab introduces a real new requirement.

### 17.2 Preserve SoftArcade character

Synth Lab should be playful and approachable, but it is a creative tool with more information density than a typical arcade game.

Avoid making it look like:
- Ableton Live
- a skeuomorphic hardware synth
- a generic SaaS dashboard
- a children's education app
- a neon “AI music” landing page

The design should feel like **SoftArcade grew a musical instrument**.

### 17.3 Prioritize the sound-making surface

The central creative interaction should dominate visual hierarchy.

Learning and agent UI should support the instrument rather than burying it.

### 17.4 Progressive complexity

The design should explore ways to move between:

- approachable beginner controls
- real synthesis controls

Potential patterns include:
- progressive disclosure
- contextual expansion
- perceptual labels paired with technical labels
- focused track editing

Do not decide that every synth parameter must be visible at once.

### 17.5 Demonstrate design decisions

The Figma case study should preserve meaningful exploration.

At minimum compare alternatives around:

- DAW-first vs. lesson-first hierarchy
- persistent agent panel vs. contextual agent feedback
- simplified controls vs. fully exposed synth controls
- knobs vs. sliders where appropriate
- desktop vs. narrow layout strategy

Keep rejected directions when they demonstrate a useful tradeoff.

---

## 18. Responsive requirements

### Primary target
Desktop/laptop browser.

Design around a workspace large enough for:
- tracks
- focused editing
- learning context

### Narrow/tablet
Must remain fully usable.

Prefer:
- focusing one track at a time
- vertical reflow
- collapsible secondary information

### Mobile
Mobile should support the core learning loop, but does not need to reproduce desktop information density.

The design should explore:
- stacked tracks
- focused single-track editing
- large touch targets
- vertically sequenced lesson content

Avoid interactions that require precise mouse-only dragging.

Do not create mobile variants of components unless their behavior genuinely changes.

---

## 19. Accessibility requirements

At minimum:

- visible keyboard focus
- logical keyboard navigation
- 44 × 44 CSS px preferred interactive hit targets where practical
- controls cannot rely on color alone
- synth parameters expose text labels and current values
- range controls support keyboard input
- sufficient text/control contrast
- reduced-motion behavior for nonessential animation
- clear mute/master-volume control
- no automatic audio on initial page load
- instructions should remain understandable without relying solely on animation

Audio is intrinsic to the product, so the complete educational value cannot be reproduced without hearing. However, the interface should still expose clear visual parameter/state information.

---

## 20. Audio startup requirement

Browser audio policies require the product to handle user activation explicitly.

The first session should include an intentional user action such as:

**Start Synth Lab**

or

**Start audio**

This action should initialize/resume the audio context.

Do not rely on autoplaying audio when the page loads.

This can be part of the product's onboarding rather than treated as an error state.

---

## 21. Implementation direction

### Existing application stack first

Synth Lab should be implemented within the current SoftArcade architecture.

Do not replace the framework or introduce a parallel application architecture merely for this feature.

Preferred application language:
- React
- TypeScript

### Audio layer

Preferred direction:

**Tone.js over the Web Audio API**, unless an implementation spike identifies a concrete reason not to use it.

Reasons:
- musical transport/scheduling abstractions
- sequences
- built-in synth primitives
- polyphonic synth support
- Web Audio foundation

Avoid writing custom DSP that does not contribute to the product goal.

### State architecture

UI, audio, lessons, history, and WebMCP should not each maintain independent versions of project state.

Establish a clear product state model and command layer.

Conceptually:

```text
Human UI ───────┐
Lessons ────────┼──> Application Commands ──> Project State ──> Audio Engine
WebMCP Agent ───┘              │
                               └──> History / Undo / Agent Activity
```

The exact state library should follow the current SoftArcade stack.

### Persistence

MVP should persist locally.

No account or cloud backend is required.

Persist:
- project/jam state
- lesson progress
- unlocked recipes if applicable
- basic preferences

Provide a clear reset mechanism.

---

## 22. Suggested domain model

This is conceptual, not a final TypeScript schema.

### Project
- id
- version
- tempo
- transport state
- tracks
- selected track
- lesson progress
- history

### Track
- id
- type: drums | bass | pads | lead
- mute
- level
- pattern
- synth patch if applicable

### SynthPatch
- oscillator settings
- envelope
- filter
- filter movement/envelope
- polyphony
- optional supported voice settings

### Lesson / Challenge
- id
- concept
- goal
- starting state
- completion criteria
- explanation
- optional next challenge

### AgentAction
- id
- timestamp
- affected track
- changed parameters
- before values
- after values
- explanation/reason
- reversible transaction reference

---

## 23. Challenge validation

Avoid audio-classification/ML requirements in MVP.

Challenges should be validated using known project state where possible.

Examples:

“Make it darker”
- user meaningfully lowers cutoff within a useful range

“Make it plucky”
- short attack
- short decay
- low sustain

“Make this polyphonic”
- voice mode changes from mono to poly
- chord contains multiple simultaneous notes

Validation should be forgiving.

The challenge is an educational guide, not a puzzle with one exact solution.

---

## 24. MVP user flows

### Flow A — First session

1. Enter Synth Lab from SoftArcade.
2. See a concise premise and explicit Start action.
3. Start audio.
4. Hear a simple prebuilt four-track jam.
5. See the first challenge.
6. Modify one meaningful control.
7. Hear the result immediately.
8. Receive concise concept feedback.
9. Continue editing or advance to the next challenge.
10. Reach Free Play without leaving the musical workspace.

### Flow B — Ask an agent to change a sound

1. User has an existing jam.
2. Compatible browser agent inspects project state through WebMCP.
3. User asks for a musical change.
4. Agent invokes semantic Synth Lab tools.
5. Controls visibly update.
6. Audio reflects the change.
7. Synth Lab records/displays the agent action.
8. User can hear before/after.
9. User can undo or continue editing manually.

### Flow C — Ask why something sounds the way it does

1. User selects or discusses a track.
2. Agent inspects its patch.
3. Agent identifies the most relevant parameters.
4. Relevant control(s) receive contextual focus/highlight.
5. Explanation connects audible result to real synth terminology.
6. User can audition a contrasting state.
7. The original state can be restored.

### Flow D — Sound recipe

1. User chooses a recipe/challenge.
2. Product establishes or preserves a suitable musical context.
3. User changes a small sequence of parameters.
4. Each step is audible.
5. Final patch remains in the user's jam.
6. User can save/remix/free-play from that result.

---

## 25. Required states for design

The Figma design should account for at least:

- first visit / audio not initialized
- default jam
- playing
- stopped
- selected track
- active lesson
- lesson/challenge complete
- Free Play
- parameter being taught/highlighted
- agent unavailable
- agent available/connected where detectable
- agent action in progress if relevant
- agent action complete
- agent action error
- before/after comparison
- undo confirmation/state restoration
- reset confirmation
- narrow/mobile layout

Do not create separate full screens when a component/state treatment communicates the behavior more clearly.

---

## 26. MVP scope

### Required

- SoftArcade-integrated Synth Lab route/product
- four tracks: Drums / Bass / Pads / Lead
- shared transport
- editable drum pattern
- editable musical patterns for the synth tracks
- working bass synth
- working pad synth
- working lead synth
- oscillator waveform control
- amp ADSR
- low-pass filter cutoff/resonance
- enough filter modulation to teach filter-envelope behavior
- mono/polyphony demonstration
- mute/level
- at least one cohesive prebuilt jam
- Free Play
- at least four polished teaching challenges
- at least two sound recipes
- contextual concept explanations
- local persistence
- undo/history sufficient for agent actions
- WebMCP feature detection
- semantic WebMCP tool registration
- at least one complete agent-driven teaching/editing flow
- responsive/narrow experience
- keyboard/focus/accessibility fundamentals

### Strongly preferred

- A/B before/after interaction
- visual envelope representation
- visible agent action history
- concept mastery/progress view
- basic patch reset
- project reset

### Optional / later

- MIDI input
- additional drum kits
- reverb/delay
- shareable project URL
- project export
- audio recording/export
- additional synth architectures
- generative audio
- cloud accounts

---

## 27. Explicit non-goals

MVP is **not**:

- a full DAW
- a multitrack audio recorder
- an Ableton Live replacement
- a professional mastering/mixing environment
- a VST/AU plugin
- a stem separator
- an AI song generator
- a text-to-music product
- a full music-theory course
- a complete synthesizer curriculum
- a social network
- a marketplace
- a cloud collaboration app

Do not let the implementation grow in these directions without changing the product brief.

---

## 28. Success criteria

### Product

A first-time user can:

- start sound without setup confusion
- understand that there are four musical tracks
- change a synth control and hear the effect quickly
- complete an introductory synthesis challenge
- continue into Free Play
- recover from unwanted changes

### Learning

After early challenges, the user should be able to form basic statements such as:

- “The oscillator is the starting waveform.”
- “The envelope changes how a note evolves over time.”
- “The filter changes which frequencies/harmonics come through.”
- “Polyphony lets the synth play multiple notes at once.”

Formal learning research is outside MVP, but the interaction design should support these mental models.

### Agent experience

A compatible agent can:

- inspect current project state
- make a meaningful musical change
- explain the relevant concept
- visibly update the product
- allow the user to undo
- avoid bypassing the normal application state model

### Design-system

The feature:

- uses SoftArcade foundations
- reuses existing shared components
- creates new system components only where justified
- clearly separates global vs. Synth Lab-specific additions
- remains coherent across desktop and narrow layouts

### Engineering

The MVP:

- schedules the core loop reliably
- avoids obvious timing drift in normal use
- does not lose project state during ordinary navigation/refresh
- handles unsupported WebMCP gracefully
- does not autoplay unexpectedly

---

## 29. Design-phase deliverables

The Figma/design agent should use this brief as source of truth and produce:

1. Product/experience map
2. Primary user flows
3. Low-fidelity workspace explorations
4. At least 2–3 meaningful layout/interaction directions
5. Explicit tradeoff notes
6. Selected direction
7. SoftArcade design-system extension inventory
8. High-fidelity desktop experience
9. Narrow/mobile strategy
10. Required interaction states
11. Prototype of the core teaching loop
12. Prototype of the agent-change / explanation / undo loop
13. Handoff-ready component and behavior documentation

The design process should preserve rejected directions when they help explain the final decision.

Do not jump directly from this brief to a polished final screen.

---

## 30. Implementation-phase deliverables

The implementation agent should use:

1. this product brief
2. the approved Synth Lab Figma design
3. the SoftArcade Design System source of truth

If this brief and approved Figma disagree on visual/layout detail, Figma owns the final approved design intent.

If Figma introduces behavior that conflicts with a product requirement in this brief, flag the conflict rather than silently choosing one.

Implementation should proceed as vertical slices.

Suggested order:

1. route + shell + audio initialization
2. transport + shared project state
3. drum sequencer
4. one complete synth track
5. remaining synth tracks
6. lesson/challenge framework
7. history/undo
8. WebMCP command layer
9. agent teaching flow
10. persistence
11. responsive/accessibility polish
12. final Figma-vs-production validation

---

## 31. Open questions for design exploration

These are intentional design questions, not permission to change MVP scope.

### Workspace hierarchy
Should the first-time experience feel:
- instrument-first
- challenge-first
- or dynamically transition from lesson-first to instrument-first?

### Track editing
Should all four tracks expose mini editors simultaneously, or should selecting a track open a focused editor?

### Synth controls
When should perceptual labels such as “Brightness” transition into real technical labels such as “Filter Cutoff”?

### Agent presence
Should agent activity live in:
- a persistent panel
- contextual inline cards
- transient overlays plus history
- a combination?

### A/B
What is the fastest way to compare an agent or lesson change without interrupting the jam?

### Knobs vs. sliders
Which representation best balances:
- learnability
- precision
- keyboard accessibility
- mobile usability
- visual connection to synthesis conventions?

### Mobile
Which parts of the four-track workspace need to remain simultaneously visible, and which should become focused/stacked?

The design agent should explore these questions rather than assuming conventional DAW patterns are correct.

---

## 32. Research basis

The product direction is informed by several existing patterns and current platform capabilities.

### Ableton Learning Synths
https://learningsynths.ableton.com/

Relevant precedent:
- synthesis concepts taught through direct manipulation and listening
- interactive envelopes, oscillators, filters, and recipes
- playground mode
- learning real concepts without requiring external equipment

Synth Lab should not copy its visual design or lesson structure. The opportunity is to integrate this type of learning into an actual multi-track creative jam and agent collaboration model.

### Ableton Learning Music
https://learningmusic.ableton.com/

Relevant precedent:
- immediate browser-based music making
- simple patterns
- learning by toggling, combining, and creating small musical ideas

Synth Lab should preserve a similarly low barrier to first musical output.

### WebMCP — Chrome Imperative API
https://developer.chrome.com/docs/ai/webmcp/imperative-api

Relevant platform constraint:
- structured tools can be registered through `document.modelContext.registerTool()`
- tools can call application state-management functions
- the API is experimental, so Synth Lab must feature-detect support and remain usable without it

### Tone.js
https://tonejs.github.io/

Relevant implementation capability:
- Web Audio framework with musical scheduling abstractions
- shared transport
- sequencing
- synth primitives
- polyphonic synth support

### Web Audio API
https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API

Relevant implementation capability:
- oscillators
- filters
- gain
- scheduled audio parameters
- browser-native audio graph

### Web Audio autoplay behavior
https://developer.chrome.com/blog/autoplay/

Relevant product constraint:
- audio playback should begin from an explicit user gesture
- an AudioContext created before activation may be suspended and require `resume()`

---

## 33. Source-of-truth statement

This document defines **what Synth Lab is, who it is for, the MVP product contract, learning principles, agent behavior, and technical/product boundaries**.

The SoftArcade Design System defines the existing visual and component foundation.

The approved Synth Lab Figma file will define the final interaction/layout design.

The implementation should satisfy all three.

If a future design or engineering decision materially changes:
- target user
- core learning model
- track model
- agent behavior
- MVP scope
- technical boundary
- major non-goal

update this brief rather than allowing the product definition to drift silently.
