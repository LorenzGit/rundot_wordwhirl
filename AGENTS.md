# WORDWHIRL

Portrait swipe-word game for RUN.world. React 19 + strict TypeScript + Vite 6,
PixiJS 8 WebGPU-first with WebGL fallback, and RUN SDK 5.24.

- `DESIGN.md` is canonical for levels, economy, monetization, and presentation.
- Keep puzzle rules in `src/game/words/` renderer-free and deterministic.
- Do not add gameplay randomness. Level data defines the full puzzle state.
- Keep the crossword and compass inside the Pixi scene; DOM owns navigation,
  settings, shop, and accessibility actions.
- Preserve authoritative-only ads and purchases. Local previews never grant.
- Keep all artwork and audio project-authored; do not copy reference assets.
- Format every visible quantity through `formatNumber()`.
- Verify with `npm run check` and `npm run visual-qa`.
- After UI/art changes, apply the workspace UI/art QA gate to fresh captures.
- The placeholder `gameId` may remain until the owner authorizes `rundot init`.

## One version

`package.json` is the single version number: the menu renders it and every analytics
event is tagged with it as `build_version`. Once published it must equal the version
RUN serves on the Public tag — never pin it to a separate development track.
`rundot deploy --bump <Major|Minor|Patch>` decides the number; set `package.json` and
`package-lock.json` to it in the same commit as the ship, then verify with
`npm run version:check` (unpublished games pass; needs network, so it sits outside
`npm run check`).
