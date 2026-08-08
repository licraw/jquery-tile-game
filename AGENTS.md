# SoftArcade Design-System Rules

These rules apply to design and UI implementation work in this repository. The baseline source of truth is the [current design audit](docs/design-system/current-design-audit.md) and the linked Figma file.

- Treat `CURRENT`, `NORMALIZED`, and `PROPOSED` as distinct provenance. Do not present a proposed value as existing product behavior.
- Reuse existing SoftArcade components and patterns before creating new ones. Check `src/components`, `src/games/shared`, and the game registry first.
- Prefer semantic design tokens over arbitrary color, spacing, radius, border, or elevation values. When the implementation lacks an appropriate token, flag the system gap instead of hiding a one-off.
- Keep Figma and code terminology aligned: Panel, Game Shell, Game Card, Header, Leaderboard, Score/Status, and their documented state names.
- Preserve keyboard focus, hover, pressed, disabled, loading, success, empty, and error behavior whenever changing interactive UI. Do not remove reduced-motion handling.
- Respect the documented spacing, radius, typography, and color roles. Historical CURRENT captures use `Arial, Helvetica, sans-serif`; the NORMALIZED design system and production source of truth use Figtree via `--font-family-sans`. Do not rewrite that provenance or introduce one-off font families.
- Use legitimate variants and component properties for recurring states; avoid combinatorial variants and speculative components.
- Keep game-specific mechanics and presentation local unless at least two implementations demonstrate a stable shared pattern.
- Record genuine inconsistencies and accessibility risks before normalizing them. A consistency cleanup is not automatically a design improvement.
- Do not redesign SoftArcade or introduce a new visual identity while performing baseline, audit, capture, or synchronization work.
