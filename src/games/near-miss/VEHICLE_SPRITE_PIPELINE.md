# Near Miss vehicle sprite pipeline

This document records how vehicle SVGs become playable Near Miss vehicles, how
they are registered, and how their render, collision, near-miss, and spawning
geometry are connected.

## Short version

A traffic vehicle needs two assets/records:

1. A curated source SVG in `src/games/near-miss/ui/`.
2. A normalized, browser-loadable SVG in
   `public/games/near-miss/vehicles/`, plus a registry entry in
   `engine/vehicleConfig.ts`.

The public SVG is what the canvas game actually loads. Adding an SVG to either
folder alone does not register it.

Use `spawnWeight: 0` while fitting the sprite and collision zones. Turn on
`NEAR_MISS_TUNING.debug` in `engine/tuning.ts` to inspect the gameplay body,
rendered SVG bounds, collision zones, and near-miss zones before making the
vehicle spawn normally.

## End-to-end data flow

```text
curated source SVG
src/games/near-miss/ui/<vehicle>.svg
        |
        | clean, center, orient, and normalize
        v
runtime SVG
public/games/near-miss/vehicles/<vehicle>.svg
        |
        | spritePath
        v
NEAR_MISS_VEHICLE_CONFIGS
engine/vehicleConfig.ts
        |
        +--> canvasRenderer.ts preloads one browser Image per config id
        |
        +--> spawner.ts chooses configs by spawnWeight and stores
        |    vehicleConfigId on each TrafficCar
        |
        +--> tuning.ts derives gameplay body and rendered sprite bounds
        |
        +--> vehicleGeometry.ts transforms local collision zones into
             world-space rotated polygons used by gameLoop.ts
```

There is no build-time sprite sheet, rasterization, or SVG-to-code conversion.
The browser requests the public SVG and decodes it into an `HTMLImageElement`;
the canvas renderer then calls `drawImage`.

## The two SVG locations are not interchangeable

### `src/games/near-miss/ui/`

This is the curated art source location. Files here may retain their original
export coordinate system. For example, several current files are `2048x2048`
exports.

The imports of `blue-sedan.svg` and `redcar.svg` in `NearMissGame.tsx` are used
only by the ready-screen illustration. They do not supply gameplay sprites.
Consequently, adding a new source SVG here has no effect on traffic.

### `public/games/near-miss/vehicles/`

These are the runtime canvas assets. A configured path such as
`/games/near-miss/vehicles/traffic-sedan-blue.svg` maps directly to a file in
this directory.

The public copy should:

- have a transparent background;
- face upward, with the vehicle centered in the viewport;
- use explicit numeric `width`, `height`, and a matching
  `viewBox="0 0 WIDTH HEIGHT"`;
- preserve the real vehicle proportions and contain intentional transparent
  padding;
- use inline vector geometry, with no scripts, external images, external fonts,
  checkerboards, masks used as export debris, or hidden/off-canvas artwork;
- avoid `preserveAspectRatio="none"` because the game already fits the image
  without distorting its aspect ratio.

The current `128x192` sedan size is a convention, not a requirement. The truck
uses `128x224`. The registry's `spriteAspectRatio` must equal the public root
`width / height`, whatever dimensions are selected.

Large source coordinates do not need to be rewritten path by path. They can be
placed in a normalized viewport with one wrapper transform:

```svg
<svg xmlns="http://www.w3.org/2000/svg"
     width="128" height="192" viewBox="0 0 128 192"
     role="img" aria-labelledby="title desc">
  <title id="title">Near Miss traffic vehicle</title>
  <desc id="desc">Top-down traffic vehicle on a transparent background.</desc>
  <g transform="translate(64 96) scale(SCALE) translate(-SOURCE_CENTER_X -SOURCE_CENTER_Y)">
    <!-- cleaned source paths -->
  </g>
</svg>
```

Use the wrapper to correct source orientation as well. Do not rely on runtime
yaw to repair a wrongly oriented traffic asset: normal traffic is rendered with
zero yaw.

## Registry: the actual registration point

`engine/vehicleConfig.ts` exports `NEAR_MISS_VEHICLE_CONFIGS`, the single
runtime registry. A new traffic entry has this shape:

```ts
{
  id: "traffic-example",
  label: "Example",
  vehicleClass: "sedan",
  spritePath: "/games/near-miss/vehicles/traffic-example.svg",
  spriteAspectRatio: 128 / 192,
  uniformVisualScale: 0.9,
  occupancyWidthLanes: 0.46,
  occupancyLengthScale: 1,
  nearMissGrowX: 13,
  nearMissGrowY: 11,
  collisionZones: [
    { id: "center-body", x: 0, y: 0.04, width: 0.56, height: 0.54 },
    { id: "front", x: 0, y: -0.3, width: 0.44, height: 0.25 },
    { id: "rear", x: 0, y: 0.32, width: 0.48, height: 0.23 }
  ],
  spawnWeight: 0
}
```

Field behavior:

| Field | Runtime effect |
| --- | --- |
| `id` | Stable key used in the image cache and stored as `TrafficCar.vehicleConfigId`. It must be unique. |
| `label` | Human-readable debug-overlay text. |
| `vehicleClass` | Currently `"sports-coupe"`, `"sedan"`, or `"van-truck"`. It also selects the traffic shadow color. A genuinely new class requires extending the TypeScript union and checking every class comparison. |
| `spritePath` | Root-relative URL of the public SVG. |
| `spriteAspectRatio` | `SVG width / SVG height`; used to calculate rendered bounds. |
| `uniformVisualScale` | Multiplies both available render width and height. Despite its name, it currently also changes collision and near-miss polygons because those polygons use the resulting rendered bounds. |
| `occupancyWidthLanes` | Base traffic body width as a fraction of current lane width. |
| `occupancyLengthScale` | Base traffic body height relative to player body height. |
| `nearMissGrowX/Y` | Pixel expansion added to each side of every collision-zone rectangle before rotation. These values are not normalized and therefore do not scale proportionally with viewport or vehicle size. |
| `collisionZones` | One or more normalized local rectangles fitted to the visible silhouette. |
| `spawnWeight` | Relative weighted frequency. `0` registers and preloads the vehicle but excludes it from traffic selection. |

`getSpawnableTrafficVehicleConfigs()` admits non-player entries whose
`spawnWeight` is greater than zero. Selection is a weighted random roll. With
the current weights of blue sedan `50`, gold sedan `50`, and truck `12`, their
per-selection probabilities are approximately 44.6%, 44.6%, and 10.7%.

`getVehicleConfig()` silently falls back to `DEFAULT_TRAFFIC_VEHICLE_ID` for an
unknown id. This keeps the game rendering, but it can hide a typo by displaying
and colliding as the default blue sedan. Check ids carefully when testing.

The player is a special registry entry selected by `PLAYER_VEHICLE_ID`; it has
`spawnWeight: 0`. `getPlayerVehicleTransform()` adds 180 degrees to the player's
visual yaw to match the current player asset orientation. Traffic receives no
such automatic rotation.

## Sizing: body bounds versus rendered bounds

Near Miss maintains two related rectangles.

### Gameplay/occupancy body

The player body begins with:

```text
width  = min(62px, sizing lane width * carWidthRatio)
height = width * carHeightRatio
```

Traffic body size is:

```text
width  = lane width * occupancyWidthLanes * random width variance
height = player body height * occupancyLengthScale * random height variance
```

The random spawn variance is currently:

- width: `0.90` through `1.02`;
- height: `0.94` through `1.06`.

This body is used for lane placement, traffic following, spawn spacing, passing
checks, and several packet calculations. It is shown in cyan by the debug
overlay. It is not itself the crash hitbox.

When the canvas is resized, existing traffic bodies are recomputed without
their original random variance. This is current behavior and can make an
existing car's size change slightly after a resize.

### Rendered SVG bounds

`getRenderedSpriteBounds()` starts with the body and computes:

```text
maxWidth       = body.width  * globalSpriteScaleX * uniformVisualScale
maxHeight      = body.height * globalSpriteScaleY * uniformVisualScale
widthFromHeight = maxHeight * spriteAspectRatio
renderWidth     = min(maxWidth, widthFromHeight)
renderHeight    = renderWidth / spriteAspectRatio
```

The result is centered on the occupancy body. Current global scale values are:

| Vehicle | X scale | Y scale |
| --- | ---: | ---: |
| Player | `2.08` | `1.2` |
| Traffic | `2.28` | `1.42` |

The renderer draws the entire SVG viewport into this rectangle. Transparent
padding in the SVG therefore affects where the visible silhouette sits relative
to collision zones. The purple debug rectangle is the rendered SVG viewport,
not the tight visible-art boundary.

Because collision zones are fractions of these rendered bounds, changing any
of the following changes collision geometry:

- `spriteAspectRatio`;
- `uniformVisualScale`;
- `occupancyWidthLanes`;
- `occupancyLengthScale`;
- the global player/traffic sprite scales;
- the random width and height variance applied at spawn.

## Collision-zone coordinate system

Each `collisionZones` entry is an axis-aligned rectangle in local rendered-SVG
space before yaw is applied:

```text
sprite top-left = (-0.5, -0.5)
sprite center   = ( 0.0,  0.0)
sprite bottom-right = (0.5, 0.5)

x < 0: left                 x > 0: right
y < 0: toward SVG top/nose  y > 0: toward SVG bottom/rear
```

`x` and `y` locate the zone center as fractions of rendered width and height.
`width` and `height` are also fractions of rendered width and height. For
example:

```ts
{ x: 0, y: -0.3, width: 0.44, height: 0.25 }
```

is a centered, narrower front rectangle whose center is 30% of the render
height above the sprite center.

Use multiple rectangles to approximate a tapered silhouette. Sedan configs use
a center/cabin zone plus narrower front and rear zones; the truck uses separate
cargo box, cab, and rear-bumper zones. Zones may overlap. Collision is true
when any player zone overlaps any traffic zone.

At runtime every local rectangle is:

1. scaled by the rendered width and height;
2. optionally expanded by `nearMissGrowX/Y`;
3. rotated around the rendered sprite center using the same yaw as the image;
4. translated into world/canvas coordinates.

The result is an oriented quadrilateral. Polygon overlap uses a
separating-axis-theorem test in `vehicleGeometry.ts`.

Player steering yaw is included in player collision geometry. Normal traffic
has zero yaw, while crash-animation traffic uses the same crash yaw for both
art and debug geometry.

## Near-miss boundaries

Near-miss polygons are generated from the same collision rectangles, but each
rectangle's half-width grows by `nearMissGrowX` pixels and its half-height grows
by `nearMissGrowY` pixels before rotation.

This means the configured values expand every zone independently. A three-zone
vehicle gets three expanded, potentially overlapping shells; it does not get
one single outline around the union of the vehicle.

A near miss requires:

- no collision-zone overlap;
- at least one expanded player/traffic zone overlap;
- sufficient relative vertical speed (`minNearMissRelativeSpeed`);
- the traffic car to have passed the player's pass threshold;
- the car not to have already awarded/accounted for a near miss.

The near-miss zones never cause a crash.

## Rendering and asset failure behavior

At module initialization in the browser, `canvasRenderer.ts` loops over every
registry entry, creates an `Image`, assigns `image.src = spritePath`, and stores
it in a map keyed by config id.

During each frame:

- traffic resolves its `vehicleConfigId`;
- the body is converted to rendered bounds;
- canvas translation/rotation applies yaw;
- the decoded image is drawn into the rendered bounds.

If an image has not loaded or failed to decode, the renderer draws a small
crossed rectangle. There is no explicit `onload`, `onerror`, validation, retry,
or loading gate. A malformed path can therefore appear only as fallback art,
without a registry error.

All configured images, including entries with `spawnWeight: 0`, are preloaded.

## Recommended procedure for adding a traffic vehicle

1. Add the untouched curated asset to `src/games/near-miss/ui/`.
2. Inspect the source for its actual art bounds, center, and nose direction.
3. Create a cleaned public copy in
   `public/games/near-miss/vehicles/`. Normalize its viewport, center the
   silhouette, point the nose upward, remove export debris, and preserve
   intentional transparent padding.
4. Confirm the public SVG opens directly and that its root `width`, `height`,
   and `viewBox` agree.
5. Add a unique registry entry. Set `spriteAspectRatio` from the public root,
   choose the nearest existing class/body settings, copy only sensible starting
   zones, and keep `spawnWeight: 0`.
6. Temporarily make the vehicle selectable for focused testing. The current
   code has no vehicle-specific test selector, so the simplest local method is
   to give only the new traffic entry a positive weight. Do not commit unrelated
   temporary weight changes.
7. Set `NEAR_MISS_TUNING.debug: true`.
8. Fit in this order:
   1. public SVG viewport/centering/orientation;
   2. `spriteAspectRatio`;
   3. occupancy width and length;
   4. `uniformVisualScale`;
   5. collision rectangles;
   6. near-miss growth;
   7. final spawn weight.
9. Test at narrow and wide canvas sizes because lane-relative bodies resize,
   while `nearMissGrowX/Y` remain fixed pixels.
10. Test straight passes, corner/diagonal contacts while steering, front/rear
    contacts, side swipes, and crowded packet/following behavior.
11. Turn debug off, restore the intended weights, run the project checks, and
    confirm the public asset is included in the change.

## Reading the debug overlay

Enable it by changing `debug` in `engine/tuning.ts` to `true`; there is currently
no query-string or UI toggle.

| Color | Meaning |
| --- | --- |
| Cyan | Gameplay/occupancy body and lane centers |
| Purple | Rendered SVG viewport |
| Green | Player collision polygons |
| Red | Traffic collision polygons |
| Yellow | Expanded near-miss polygons |

A good fit has:

- the visible art centered inside the purple viewport;
- red/green zones inside the visible solid silhouette, with only intentional
  forgiveness around mirrors, tapered corners, and decorative protrusions;
- yellow zones forming a playable but not surprising buffer;
- occupancy bodies that keep lane placement, following gaps, and packet spacing
  believable for the class.

Do not compensate for an off-center or badly padded SVG by skewing collision
zone coordinates. Fix the public asset first so rendering and geometry share a
clean coordinate system.

## Current registry

| Id | Runtime SVG | Role/class | Spawn weight |
| --- | --- | --- | ---: |
| `player-sports-coupe` | `player-sports-car.svg` | player / sports coupe | `0` |
| `traffic-sedan-blue` | `traffic-sedan-blue.svg` | traffic / sedan; default fallback | `50` |
| `traffic-sedan-gold` | `traffic-sedan-gold.svg` | traffic / sedan | `50` |
| `traffic-box-truck` | `boxtruck.svg` | traffic / van-truck | `12` |

`public/games/near-miss/vehicles/traffic-sedan.svg` is documented as a
compatibility copy but has no current registry entry, so the game does not
preload or render it through the vehicle system.

## Important implementation caveats

- `uniformVisualScale` is not visual-only in the current implementation. The
  existing public vehicle README says otherwise in one place; the code in
  `tuning.ts` and `vehicleGeometry.ts` shows that scaled render bounds feed
  collision and near-miss transforms.
- `nearMissGrowX/Y` are fixed canvas pixels, while collision rectangles and
  vehicle bodies are proportional. Near-miss feel can therefore vary by canvas
  size.
- Unknown vehicle ids silently use the default sedan config, which can conceal
  registration mistakes.
- The source SVG folder and public SVG folder can drift because copying and
  cleanup are manual; there is no generator or parity check.
- Sprite paths and aspect ratios are not validated automatically.
- Registry ids are typed as general strings on traffic cars, so compile-time
  checking does not prevent an invalid runtime id.
- Resize recomputes existing traffic bodies without preserving their spawn-time
  random variance.
- Packet safety uses a global
  `trafficMaxOccupancyLengthScale` worst-case assumption. If a new class exceeds
  the current maximum `1.28`, update that tuning value and retest packet
  stacking/spawn gaps.

## Relevant source files

- `src/games/near-miss/engine/vehicleConfig.ts`: registry and per-vehicle data.
- `src/games/near-miss/engine/tuning.ts`: body and rendered-bound formulas,
  global scales, random variance, and debug flag.
- `src/games/near-miss/engine/vehicleGeometry.ts`: local-zone transforms,
  rotation, SAT collision, and expanded near-miss polygons.
- `src/games/near-miss/engine/spawner.ts`: weighted selection, body creation,
  packet placement, and `vehicleConfigId`.
- `src/games/near-miss/engine/gameLoop.ts`: collision checks, pass threshold,
  and near-miss award conditions.
- `src/games/near-miss/render/canvasRenderer.ts`: image preloading, canvas
  drawing, fallback art, and debug overlays.
- `src/games/near-miss/NearMissGame.tsx`: ready-screen-only imports from the
  curated source SVG folder.
- `public/games/near-miss/vehicles/README.md`: existing normalization rules and
  current asset provenance.
