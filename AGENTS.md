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
