# Near Miss Vehicle Sprites

This folder contains the browser-loadable copies of curated Near Miss vehicle
SVGs. The art source-of-truth is `src/games/near-miss/ui`; public files should
only be copied or cleaned from those curated UI assets.

For the complete SVG-to-canvas pipeline, registry behavior, sizing formulas,
collision coordinate system, debug-overlay guide, and end-to-end addition
checklist, see
`src/games/near-miss/VEHICLE_SPRITE_PIPELINE.md`.

Do not commit generated placeholder vehicles here.

## Asset Rules

- Use real curated SVG art only.
- Keep backgrounds transparent.
- Vehicles must face upward.
- Do not include checkerboard backgrounds, watermarks, hidden rectangles,
  oversized off-canvas paths, or export artifacts.
- Do not use external image references inside SVGs.
- Preserve each vehicle silhouette; do not stretch a truck into sedan
  proportions.

## SVG Format Spec

Use this format for every browser-loadable vehicle SVG in this folder. The
example below is the current sedan/sports-car baseline. Other vehicle families
may use a different root ratio when the artwork needs it.

The curated source SVGs in `src/games/near-miss/ui` may stay in their original
export format, but public runtime copies should be normalized.

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="128" height="192" viewBox="0 0 128 192" role="img" aria-labelledby="title desc">
  <title id="title">Near Miss traffic sedan blue</title>
  <desc id="desc">Top-down blue traffic sedan sprite, with transparent background.</desc>
  <g transform="translate(64 96) scale(SCALE) translate(-SOURCE_CENTER_X -SOURCE_CENTER_Y)">
    <!-- vehicle artwork only -->
  </g>
</svg>
```

- Root element:
  - Must use explicit numeric `width`, `height`, and matching
    `viewBox="0 0 WIDTH HEIGHT"` values.
  - `128x192` is the current baseline for sedans and sports cars, not a
    universal requirement.
  - Use a different ratio when the visible vehicle shape genuinely needs it,
    such as a longer truck or a wider boxy vehicle.
  - Must not use `preserveAspectRatio="none"` because runtime drawing already
    preserves aspect ratio.
  - Should include `role="img"`, `aria-labelledby="title desc"`, one `<title>`,
    and one `<desc>`.
- Coordinate system:
  - The normalized public sprite should use a transparent viewport that matches
    the intended rendered ratio.
  - The vehicle nose points toward the top of the viewport.
  - Center the vehicle on `(WIDTH / 2, HEIGHT / 2)`.
  - Keep transparent padding in the viewport; the vehicle should not touch the
    canvas edges unless that is intentional and verified in game.
- Artwork:
  - Use inline vector geometry only, usually `<path>` elements inside one
    wrapper `<g>`.
  - Remove `transform="translate(0,0)"` noise from paths when copying from
    exports.
  - Remove background/export geometry, including checkerboards, full-canvas
    rectangles, watermarks, masks, and hidden/off-canvas art.
  - Do not include `<image>`, external URLs, scripts, stylesheets, filters, or
    fonts.
  - Prefer explicit `fill="rgb(...)"` colors on geometry. Avoid CSS classes
    that make later cleanup harder.
- Source scaling:
  - For curated `2048x2048` exports such as `redcar.svg`, wrap the copied paths
    in one centered transform rather than rewriting every path coordinate.
  - The current red sports car public copy uses:

    ```svg
    <g transform="translate(64 96) scale(0.112019) translate(-1029.947 -1025.064)">
    ```

  - A rotation is acceptable only to correct source orientation, as with the
    truck public copy. Prefer fixing orientation once in the wrapper transform.
- File naming:
  - Use lowercase kebab-case names.
  - Prefix traffic vehicles with `traffic-`.
  - Use descriptive class/color names, for example
    `traffic-sedan-blue.svg`, `boxtruck.svg`, or
    `player-sports-car.svg`.

## Runtime Config Spec

Every public sprite needs a matching entry in
`src/games/near-miss/engine/vehicleConfig.ts`.

- `spritePath`: `/games/near-miss/vehicles/<file>.svg`.
- `spriteAspectRatio`: must equal the public SVG root ratio, `width / height`.
  Use `128 / 192` only for assets that actually use a `128x192` root.
- `vehicleClass`: one of `sports-coupe`, `sedan`, or `van-truck`.
- `uniformVisualScale`: multiplier for perceived bulk. It changes the rendered
  bounds, and those same bounds currently drive collision and near-miss
  polygons, so it is not gameplay-neutral.
- `occupancyWidthLanes` and `occupancyLengthScale`: gameplay body size, not
  raw SVG size.
- `collisionZones`: local zones in normalized sprite coordinates. `x` and `y`
  use `-0.5` to `0.5` across the rendered SVG; `width` and `height` are
  fractions of the rendered SVG size.
- `nearMissGrowX` and `nearMissGrowY`: pixel padding used to expand local
  collision zones into near-miss zones before transform.
- `spawnWeight`: use `0` until the vehicle has been checked in game, then tune
  relative to existing traffic weights.

Use current baseline values unless a class genuinely needs different gameplay
size:

| Vehicle type | `uniformVisualScale` | `occupancyWidthLanes` | `occupancyLengthScale` | `nearMissGrowX` | `nearMissGrowY` |
| --- | ---: | ---: | ---: | ---: | ---: |
| Player sports coupe | `1` | `0.48` | `1` | `18` | `11` |
| Traffic sedan | `0.9` | `0.46` | `1` | `13` | `11` |
| Traffic van/truck | `1.22` | `0.9` | `1.28` | `16` | `13` |

## Quick Checklist

1. Add the untouched source SVG to `src/games/near-miss/ui`.
2. Create the normalized public copy in this folder using explicit dimensions
   and a matching `spriteAspectRatio`.
3. Confirm the vehicle is centered, upright, transparent, and has no background
   geometry.
4. Add the config entry with `spawnWeight: 0`.
5. Run the game with debug overlays and verify purple sprite bounds, red
   transformed collision zones, and yellow transformed near-miss zones align
   with the visible vehicle.
6. Tune config values only after the sprite looks correct.

## Rendering

Near Miss renders vehicles through browser `Image` objects in
`src/games/near-miss/render/canvasRenderer.ts`.

- Runtime vehicle metadata lives in
  `src/games/near-miss/engine/vehicleConfig.ts`.
- `spritePath` points to one of the public SVG files in this folder.
- The renderer draws SVG images centered on the gameplay body.
- Aspect ratio is preserved. The renderer chooses one uniform scale that fits
  the SVG inside the configured render bounds.
- `uniformVisualScale` is the per-vehicle visual-size multiplier. Because
  collision and near-miss polygons are transformed through the rendered sprite
  bounds, changing it currently changes those polygons too.
- Normal gameplay should not use procedurally drawn canvas cars as fallback art.

## Current Curated Assets

- `player-sports-car.svg`
  - Public copy of `src/games/near-miss/ui/redcar.svg`.
  - Player sports coupe.

- `traffic-sedan-blue.svg`
  - Public copy of `src/games/near-miss/ui/blue-sedan.svg`.
  - Blue traffic sedan.

- `traffic-sedan-gold.svg`
  - Public copy of `src/games/near-miss/ui/gold-sedan.svg`.
  - Gold traffic sedan.

- `traffic-sedan.svg`
  - Compatibility copy of the curated gold sedan.
  - Keep only while older references still expect this stable path.

- `boxtruck.svg`
  - Cleaned public copy derived from `src/games/near-miss/ui/boxtruck.svg`.
  - Box truck traffic vehicle.

## Adding A Vehicle

Follow the quick checklist above. Do not add SUV, police, or other future
classes unless a curated real SVG exists for that class.
