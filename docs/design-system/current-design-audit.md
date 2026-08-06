# SoftArcade Current Design Audit

**Status:** Baseline / Pre-Redesign  
**Audit date:** 2026-08-06  
**Figma:** [Soft Arcade — Design System & Current Product Snapshot](https://www.figma.com/design/PtTVVeJV510W5GMowTEbMu/Soft-Arcade?node-id=0-1)

This document records the existing SoftArcade visual language and reusable product patterns before a future design phase. It is descriptive first: inconsistencies and opportunities are recorded, not silently redesigned.

## Provenance

- **CURRENT** — directly observed in source or the running product.
- **NORMALIZED** — repeated current values consolidated where the implementation strongly suggests a shared role.
- **PROPOSED** — a future decision. This baseline intentionally contains very few proposed decisions.

## Capability and tooling result

- Figma authentication succeeded.
- The authenticated account reports a Starter plan and View seat.
- Code-to-canvas capture was available and produced editable Figma layers.
- Native `use_figma` writes were available despite the reported seat and were verified by reading the created objects back.
- The supplied Soft Arcade file was used; no replacement file was created.
- `search_design_system` found no relevant existing SoftArcade library assets to reuse.
- The client did not expose a `create_design_system_rules` prompt. Repository rules were therefore authored from the verified system in the root `AGENTS.md`.
- Figma's runtime did not provide Arial or Helvetica, the CURRENT product stack. That initial blocker was resolved through an explicit NORMALIZED decision: Figtree is now the intentional product UI typeface. Inter remains only in untouched baseline documentation chrome where previously disclosed.

## Product and implementation inventory

SoftArcade is a Next.js 16 / React 19 App Router application. Global product styling is concentrated in `src/app/globals.css`; each game also has a CSS module. The UI uses semantic HTML, React components, SVG/image sprites, and a canvas renderer for Near Miss. There is no Tailwind configuration or external icon library.

Shared application patterns include:

- `Header` and primary navigation
- `Footer`
- homepage hero and calls to action
- `ArcadeGameCard` discovery cards
- labs/article cards and markdown article presentation
- `GamePageShell`, game stage, side rail, leaderboard, and instructions panel
- text/legal page shell
- advertisements and empty placeholders
- game-specific ready, playing, score, result, leaderboard, and modal UI

### User-facing route groups

| Route or group | Meaningful view | Audit status |
| --- | --- | --- |
| `/` | Home, hero, navigation, discovery cards | Captured |
| `/games` | Game library and card collection | Captured |
| `/games/beat-the-scrambler` | Game shell, configuration/ready UI, leaderboard, instructions | Captured (ready) |
| `/games/near-miss` | Game shell, canvas stage, HUD/ready UI, leaderboard, instructions | Captured (ready) |
| `/labs` | Distinct editorial index and article cards | Captured |
| `/labs/[slug]` | Article-detail template | Source audited; represented by labs language |
| `/about`, `/privacy`, `/terms`, `/contact` | Near-identical text-page template | Grouped and source audited |
| unknown route | 404 state | Source audited |

The snapshot favors representative coverage over redundant pages. Five desktop views were captured. Mobile/narrow and transient game states were inspected in source but not placed in the as-shot page because faithful viewport/state automation was unavailable; they were not fabricated.

## Figma organization

| Page | Purpose |
| --- | --- |
| `00 — Cover` | Baseline status and purpose |
| `01 — Current Product` | Editable code-to-canvas captures of the five representative views |
| `02 — Audit` | Typography, color, spacing/shape, components, interaction, responsive, accessibility, and state findings |
| `03 — Foundations` | Semantic color specimens, spacing/radius scales, effects, exact type specification, and motion notes |
| `04 — Components` | Nine verified native component families and resolved migration provenance |
| `05 — Patterns` | Current shell plus normalized discovery/control compositions built from instances |
| `06 — System Reference` | Structural reconstruction, comparison, and recaptured Figtree production validation |
| `07 — Opportunities` | Deferred consistency, hierarchy, component, accessibility, responsive, and interaction work |

## Foundations discovered

### Color

The product is a dark arcade interface built from near-black canvas/surface layers, warm off-white primary text, muted gray secondary text, cyan action/focus accents, magenta decorative accents, and compact success/warning/danger colors. Game surfaces introduce a distinct blue-black background.

The Figma file contains 82 scoped variables across four single-mode collections:

- **Primitives (24):** neutral, cream, cyan, magenta, yellow, green, red, ink, black, and observed translucent values.
- **Semantic (17):** canvas/surface/elevated/game backgrounds; primary/secondary/game-muted text; default/strong borders; primary action and on-action; success/warning/danger; cyan/magenta accents; focus ring.
- **Dimensions (17):** spacing `4, 8, 12, 16, 18, 20, 24, 28, 32, 48`; radii `5, 6, 8, 10, full`; borders `1, 3`.
- **Typography (24):** Figtree family; Regular, Bold, ExtraBold, and Black styles; seven sizes; nine line heights; and normalized zero, label, and data tracking.

Semantic colors alias primitives. Variables have explicit scopes and CSS-oriented WEB code syntax. No speculative light mode was added.

### Typography migration

- **CURRENT baseline:** `Arial, Helvetica, sans-serif`, with one isolated Beat the Scrambler `Open Sans` declaration.
- **NORMALIZED system and updated production:** Figtree, centrally loaded with `next/font/google` and exposed through `--font-figtree` and `--font-family-sans`.

Figtree was selected from confirmed MCP-available candidates Figtree, Inter, DM Sans, and Atkinson Hyperlegible Next. It combines reliable small-size UI rendering, Regular-through-Black weights matching the existing 400/700/800/900 usage, and enough restrained playfulness for games and future creative tooling.

Nine semantic Figma text styles were created with variable-bound family, style, size, line height, and tracking:

- `Display`
- `Heading/Large`
- `Heading/Medium`
- `Heading/Small`
- `Body`
- `Body/Small`
- `Label`
- `Label/Large`
- `Data/Score`

Label tracking maps the recurring CURRENT `0.08em` usage to `0.96px` at 12px; data tracking maps `0.04em` to `0.64px` at 16px. Historical captures retain their original typography and were not altered.

### Shape and elevation

Stable geometry includes 1px default borders, 3px emphatic/game borders, small-to-medium radii, pill geometry, subdued card elevation, stronger hover elevation, and cyan/magenta glows. Four effect styles were created:

- `Elevation/Card`
- `Elevation/Card Hover`
- `Glow/Cyan`
- `Glow/Magenta`

### Motion

Current motion is functional and playful: card/link transitions, mascot float/glow loops, and animated Near Miss card art. `prefers-reduced-motion: reduce` disables animation and transitions globally. Timing is not yet expressed through Figma variables because motion values are limited and implementation-specific.

## Component inventory and mappings

Nine foundational component families were created natively and verified with descriptions, Auto Layout, semantic text styles, and variable bindings:

- `Panel` — semantic fill/border, dimension-bound radius/padding/gap, editable `Content` slot.
- `Game Shell` — semantic game fill/border, clipped current desktop stage geometry, editable `Game Content` slot.
- `Button` — Primary, Secondary, and Danger styles across five interaction states; editable label.
- `Icon Button` — Default and Danger styles across five states; 44px target and swappable icon.
- `Game Card` — the two current game contexts across Default, Hover, and Focus states; editable title, description, and CTA.
- `Input` — Default, Focus, Disabled, Error, and Success score-name states.
- `Difficulty Tabs` — Easy, Medium, and Hard active variants.
- `Dialog` — Result, Leaderboard, and Confirm contexts using nested Button instances.
- `Score / Status` — Cyan, Green, Magenta, Warning, and Danger tones.

| Figma component/pattern | Code component or selector | Source file | Status |
| --- | --- | --- | --- |
| Panel | `.side-panel`, `.how-to-play` | `src/app/globals.css`, `src/components/Leaderboard.tsx`, `src/components/GamePageShell.tsx` | CURRENT, native component |
| Game Shell | `GamePageShell`, `.game-stage` | `src/components/GamePageShell.tsx`, `src/app/globals.css` | CURRENT, native component |
| Application Header | `Header` | `src/components/Header.tsx` | CURRENT, captured/pattern documented |
| Game Card | `ArcadeGameCard` | `src/components/ArcadeGameCard.tsx`, `src/app/globals.css` | NORMALIZED native component |
| Button / Link Button | `.primary-link`, `.secondary-link`, game buttons | `src/app/globals.css`, game CSS modules | NORMALIZED native component; implementation APIs still vary |
| Leaderboard | `Leaderboard` | `src/components/Leaderboard.tsx` | CURRENT, captured/pattern documented |
| Score / Status | `ScorePill`, `NearMissHud` | `src/games/shared/car/hud/ScorePill.tsx`, `src/games/near-miss/ui/NearMissHud.tsx` | NORMALIZED native component |
| Dialog / Result | game-specific result overlays | `src/games/near-miss/ui/NearMissGameOverModal.tsx`, `src/games/beat-the-scrambler/BeatTheScramblerGame.tsx` | NORMALIZED native component; contextual variation retained |
| Input / Difficulty Tabs | game result fields and leaderboard switcher | game TSX and CSS modules | NORMALIZED native components |
| Article Card | `LabArticleCard` | `src/components/LabArticleCard.tsx`, `src/app/globals.css` | CURRENT, captured |

No Code Connect relationship is claimed; none existed in the repository.

## Recurrent patterns

- Header plus centered content container
- Responsive game discovery list/grid
- Game page: heading → stage with rail → instructions
- Side-rail control/leaderboard clusters
- Score and result presentation inside game-specific surfaces
- Editorial index and article-detail composition
- Narrow breakpoints at approximately 900px and 640px, with column collapse, reduced margins, and control reflow

Patterns and System Reference now use live instances of the shell, panels, game card, button, input, difficulty tabs, dialog, and score/status components. Game-specific stage internals and contextual illustration remain legitimate implementation-owned compositions.

## Production round-trip validation

The normalized font was implemented after Figma validation:

- `src/app/layout.tsx` loads Figtree centrally through `next/font/google` and places its generated variable on `<html>`.
- `src/app/globals.css` defines the typography source of truth and semantic size/weight/line-height/tracking tokens.
- `src/games/beat-the-scrambler/styles.module.css` removes the isolated Open Sans declaration and inherits the shared family.

An initial validation exposed a CSS-variable scope error: `--font-family-sans` was declared on `:root` while `--font-figtree` was initially attached to `<body>`, causing a serif browser fallback. Moving the generated variable to `<html>` fixed the inheritance boundary. The production build then completed successfully.

The updated homepage was recaptured with `generate_figma_design` into `06 — System Reference / Production Validation / Figtree`. Read-back confirms captured text uses Figtree Regular, Bold, and ExtraBold. The old `01 — Current Product` evidence remains untouched.

## Audit findings

### Consistent

- Dark canvas and layered dark surfaces
- Warm light primary text with muted secondary text
- Cyan primary action/focus language
- Compact radii and outlined panel geometry
- Reusable page width and section rhythm
- Semantic landmarks, labelled navigation/regions, and reduced-motion handling

### Variation

- Cyan and magenta accents have legitimate promotional/game-specific uses.
- Individual games use different internal visual treatments and HUD needs.
- Game result and score presentations vary with each game mechanic.

### Inconsistent or one-off

- Similar cards and panels use several padding and radius values for the same apparent role.
- Primary actions are implemented as both shared link styles and unrelated game-specific buttons.
- Focus, hover, pressed, and disabled treatments vary across global and game CSS.
- Typography roles are visually recognizable but not encoded as shared implementation tokens.
- Some colors repeat as near-duplicates instead of aliases or CSS custom properties.
- Narrow-layout strategies differ between the shared shell and individual games.
- Loading, empty, and failure feedback is present but has no unified status pattern.

## Accessibility observations

- **Positive:** semantic headings/landmarks, labelled navigation and regions, labelled SVG mascot, keyboard-visible focus on major links/cards, and a global reduced-motion rule.
- **ACCESSIBILITY:** focus treatment is not uniformly applied to all game controls.
- **ACCESSIBILITY:** several compact controls and tags may fall below a comfortable touch target.
- **ACCESSIBILITY:** muted gray text and colored data/status text should receive formal contrast measurement against every game surface.
- **ACCESSIBILITY:** some game feedback depends strongly on color and motion; persistent text/icon equivalents should be verified.
- **ACCESSIBILITY:** canvas-based Near Miss requires continued scrutiny for nonvisual instructions, status announcements, and keyboard equivalence.

This is an obvious-concerns review, not a full WCAG audit.

## Unresolved questions

- Which transient states should be captured through a dedicated deterministic test/state harness: loading, failure, playing, complete, and modal open?
- Are current game-specific divergences intentional identity or accumulated implementation drift?
- Should shared status, button, and input abstractions be introduced in code before Code Connect is considered?
- Which mobile devices and minimum supported viewport should anchor future responsive validation?

## Future design opportunities — not implemented

- Consolidate same-purpose card/panel spacing only after validating all contexts.
- Evaluate the normalized type hierarchy in longer editorial content and narrow game layouts.
- Define shared action, focus, input, and status behavior across games.
- Establish a consistent narrow game-shell strategy while preserving game mechanics.
- Formalize contrast and target-size acceptance criteria.
- Decide which game-specific visual language belongs in shared semantic tokens versus game-local tokens.
- Add deterministic state stories/capture routes so interaction states can be compared without modifying production behavior.

These are inputs to a separate design phase. No homepage, brand, game, or product redesign was performed in this baseline.
