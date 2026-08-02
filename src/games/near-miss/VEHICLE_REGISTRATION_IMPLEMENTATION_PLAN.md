# Near Miss Vehicle Registration System — Implementation Plan

Plan for GitHub issue [#30 — Add Semi Automated Vehicle Registration System and Refine Procedure](https://github.com/licraw/Soft-Arcade/issues/30).

The issue is treated as the product requirements. The current repository code is
treated as authoritative for how the game actually behaves. Where the two
disagree, or where the issue assumes infrastructure that does not exist, the
conflict is documented in section 9 instead of being silently resolved.

Status: **plan only — no implementation has started.** Nothing in this document
changes runtime behavior, spawn weights, debug constants, vehicle configs, or
assets.

---

## 1. Verification of the issue's assumptions against current code

Every load-bearing claim in the issue was checked against the code. Result:
the issue is technically accurate about the game. It is optimistic about the
surrounding project infrastructure (tests, CI, script tooling), which does not
exist yet — see section 9.

| Issue claim | Verified? | Where in code |
| --- | --- | --- |
| Registration needs a curated source SVG **and** a normalized public SVG **and** a registry entry; one alone does nothing | ✅ | `VEHICLE_SPRITE_PIPELINE.md`; registry consumed only by the six engine/render files; ready-screen imports of `ui/blue-sedan.svg` / `ui/redcar.svg` in `NearMissGame.tsx:10-11` are illustration-only |
| Unknown vehicle IDs silently fall back to the default blue sedan | ✅ | `engine/vehicleConfig.ts:104-113` (`getVehicleConfig` returns the `DEFAULT_TRAFFIC_VEHICLE_ID` entry for any unknown id) |
| Failed image loads appear only as fallback art, with no diagnostics | ✅ | `render/canvasRenderer.ts:15-21` (bare `image.src = spritePath`, no `onload`/`onerror`); `drawMissingVehicleAsset` at `canvasRenderer.ts:108-123` draws the crossed rectangle |
| Debug overlay is only enabled by editing source | ✅ | `engine/tuning.ts:10` (`debug: false`); copied once into runtime state at `gameLoop.ts:330` (`debug: TUNING.debug`); no query-string or UI toggle |
| Spawn selection is a weighted roll over entries with `spawnWeight > 0` | ✅ | `vehicleConfig.ts:115-117` (`getSpawnableTrafficVehicleConfigs`), `spawner.ts:271-296` (`chooseTrafficVehicleConfig`) |
| Focused testing currently requires temporarily editing committed spawn weights | ✅ | No selector exists; `spawner.ts` reads the registry directly with no override hook |
| Collision zones are normalized rectangles in rendered-sprite space; center `(0,0)`, corners `(±0.5, ±0.5)` | ✅ | `vehicleGeometry.ts:81-104` (`transformLocalZone`: `zone.x * renderWidth`, `zone.width * renderWidth / 2`) |
| Near-miss zones expand **each collision rectangle independently** by fixed pixels; no unified hull | ✅ | `vehicleGeometry.ts:42-46` + `:87-88` (`halfWidth = zoneWidth/2 + growX`) — grow is added per-rectangle, in canvas pixels, before rotation |
| Collision overlap always takes precedence over near-miss | ✅ | `vehicleGeometry.ts:60-67` (`isVehicleNearMissOverlap` requires **no** collision overlap); `gameLoop.ts:420-423` starts the crash on collision |
| Near-miss also requires relative speed, pass threshold, not-already-awarded | ✅ | `gameLoop.ts:627-640` (`canAwardNearMiss`, `minNearMissRelativeSpeed`), `collision.ts` (`hasPlayerPassedTraffic`), `TrafficCar.nearMissed` |
| Collision/near-miss polygons scale with rendered bounds, so `spriteAspectRatio`, `uniformVisualScale`, occupancy, global sprite scales, and spawn variance all change collision geometry | ✅ | `tuning.ts:179-197` (`getRenderedSpriteBounds`), `tuning.ts:137-140` (global scales), `spawner.ts:163-169` (variance) |
| `nearMissGrowX/Y` are fixed pixels while bodies are lane-relative, so near-miss feel varies with canvas size | ✅ | grow applied post-scaling in `transformLocalZone`; lane width from `shared/car/laneSystem.ts` (`maxRoadWidth: 560`, `roadWidthRatio: 0.86`) |
| Resize recomputes traffic bodies without their spawn variance | ✅ | `gameLoop.ts:236-242` (`resize` calls `getTrafficBodySize` with default variance of 1) |
| Packet safety assumes a worst-case `occupancyLengthScale` of `1.28` | ✅ | `tuning.ts:68` (`trafficMaxOccupancyLengthScale: 1.28`), used in `spawner.ts:233` |
| Debug colors: cyan occupancy, purple rendered bounds, green player zones, red traffic zones, yellow near-miss | ✅ | `canvasRenderer.ts:125-197` (`drawDebugOverlays`) |
| Player sprite gets +180° yaw; traffic gets none | ✅ | `vehicleGeometry.ts:27-32` |
| `traffic-sedan.svg` exists in public but has no registry entry | ✅ | file present; absent from `NEAR_MISS_VEHICLE_CONFIGS` — a real instance of the "unregistered runtime asset" warning case |
| `vehicleConfigId` is a general string, so typos aren't caught at compile time | ✅ | `spawner.ts:16` (`vehicleConfigId: string`) |
| Crash-yaw traffic uses the same yaw for art and geometry | ✅ | `canvasRenderer.ts:166-177` and `gameLoop.ts` pass the same `crashMotion.yawDeg` into both |

One registry nuance the issue does not mention, but which shapes the
registration command: `NEAR_MISS_VEHICLE_CONFIGS` is declared
`as const satisfies readonly NearMissVehicleConfig[]` (`vehicleConfig.ts:102`),
and `spriteAspectRatio` values are written as expressions (`128 / 192`). Any
generated entry must preserve both conventions, and the generator must not
break the `as const` literal (see section 6, Registration).

---

## 2. Requirement → file map

| Issue requirement | Existing files involved | New files (proposed) |
| --- | --- | --- |
| §1 Registration command | `engine/vehicleConfig.ts` (entry insertion), `public/games/near-miss/vehicles/` (SVG output), `src/games/near-miss/ui/` (source input), `package.json` (script) | `scripts/near-miss/register-vehicle.ts`, shared lib `scripts/near-miss/lib/` |
| §2 Runtime SVG scaffolding + source inspection | `public/games/near-miss/vehicles/README.md` (format spec is the contract) | `scripts/near-miss/lib/svgInspect.ts`, `scripts/near-miss/lib/svgScaffold.ts` |
| §3 Registry generation + warnings | `engine/vehicleConfig.ts`, `engine/tuning.ts` (`trafficMaxOccupancyLengthScale` for the warning) | `scripts/near-miss/lib/registryEntry.ts` (deterministic entry formatter, shared with the studio export) |
| §4 Pipeline validator | `engine/vehicleConfig.ts` (imported at validation time), both SVG folders, `package.json`, CI | `scripts/near-miss/validate-vehicles.ts`, `.github/workflows/ci.yml` |
| §5 Focused vehicle development mode | `NearMissGame.tsx` (read params, thread options), `engine/gameLoop.ts` (accept debug/vehicle overrides), `engine/spawner.ts` (spawn override hook), `engine/tuning.ts` (debug default unchanged) | `src/games/near-miss/dev/devParams.ts` (parse + validate query params, dev-only gate) |
| §6 Geometry authoring mode | Reuses **unchanged**: `engine/vehicleGeometry.ts` (transforms + SAT), `engine/tuning.ts` (`getRenderedSpriteBounds`, `getTrafficBodySize`, `getPlayerBodySize`), `shared/car/laneSystem.ts`, debug drawing idioms from `render/canvasRenderer.ts` | `src/games/near-miss/dev/VehicleGeometryStudio.tsx` + support components; `src/app/dev/near-miss-vehicle-studio/page.tsx` (404s in production) |
| §7 Multi-viewport preview | `shared/car/laneSystem.ts` (lane width is the only width-dependent input) | preset widths inside the studio (e.g. 360 / 720 / 1100) |
| §8 Geometry test scenarios | `engine/vehicleGeometry.ts` (real SAT functions drive the sandbox verdicts), focused mode for live play | contact sandbox panel inside the studio + documented manual scenario list |
| §9 Runtime asset diagnostics | `render/canvasRenderer.ts:15-21` (preload loop) | small change in place: `onerror`/`onload` handlers + dev-only console diagnostics |
| §10 Documentation | `VEHICLE_SPRITE_PIPELINE.md`, `public/games/near-miss/vehicles/README.md` | updates in place; new sections for command/validator/studio |
| Tests (acceptance criteria) | none exist today | `vitest` config, `scripts/near-miss/__tests__/`, SVG fixtures under `scripts/near-miss/__fixtures__/` |

---

## 3. The four geometry concepts (authoritative definitions for all new code)

Everything built for this issue must keep these four concepts distinct. They
are already distinct in the engine; the tooling must not blur them.

1. **Rendered SVG bounds** — the rectangle the whole SVG viewport is drawn
   into. Computed by `getRenderedSpriteBounds()` (`tuning.ts:179-197`) from the
   occupancy body × global sprite scales × `uniformVisualScale`, clamped by
   `spriteAspectRatio`. Includes the SVG's transparent padding. Purple in the
   debug overlay. **This is the coordinate frame collision zones are normalized
   against** — not the visible art, not the occupancy body.
2. **Gameplay occupancy body** — `getTrafficBodySize()` /
   `getPlayerBodySize()` (`tuning.ts:144-164`). Drives lane placement,
   following, spawn spacing, packet stacking, and pass checks. Cyan in debug.
   **Not a hitbox.**
3. **Collision zones** — the `collisionZones` rectangles, normalized to
   rendered bounds, transformed to rotated world quads by `transformLocalZone`
   and tested with SAT. Multiple overlapping rectangles approximate the
   substantial body; mirrors, light corners, bumper tips, and decorative
   protrusions are intentionally left outside. Red (traffic) / green (player).
4. **Near-miss zones** — the *same* rectangles, each independently inflated by
   `nearMissGrowX/Y` **fixed canvas pixels** per side before rotation
   (`vehicleGeometry.ts:87-88`). Three collision rectangles produce three
   expanded shells, not one hull. Never cause crashes; collision overlap always
   wins (`isVehicleNearMissOverlap`). Yellow.

Hard rules for the new tooling, restating the issue with code confirmation:

- The studio and any suggestion logic must **never** derive collision zones
  from the SVG viewport, path/alpha bounds, or a single whole-car rectangle.
  Suggested geometry (template copy, class defaults) is always presented as an
  editable draft requiring visual confirmation.
- The studio must render near-miss zones by calling the real
  `getVehicleNearMissPolygons` (or `transformLocalZone` equivalents) so the
  preview shows the true independent per-rectangle expansion, including gaps
  and overlaps between shells — guaranteeing "debug geometry matches the
  polygons actually used by the game loop" by construction rather than by
  duplication.
- Forgiving behavior is preserved by not changing `vehicleGeometry.ts`,
  `gameLoop.ts` collision/near-miss ordering, or any existing config values.
  The tooling only makes authoring the already-forgiving rectangles easier.

---

## 4. Phases

The issue's three suggested phases are sound, with one amendment: the repo has
**no test runner, no TS script runner, and no CI**, so Phase 1 must also
bootstrap that infrastructure (see section 9, conflicts).

### Phase 1 — Validator, diagnostics, focused mode (foundation)

1a. **Tooling bootstrap + pipeline validator** *(recommended first slice — see section 5)*
   - Add devDependencies: `vitest`, `tsx` (both dev-only; no runtime impact).
   - Add `scripts/near-miss/validate-vehicles.ts`:
     - Imports `NEAR_MISS_VEHICLE_CONFIGS` directly (the registry file is pure
       TS with no DOM dependency; `canvasRenderer.ts` guards `window`, and the
       validator never imports the renderer), so validation always checks the
       real registry, including computed `spriteAspectRatio` expressions.
     - Errors: duplicate ids, duplicate sprite paths, missing public SVG,
       invalid/missing numeric root `width`/`height`, root vs `viewBox`
       mismatch, `spriteAspectRatio` ≠ width/height (epsilon compare), invalid
       `vehicleClass`, missing/malformed/non-positive collision zones,
       `<script>`/`<image>`/external URL/external font in SVG,
       `preserveAspectRatio="none"`, sprite path outside
       `/games/near-miss/vehicles/`.
     - Warnings: source SVG with no runtime counterpart, runtime SVG with no
       registry entry (today: `traffic-sedan.svg`), config with no apparent
       source asset, runtime file shared by multiple configs, zones extending
       well past ±0.5 normalized space, `occupancyLengthScale >
       NEAR_MISS_TUNING.trafficMaxOccupancyLengthScale`, near-miss growth
       outside the observed 11–18 px range, naming-convention drift.
     - Requires a small additive export: a runtime
       `NEAR_MISS_VEHICLE_CLASSES` const in `vehicleConfig.ts` from which the
       existing type union is derived (type-level behavior unchanged).
   - Package scripts: `near-miss:vehicle:validate`, `test` (`vitest run`), and
     an umbrella `check` (`tsc --noEmit` + validate + test).
   - CI: new `.github/workflows/ci.yml` running `npm ci` + `npm run check` +
     `next build` on pull requests. (Branch-protection enforcement is a repo
     settings action for the owner — noted as follow-up.)
   - Vitest tests with SVG fixtures (valid baseline, missing dimensions,
     mismatched viewBox, embedded script, external image, aspect mismatch).

1b. **Sprite-loading diagnostics**
   - In `canvasRenderer.ts` preload loop: attach `onerror` (and decode check)
     handlers that log config id, label, sprite path, and failure type via a
     dev-gated `console.error`. Fallback crossed-rectangle art unchanged.

1c. **Focused vehicle development mode**
   - `src/games/near-miss/dev/devParams.ts`: parses
     `?nearMissDebug=1&nearMissVehicle=<id>` from `window.location.search`,
     returns `null` in production builds (`process.env.NODE_ENV`, inlined by
     Next), validates the id against the registry **without** the silent
     fallback, and distinguishes "absent" / "valid" / "invalid".
   - `NearMissGame.tsx`: reads dev params once on mount; passes
     `{ debugOverride, focusedVehicleId }` into `NearMissGameLoop` options;
     renders a small dev banner showing the selected config id + label, or a
     visible error state for an invalid id (game still runs normally, but the
     banner says the id was not found — no silent sedan fallback for the
     *selection*).
   - `gameLoop.ts`: `debug: options.debugOverride ?? TUNING.debug` at state
     creation; threads `focusedVehicleId` into `spawnTrafficPacket` options.
   - `spawner.ts`: `chooseTrafficVehicleConfig(focusedVehicleId?)` — when set
     and valid, spawn only that vehicle; committed spawn weights untouched.
   - No params ⇒ identical behavior to today (default `undefined` everywhere).

### Phase 2 — Registration command

   - `scripts/near-miss/register-vehicle.ts` +
     `npm run near-miss:vehicle:register -- --source ... --id ... --label ...
     --class ... --template ...` (npm is the repo's package manager).
   - Behavior per the issue: verify source exists; reject duplicate id,
     duplicate sprite path, and existing output file without `--force`;
     scaffold the public SVG (transparent background, explicit numeric
     dimensions + matching viewBox, `<title>`/`<desc>`, wrapper `<g>`
     transform placeholder per the README spec, never
     `preserveAspectRatio="none"`); run source inspection and print actionable
     warnings for scripts/external refs/missing dimensions/suspicious
     masks/off-canvas art; generate a registry entry with the supplied
     id/label/class, derived `spriteAspectRatio` written as `WIDTH / HEIGHT`,
     starter occupancy/collision/near-miss values copied from the `--template`
     entry, and `spawnWeight: 0`; print every file created/modified plus the
     remaining manual review steps; support `--dry-run`.
   - Registry insertion strategy: insert the formatted entry (2-space indent,
     property order matching existing entries, via the shared
     `registryEntry.ts` formatter) immediately before the
     `] as const satisfies readonly NearMissVehicleConfig[]` anchor, then
     **re-import the modified file through tsx and run the Phase 1 validator**
     as a post-write self-check. Idempotence: identical re-run detects the
     existing id + identical entry and reports "already registered" with no
     changes.
   - Explicit non-automation (matches issue "Limits of Automation"): the
     command never guesses source center, padding, orientation, ideal
     dimensions, wrapper scale, or final geometry — it scaffolds and warns.
   - Tests: fixture-driven (temp-dir copies of a miniature registry + SVG
     folders) covering happy path, duplicate rejection, overwrite refusal,
     dry-run, idempotent re-run, and warning triggers.

### Phase 3 — Geometry authoring studio

   - Dev-only route `src/app/dev/near-miss-vehicle-studio/page.tsx` that calls
     `notFound()` in production builds, hosting
     `src/games/near-miss/dev/VehicleGeometryStudio.tsx`.
   - **Display**: sprite drawn into its real rendered bounds; overlays for
     rendered SVG viewport (purple), occupancy body (cyan), collision
     rectangles (red/green), near-miss shells (yellow) — all computed with the
     unmodified `tuning.ts`/`vehicleGeometry.ts` functions; selected-zone id +
     normalized numbers; current `nearMissGrowX/Y`; active canvas size.
   - **Editing**: add / select / move / resize / delete / duplicate / rename /
     enable-disable zones; drag handles update normalized values relative to
     rendered bounds; numeric inputs for direct editing; reset-to-template;
     `nearMissGrowX/Y` sliders with live independent-shell preview. Editing
     state lives in React only — the runtime registry is never mutated.
   - **Multi-viewport**: preset buttons (narrow ~360, typical ~720, wide
     ~1100+) re-deriving lane width/body/rendered bounds per preset, so the
     fixed-pixel near-miss growth is visibly compared across sizes; optional
     side-by-side.
   - **Contact sandbox** (scenario support): a draggable player ghost using
     the real player config and yaw slider; live "collision" / "near miss" /
     "clear" verdict computed by `doVehicleZonesOverlap` /
     `isVehicleNearMissOverlap`; preset ghost placements for the issue's
     scenario list (side impact, mirror-to-mirror, front/rear corner taps,
     direct front/rear, diagonal with yaw, close passes). Dynamic scenarios
     (crowded following, packet spacing, relative-speed gating) remain live
     gameplay checks via Phase 1 focused mode, and are documented as manual
     steps.
   - **Export**: "copy TypeScript config snippet" using the same
     `registryEntry.ts` formatter as the registration command (deterministic;
     includes zones, occupancy, visual scale, near-miss growth, aspect ratio,
     id). JSON copy as a secondary option. No direct file-writing in the first
     iteration (issue explicitly allows snippet-copy as sufficient).
   - Tests: unit tests for the editing reducer (normalized math for
     move/resize/duplicate) and formatter round-trip; geometry rendering
     itself is verified visually (see section 7).

### Documentation (runs through every phase)
   - `VEHICLE_SPRITE_PIPELINE.md`: replace the manual-weight/debug-flag
     procedure with command + focused-mode + studio workflow; keep the
     geometry reference sections.
   - `public/games/near-miss/vehicles/README.md`: point at the new commands;
     fix nothing else silently — it already documents the
     `uniformVisualScale` coupling correctly in its current revision.
   - Both docs get the required automated-vs-manual step split and the
     verbatim "Do not compensate for an off-center… SVG by skewing the
     collision rectangles" warning (already present in the pipeline doc at
     lines 371-373 — keep and echo in the studio UI itself).

---

## 5. Smallest useful first implementation slice

**Phase 1a: the pipeline validator (+ vitest/tsx bootstrap + CI).**

Why this one:

- Zero gameplay risk — pure Node scripts and dev dependencies; no runtime file
  changes at all.
- Immediately catches the real, currently-invisible failure classes (path
  typos, aspect drift, unregistered assets — one warning fires today for
  `traffic-sedan.svg`).
- Creates the infrastructure (tsx runner, vitest, fixtures, CI workflow, npm
  script conventions, the shared registry-import pattern) that Phases 1c, 2,
  and 3 all depend on.
- Ships value even if the rest of the issue is deferred.

A working increment after 1a: add 1b (five-line renderer diagnostic change),
then 1c (focused mode), each independently reviewable.

---

## 6. Automation vs. human judgment

**Safe to automate** (deterministic, verifiable):
- SVG root parsing, dimension/viewBox agreement, aspect-ratio derivation and
  cross-check, forbidden-feature detection (scripts, external refs, fonts,
  `preserveAspectRatio="none"`).
- Duplicate id/path detection; file existence and parity (source ↔ runtime ↔
  registry) checks.
- Registry entry scaffolding from a template, formatting, insertion, and
  post-insertion re-validation.
- `spawnWeight: 0` default; warning thresholds (occupancy vs. packet max,
  near-miss range, zones beyond sprite space).
- Focused-mode plumbing and debug activation.
- Snippet/JSON export serialization.
- CI execution of all of the above.

**Requires human/visual judgment** (the tooling assists but never decides):
- Source SVG cleanup, correct center, padding, and nose orientation.
- Runtime dimensions and wrapper transform values.
- Visual scale and occupancy width/length feel.
- Fitting collision rectangles to the *substantial* body — and deliberately
  excluding mirrors, light corner taps, minor bumper overhangs, antennas, and
  decorative trim. No automated fitting from SVG outlines, ever (issue
  non-goal, reaffirmed).
- Near-miss growth feel, reviewed at narrow/typical/wide canvases.
- All contact/close-pass scenario play-testing and packet/following behavior.
- Final spawn weight.

---

## 7. Reusable existing code

- `engine/vehicleGeometry.ts` — all transforms + SAT are pure functions;
  the studio and sandbox call them directly (guarantees parity with gameplay).
- `engine/tuning.ts` — `getRenderedSpriteBounds`, `getTrafficBodySize`,
  `getPlayerBodySize`, and the global scale constants are pure and reusable
  for studio previews at any canvas width.
- `shared/car/laneSystem.ts` — pure; gives correct lane width per preset
  viewport.
- `render/canvasRenderer.ts` — `strokeBounds` / `strokeZonePolygons` and the
  established color scheme; either export the two small helpers or mirror the
  ~15 lines in the studio (decide at implementation; exporting is preferred).
- `NearMissGame.tsx` `NearMissDebugToolbar` — precedent for dev-only UI and
  the styling idiom (`styles.debugToolbar`) the focused-mode banner can reuse.
- `getVehicleConfig` / registry exports — the validator and devParams import
  them as-is; only the additive `NEAR_MISS_VEHICLE_CLASSES` const is new.
- `public/games/near-miss/vehicles/README.md` SVG format spec — becomes the
  literal template for the scaffolder.

## 8. Proposed new artifacts (complete list)

| Kind | Path (proposed) |
| --- | --- |
| Script | `scripts/near-miss/register-vehicle.ts` |
| Script | `scripts/near-miss/validate-vehicles.ts` |
| Shared lib | `scripts/near-miss/lib/svgInspect.ts`, `svgScaffold.ts`, `registryEntry.ts`, `registryIO.ts` |
| Dev util | `src/games/near-miss/dev/devParams.ts` |
| Component | `src/games/near-miss/dev/VehicleGeometryStudio.tsx` (+ zone-editor subcomponents) |
| Route | `src/app/dev/near-miss-vehicle-studio/page.tsx` (production `notFound()`) |
| Tests | `scripts/near-miss/__tests__/*.test.ts`, `src/games/near-miss/dev/__tests__/*.test.ts` |
| Fixtures | `scripts/near-miss/__fixtures__/*.svg` (valid + each invalid class) |
| CI | `.github/workflows/ci.yml` |
| Config | `vitest.config.ts`; `package.json` scripts `near-miss:vehicle:register`, `near-miss:vehicle:validate`, `test`, `check`; devDeps `vitest`, `tsx` |
| Docs | updates to `VEHICLE_SPRITE_PIPELINE.md`, `public/games/near-miss/vehicles/README.md` |
| Engine (additive only) | `vehicleConfig.ts`: `NEAR_MISS_VEHICLE_CLASSES` const; `gameLoop.ts`/`spawner.ts`/`NearMissGame.tsx`: optional dev-override parameters defaulting to current behavior; `canvasRenderer.ts`: preload error handlers |

Note on fixtures vs. the public folder: the public README says "Do not commit
generated placeholder vehicles here" — test fixtures therefore live under
`scripts/near-miss/__fixtures__/`, never in `public/`.

---

## 9. Risks, conflicts, unclear requirements, and follow-ups

### Conflicts between the issue and the current repository

1. **CI does not exist.** There is no `.github/workflows/` directory, yet the
   issue's acceptance criteria require validation "in CI before changes can
   merge." Resolution: create the workflow in Phase 1a. Actually *enforcing*
   it (branch protection) is a repository-settings action only the owner can
   take — flagged as an owner task, not a code deliverable.
2. **No test framework or TS script runner.** No `test` script, no
   vitest/jest/tsx/ts-node anywhere in `node_modules/.bin`, no lint script;
   type-checking currently happens only inside `next build`. The issue's
   "project's normal validation or test command" does not exist. Resolution:
   bootstrap `vitest` + `tsx` and a `check` script in Phase 1a and document it
   as the project's validation command. This is scope the issue implies but
   never states.
3. **`deploy:pages` runs `next build` directly.** Hooking validation into
   `build` (e.g. `prebuild`) would change the deploy path's behavior.
   Resolution: keep validation in `check` + CI only; do not touch the build
   chain. If the owner wants validation to hard-gate deploys, that is a
   follow-up decision.
4. **Registry is an `as const` literal with expression-valued fields.** Naive
   JSON serialization would destroy the `128 / 192` idiom and the const
   assertion. Resolution documented in Phase 2 (anchor insertion + shared
   formatter + post-write revalidation). Residual risk: manual edits that move
   the anchor; mitigated because the command fails loudly and validates after
   writing.
5. **"Invalid test IDs must not silently resolve to the default sedan"** vs.
   `getVehicleConfig`'s global fallback, whose removal is an explicit
   non-goal. Resolution: focused mode validates the id itself in
   `devParams.ts` and shows the error banner; the global fallback stays.
   Typed vehicle ids (removing the string-typed `vehicleConfigId`) → follow-up
   issue.
6. **Dev-only gating on a statically-deployed site.** `NODE_ENV` is inlined at
   build time by Next, so "development-only" means *local dev server only* —
   the studio and focused mode will not exist on the deployed Cloudflare Pages
   site. Assumed acceptable (the issue says development-only); if the owner
   wants focused mode on preview deploys, that's a follow-up decision
   (e.g. env-var gate instead of `NODE_ENV`).

### Risks

- **SVG inspection depth.** Full SVG parsing without new dependencies means
  targeted checks (root attrs, forbidden substrings/elements) rather than a
  complete parser; "hidden or off-canvas elements where practical" will be
  best-effort, as the issue allows. Adding a small XML parser dependency is a
  fallback if regex-level checks prove too brittle — decide during Phase 1a.
- **Studio scope creep.** The zone editor is the largest single work item.
  Mitigation: the issue explicitly blesses snippet-copy export and manual
  scenario docs for v1; dynamic scripted scenarios stay out of scope.
- **`.DS_Store` and ready-screen-only assets in `ui/`** will trip naive
  source-parity warnings; the validator needs an ignore list (`.DS_Store`,
  and a documented allowance for ready-screen art like `redcar.svg` /
  `blue-sedan.svg` that legitimately map to differently-named runtime files).
- **Spawner override touchpoint.** The focused-mode hook touches
  `spawner.ts`/`gameLoop.ts` hot paths; all new parameters must default to
  `undefined` with behavior byte-identical when absent, covered by tests.

### Unclear requirements (answerable during implementation, defaults chosen)

- Exact command/param names — defaults proposed above
  (`near-miss:vehicle:register`, `?nearMissDebug=1&nearMissVehicle=`); the
  issue explicitly leaves these open.
- "Spawning only, **or overwhelmingly**, the selected vehicle" — plan chooses
  *only*, which is simpler and strictly satisfies the criterion.
- Whether the studio lives at a dedicated route vs. inside the game page —
  plan chooses a dedicated dev route to keep `NearMissGame.tsx` lean; focused
  mode (params on the normal game page) covers in-gameplay inspection.

### Proposed follow-up issues (out of scope here, per non-goals)

1. Typed vehicle ids / removing the silent default-sedan fallback globally.
2. Normalized (size-relative) near-miss growth to fix canvas-size variance.
3. Decoupling `uniformVisualScale` from collision geometry.
4. Preserving spawn-time size variance across resize.
5. Branch-protection enforcement of the new CI workflow (owner settings task).
6. "Apply geometry directly to source config from the studio" (a dev-server
   write endpoint) — issue lists it as an alternative; snippet export ships
   first.
7. Deciding whether `public/games/near-miss/vehicles/traffic-sedan.svg`
   (unregistered compatibility copy) should be registered or deleted once the
   validator starts warning about it.

---

## 10. PR strategy

**Multiple PRs — four, mapping to the phase slices:**

1. **PR 1 — Validator + tooling bootstrap + CI + sprite diagnostics** (Phases
   1a + 1b). Pure additive tooling; easiest review; unblocks everything.
2. **PR 2 — Focused vehicle development mode** (Phase 1c). Small, contained
   engine touchpoints; reviewable for "no behavior change without params."
3. **PR 3 — Registration command** (Phase 2). Depends on PR 1's validator and
   shared formatter.
4. **PR 4 — Geometry authoring studio + final documentation overhaul**
   (Phase 3). The largest UI PR; benefits from everything before it.

Rationale: each PR is independently verifiable, keeps the risky
registry-codegen and the large studio UI out of the foundation review, and
matches the issue's note that multi-PR delivery is acceptable with all phases
remaining attached to issue #30.

---

## 11. Acceptance-criteria checklist → phases

| Acceptance criterion (issue #30) | Phase / PR |
| --- | --- |
| **Registration** | |
| One documented registration command | 2 / PR 3 |
| Command creates/scaffolds the runtime SVG | 2 / PR 3 |
| Command adds a formatted registry entry | 2 / PR 3 |
| `spriteAspectRatio` derived automatically | 2 / PR 3 |
| New traffic vehicles default to `spawnWeight: 0` | 2 / PR 3 |
| Duplicate IDs rejected | 2 / PR 3 (also validated in 1a) |
| Duplicate sprite paths rejected | 2 / PR 3 (also validated in 1a) |
| No overwrite without explicit authorization | 2 / PR 3 |
| Prints modified files + remaining manual steps | 2 / PR 3 |
| Dry-run supported | 2 / PR 3 |
| **Validation** | |
| Missing public SVGs fail validation | 1a / PR 1 |
| Aspect-ratio mismatches fail validation | 1a / PR 1 |
| Invalid SVG dimensions fail validation | 1a / PR 1 |
| Invalid vehicle classes fail validation | 1a / PR 1 |
| Malformed collision zones fail validation | 1a / PR 1 |
| Unsupported SVG dependencies fail validation | 1a / PR 1 |
| Unregistered runtime assets produce warnings | 1a / PR 1 |
| Registry and asset validation run in CI | 1a / PR 1 (enforcement = owner follow-up) |
| **Focused testing** | |
| Vehicle selectable without editing spawn weights | 1c / PR 2 |
| Debug enabled without editing `engine/tuning.ts` | 1c / PR 2 |
| Invalid IDs produce a visible development error | 1c / PR 2 |
| Normal gameplay unchanged without debug controls | 1c / PR 2 (tested) |
| **Geometry authoring** | |
| Collision geometry editable visually | 3 / PR 4 |
| Multiple overlapping rectangles supported | 3 / PR 4 |
| Add / move / resize / duplicate / rename / delete | 3 / PR 4 |
| Normalized values shown and editable | 3 / PR 4 |
| Four geometry concepts clearly distinguished | 3 / PR 4 (colors match runtime overlay) |
| Collision zones not equated with SVG/art bounds | 3 / PR 4 (no auto-fit; drafts labeled) |
| Mirrors/protrusions can remain outside crash geometry | 3 / PR 4 (+ preserved engine behavior, all phases) |
| Near-miss previewed as independent expansions | 3 / PR 4 (uses real `getVehicleNearMissPolygons`) |
| Near-miss growth editable | 3 / PR 4 |
| Narrow / typical / wide canvas review | 3 / PR 4 (viewport presets) |
| Geometry exportable in registry format | 3 / PR 4 (shared formatter from PR 3) |
| **Gameplay review** | |
| Substantial body contact crashes | verified in 1c focused play + 3 sandbox (engine unchanged) |
| Mirror-only contact doesn't crash | 3 sandbox preset + manual play (1c) |
| Minor light/bumper-corner taps don't crash | 3 sandbox preset + manual play (1c) |
| Near-miss overlap never crashes | engine invariant (unchanged); sandbox demonstrates |
| Collision precedence over near-miss scoring | engine invariant (unchanged); sandbox demonstrates |
| Straight/diagonal/front/rear/side/corner scenarios | 3 sandbox presets + documented manual list |
| Packet spacing and following tested | manual via 1c focused mode (documented step) |
| **Diagnostics & documentation** | |
| Failed sprite loads report id + path in dev | 1b / PR 1 |
| Pipeline report documents new workflow | docs in each PR; final overhaul in PR 4 |
| Public README agrees with runtime behavior | docs in each PR |
| Automated vs. manual steps clearly separated | docs, PR 4 finalizes |
| Automated tests with representative SVG fixtures | 1a bootstraps; every PR adds its own tests |
| Existing vehicles behave exactly as before | all PRs: no config/tuning/asset changes; overrides default off |
