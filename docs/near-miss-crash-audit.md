# Near Miss — Crash Aftermath Mechanics Audit

---

## 1. Current Crash System Summary

**Lifecycle:**

| Phase | Trigger | What happens |
|---|---|---|
| `"running"` → `"crashing"` | SAT polygon overlap detected in `update()` | `startCrash()` called once; input cleared; `CrashState` built |
| `"crashing"` | Each frame via `updateCrashing()` | Road speed decays (exponential), crash offsets/yaw integrate, non-hit traffic moves, feedbacks age |
| `"crashing"` → `"gameOver"` | `crash.age >= crash.duration` | `finishRunAfterCrash()` sets status, emits snapshot |

**What is frozen at impact:**
- Player input (steer/throttle/brake zeroed and input ignored until restart)
- Traffic following/spawning (traffic moves but doesn't follow player speed)
- Scoring

**What continues during crash:**
- Road stripe motion (speed-decaying)
- Player and hit car offset/yaw integration (the aftermath motion)
- Non-hit traffic Y positions (they keep moving at their relative screen speed)
- Feedback text aging

---

## 2. Main Weaknesses

**1. No vehicle class in crash response at all.**
`startCrash()` completely ignores `hitCar.vehicleConfigId`. A 0.9-lane box truck and a 0.46-lane sedan produce identical crash impulses. The `vehicleClass` field exists on every config but is never used in crash physics.

**2. Impact classification is a single binary threshold.**
`rearEndFactor = normal.y > 0.35 ? 1.2 : 0.85`. A 34° glancing rear-corner hit and a 90° dead-on rear-end both get `1.2`. A true sideswipe gets `0.85`. The 1.2/0.85 difference is small and only affects traffic Y velocity — nothing else reacts to impact type.

**3. Normal is center-to-center, not edge-based.**
The crash normal `normalizeVector(playerCenter.x - trafficCenter.x, playerCenter.y - trafficCenter.y)` ignores which polygon zones actually overlapped. Zone IDs ("front-taper", "rear-bumper", "cargo-box") from the SAT detection could cheaply classify the impact but are not used.

**4. Spin direction is arbitrary for near-axial collisions.**
`sideSign = normal.x >= 0 ? 1 : -1`. On a near-dead-on rear-end, `normal.x` could be ±0.02 from pixel-level positioning, flipping spin direction for nearly identical situations. The result feels random rather than readable.

**5. `speedRatio` floor of 0.35 compresses the low-vs-high speed range.**
Even at minimal game speed, crash impulses are 35% of max. Low-speed collisions should feel lighter. The floor removes differentiation at the bottom of the speed range.

**6. Crash duration barely varies: 1.02 → 1.35 seconds (0.33s total range).**
At max speed you get 0.33 extra seconds of aftermath. A high-speed crash and a low-speed fender-bender feel almost the same length, which is a missed opportunity for the high-speed drama.

**7. Road speed hits its floor almost immediately.**
Exponential decay rate 1.65–3.8 causes road speed to reach its minimum within the first ~0.3–0.5 seconds of a 1.2–1.35 second crash. The player sees the road nearly stopped for most of the aftermath. There is no "carrying momentum" feeling even at high speed.

**8. Relative speed is not stored in `CrashState`.**
`relativeYSpeed` is passed into `startCrash()` and used inline for traffic Y velocity, but not stored. The crash state can't reference the closure speed after the fact.

**9. Traffic Y velocity uses screen-shaped relative speed.**
`relativeYSpeed` comes from `getTrafficScreenYSpeed()` which is already capped at ~`trafficMaxApproachScreenSpeedMph` (70mph equivalent). At very high speeds, the traffic car's Y impulse is artificially capped regardless of true closure rate.

**10. Damping is identical for player and traffic, regardless of mass.**
`crashLinearDamping: 2.7` and `crashAngularDamping: 2.25` apply equally to the player sports coupe and a box truck. A heavier vehicle should damp more slowly (slide farther) while still spinning less.

---

## 3. What Data Is Missing at Impact

The current `CrashState` is missing these fields that would unlock meaningful variety:

| Missing field | Where it exists now | Why it matters |
|---|---|---|
| `relativeSpeedAtImpact` | Passed to `startCrash` but not stored | Drive impulse + duration more directly |
| `trafficWorldSpeedAtImpact` | Available as `hitCar.currentWorldSpeed` but not stored | Distinguish stopped car vs near-speed car |
| `hitVehicleClass` | Available as `hitCar.vehicleConfigId` | Unlock class-based crash profiles |
| `hitVehicleMass` | Not in vehicleConfig | Scale player bounce impulse |
| `playerYawAtImpact` | `state.player.visualYaw` at the moment | Affect post-impact spin bias |
| `impactZoneIds` | Available from SAT result (not currently returned) | Proper impact classification |
| `playerSpeedAtImpact` | Captured as `roadSpeedAtImpact`, same thing | Rename for clarity |

---

## 4. Recommended Crash Mechanics Model

### Impact classification (replace binary rearEndFactor)

Derive a continuous `impactAngle` from the normal instead of a binary threshold. The crash type drives separate scale factors for player bounce, traffic bounce, and spin.

```
impactAngle = atan2(|normalX|, normalY)   // 0° = pure rear-end, 90° = pure sideswipe
rearFactor   = cos(impactAngle)^0.6       // 1.0 at rear-end, 0 at pure sideswipe
sideFactor   = sin(impactAngle)^0.7       // 0 at rear-end, 1.0 at pure sideswipe
```

This gives a gradual spectrum: rear-end pushes both cars forward; sideswipe pushes both laterally; 45° corner hits split the response.

### Spin direction robustness

When `|normal.x| < 0.15` (near-axial impact), fall back to `Math.sign(player.lateralVelocity)` with a small baseline random for spin direction. This removes the pixel-level flip behavior and makes spin readable — a car moving right spins right when rear-ended.

### Relative speed as the primary impulse driver

Replace `speedRatio = clamp(state.speed / TUNING.maxSpeed, 0.35, 1)` with `relativeSpeedRatio = clamp(relativeSpeedAtImpact / TUNING.crashMaxRelativeSpeed, 0.15, 1)`.

This means a player hitting a fast-moving traffic car that's almost at the same speed gets a lighter hit than hitting a stopped car at the same player speed. Much more intuitive.

### Vehicle mass modifiers

Multiply player impulse by `hitVehicle.crashMass` and divide traffic spin velocity by `hitVehicle.crashSpinResistance`. See Section 5 for values.

### Road slowdown — two-phase model

Replace the single-rate exponential with two phases:
- **Phase 1** (first ~0.25s): fast decay to ~60% of impact speed — carries initial momentum feeling
- **Phase 2** (remainder): slow exponential coast to the minimum floor

This gives a brief "road keeps flying" beat before the dramatic slow-down, especially noticeable at high speed.

### Crash duration — wider range

Extend to `0.85 → 2.0` seconds scaled by `relativeSpeedRatio`. A 20mph rear-end ends quickly; a 90mph head-on has a full 2-second aftermath.

---

## 5. Vehicle Class Recommendations

Add these fields to `NearMissVehicleConfig`:

```ts
crashMass: number;            // Scales player impulse received. 1.0 = sedan baseline
crashSpinResistance: number;  // Divides traffic angular velocity. 1.0 = sedan baseline
crashSlideResistance: number; // Multiplies traffic linear damping. 1.0 = sedan baseline
```

| Vehicle | crashMass | crashSpinResistance | crashSlideResistance | Notes |
|---|---|---|---|---|
| `player-sports-coupe` | 0.7 | — | — | Lightweight, spins easily |
| `traffic-sedan-blue` | 1.0 | 1.0 | 1.0 | Baseline |
| `traffic-sedan-gold` | 1.0 | 1.0 | 1.0 | Same as blue sedan |
| `traffic-box-truck` | 1.9 | 3.2 | 1.6 | Barely spins, huge player impulse, slides farther |

- **Player `crashMass`** — used to calculate how hard the player is bounced: heavier traffic = more bounce.
- **Traffic `crashSpinResistance`** — scales down the traffic angular velocity assignment.
- **Traffic `crashSlideResistance`** — increases that car's linear damping coefficient so it decelerates faster (heavy thing slides less).

No new vehicle SVG assets are needed. Pure data additions.

---

## 6. Tuning Constants to Add / Change

### Add to `NEAR_MISS_TUNING`

```ts
// Crash impulse scaling
crashMaxRelativeSpeed: 420,            // internal speed units at which relativeSpeedRatio = 1
crashSpeedRatioFloor: 0.18,            // was 0.35 — lower floor restores low-speed lightness

// Impact classification
crashRearFactor: 1.0,                  // rear-end Y impulse multiplier (baseline)
crashSideFactor: 1.3,                  // sideswipe X impulse multiplier
crashSpinAxisThreshold: 0.15,          // |normalX| below which spin direction falls back to lateralVelocity

// Road slowdown (two-phase)
crashRoadPhase1Duration: 0.22,         // seconds of fast deceleration
crashRoadPhase1TargetRatio: 0.62,      // speed ratio to reach by end of phase 1
crashRoadPhase2SlowdownRate: 0.9,      // exponential rate for phase 2 coast

// Duration range (widen)
crashDurationLowSpeed: 0.88,           // was 1.02
crashDurationHighSpeed: 2.0,           // was 1.35
```

### Change in `NEAR_MISS_TUNING`

```ts
// crashLinearDamping: 2.7     keep — but apply per vehicle via slideResistance multiplier
// crashAngularDamping: 2.25   keep — but apply per vehicle via spinResistance divisor
crashRoadSlowdownRateLowSpeed: 2.8,    // was 3.8 — soften once two-phase is in
// crashRoadSlowdownRateHighSpeed: 1.65  keep, phase 2 uses this
crashMinRoadSpeedRatioHighSpeed: 0.28, // was 0.34 — let it decay a bit lower
```

---

## 7. Implementation Plan

### Pass 1 — Impact classification and relative-speed scaling
**Risk: low. Nothing touches normal driving physics.**

1. Add `relativeSpeedAtImpact: number` and `hitVehicleClass: NearMissVehicleClass` to `CrashState`.
2. Replace `speedRatio = clamp(state.speed / TUNING.maxSpeed, 0.35, 1)` with `relativeSpeedRatio = clamp(relativeSpeedAtImpact / crashMaxRelativeSpeed, 0.18, 1)`.
3. Replace binary `rearEndFactor` with continuous `impactAngle`-based rear/side factors on player and traffic impulses separately.
4. Fix spin direction: when `|normal.x| < crashSpinAxisThreshold`, use `Math.sign(player.lateralVelocity) || randomSign()`.
5. Widen `crashDuration` range to `0.88 → 2.0`.
6. Expose `hitVehicleClass` in the debug label.

### Pass 2 — Vehicle class crash profiles
**Risk: low. Additive change to vehicleConfig, no restructuring.**

1. Add `crashMass`, `crashSpinResistance`, `crashSlideResistance` to `NearMissVehicleConfig` type and all four vehicle entries.
2. In `startCrash`, load `getVehicleConfig(hitCar.vehicleConfigId)` and read its crash profile.
3. Scale player X/Y impulse by `hitVehicle.crashMass`.
4. Divide traffic `angularVelocityDeg` by `hitVehicle.crashSpinResistance`.
5. In `updateCrashMotion`, pass separate damping per vehicle: `trafficLinearDamping * vehicle.crashSlideResistance`.

### Pass 3 — Road slowdown curve refinement
**Risk: low. Isolated to `updateCrashing`.**

1. Add `crashRoadPhase` tracking (computed from `crash.age` vs `crashRoadPhase1Duration`).
2. Replace single-rate exponential with two-phase: fast drop to 62% in first 0.22s, then slow coast.
3. Rebalance `crashMinRoadSpeedRatio` for high speed (lower floor = more dramatic eventual stop).
4. Tune via `crashDuration` to ensure phase 2 has enough time to feel like momentum.

### Pass 4 — Visual polish (future, out of scope for this audit)
Sparks, smoke, screen shake, audio.

---

## 8. Risks / Things to Avoid

**Do not change these:**
- `getTrafficScreenYSpeed()` — screen-space shaping for normal driving is separate from crash physics
- `updatePlayerHandling()` — normal driving feel must be unchanged
- Traffic spawner, lane following, scoring, leaderboard
- SAT polygon detection in `vehicleGeometry.ts` — it is correct; only extend what you read from it

**Watch out for:**

- **Crash duration > 2.0s will frustrate players.** The aftermath is satisfying at 1.8–2.0s but anything longer delays the restart loop too much. Keep `crashDurationHighSpeed` at or below 2.0.

- **Don't zero out the speedRatio floor entirely.** A truly zero-impulse crash (player standing still, slow tap) would look broken — no motion at all. Keep a floor of 0.15–0.18.

- **Don't make box truck spin direction inconsistent with player direction.** The `sideSign`-based approach is correct — extend it to be vehicle-mass-weighted, not replaced.

- **Road speed minimum ratio should never reach 0.** An instantly-frozen road reads as a hard freeze/bug, not a crash.

- **Avoid using SAT zone overlap IDs as authoritative geometry** for multi-zone vehicles like the box truck (3 zones). Use them as a hint for impact classification only, not for precise contact points.

- **Don't apply `crashMass` symmetrically.** The player config's `crashMass` should only affect how hard the player gets pushed, not how the traffic responds, to avoid feedback loops that make the crash feel unpredictable.
