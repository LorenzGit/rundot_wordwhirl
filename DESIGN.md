# WORDWHIRL design brief

`DESIGN.md` is the product source of truth for this game.

## Game

- Player fantasy / audience / orientation / session: restore words to a storm-tossed sky atlas; casual word-puzzle players; portrait-first; 2–5 minute sessions.
- Core loop / first action: drag through the letter compass to form a word, place it in the compact crossword, collect Sparks from extra words, then ride the cleared windway onward.
- First 10 minutes: level 1 teaches one three-letter swipe; levels 2–3 stay on three-letter crossings; levels 4–6 introduce four-letter words; free-hint value shows once the player has a few clears; an invalid word is a soft wobble with instant retry.
- Goals: clear the current grid; complete a named route of twelve handcrafted skies; build lifetime Words Found and Perfect Route records. Later content adds routes through typed level data.
- First-session win / stopping point / return promise: a solved grid within the first minute; every result card is a clean stopping point; returning resumes the exact current puzzle and its revealed cells.
- Controls / comfort: pointer or touch drag, physical keyboard fallback, free shuffle, 44px DOM actions, readable high-contrast labels, separate music/SFX/haptics settings, reduced-motion treatment.
- Difficulty / RNG: curated deterministic levels; no gameplay randomness. Difficulty grows through **word-length bands**, wheel size, and overlapping word count — not timers or lives.
  - Levels 1–3: **3-letter words only**
  - Levels 4–6: **3–4 letter** words
  - Levels 7–9: **3–5 letter** words
  - Levels 10–12: **3–6 letter** words (hardest)
- Economy: Sparks come from level completion and first-time bonus words (cosmetic score currency). **Hints are a global stock**: start with **3**; each hint reveals one cell. When stock is 0, an optional rewarded ad grants **+3**, or a Shop pack grants **+30 for 200 RB**. Sparks no longer buy hints. Shuffle is always free.
- Dictionary: every answer and bonus word is a member of `safe-english-words-3to6.txt` (3–6 letter allow-list) **and** the level's length band. Runtime `evaluateWord` rejects anything outside the allow-list. Two-letter words are intentionally excluded.
- Non-payer promise: every puzzle and route is playable forever without ads or purchases; starter hints plus optional ad refills cover comfort help; there are no lives, timers, or forced interstitials.
- Content seams: stable route/level IDs and typed word lists; save schema migrations preserve level, found words, revealed cells, settings, records, ad caps, and pending purchases.

## Monetization

- Model: gentle hybrid — global hint stock, opt-in rewarded refill, consumable hint pack, durable theme; no interstitials.
- Value moment: after a few clears the starter three hints feel meaningful; optional refill paths appear only when stock is empty.
- Run Bits products:
  - `wordwhirl_hint_pack_30` — **200 RB**, consumable, grants **30** global hints after verified purchase (`wordwhirl_hints` entitlement quantity is informational; local stock is granted only on host-verified checkout).
  - `wordwhirl_aurora_compass_pack` — **199 RB**, durable `wordwhirl_aurora_compass` theme only (no extra free hints).
- Rewarded placement: `wordwhirl_hint_rewarded`. Offered only when hint stock is **0**. Verified completion adds **+3** stock (does not auto-spend). No fill/cancel/error grants nothing. Session cap 3; trusted-day cap 5; unavailable path keeps the puzzle playable and points to the pack.
- Exposure: Compass shop shows the hint pack always (when host-ready); Aurora theme purchase CTA stays progression-locked until level 3.
- Purchase architecture: RUN Shop + authoritative Entitlements with stable idempotency, order-history recovery, refund/revocation reconciliation, and fail-closed local behavior.
- KPIs: level completion rate; rewarded hint completion rate; payer conversion. Guardrails: D1/D7 retention, post-offer abandonment, hint-source mix, and non-cancellation error rate.
- Deliberate checklist skips: no six-tier premium-currency ladder, first-purchase multiplier, countdown, bundles, or depth-of-spend gate. A small deterministic word game does not yet have enough permanent value to justify those surfaces; adding them now would create pressure without player benefit.

## Art and motion

- Direction: "storm-lit storybook atlas" — hand-inked navy silhouettes, parchment cream UI, celadon and aurora mint highlights, warm apricot rewards, and deep indigo night-sky depth.
- Composition: compact crossword in the upper half, wind compass in the lower third, full-bleed layered sky landscape behind both. Portrait gameplay is the main authored composition; desktop receives a separate wide arrangement of the same procedural motifs behind a centered frame.
- Shape language / material: rounded paper cutouts, inked 2px edges, compass ticks, cloud curls, and ribbon-like wind paths. No photography, platform emoji, generic neon glass, copied Wordscapes colors, or raster assets from the reference page.
- Typography: system-owned rounded sans stack with uppercase display copy and high tracking; no external font download.
- Motion: staggered screen entrance, responsive compass trace, tile reveal pop, Spark flight, and route-clear wind spiral. Reduced motion swaps travel for short fades and color/shape changes; input is never held behind decoration.
- Asset method / rights: project-authored SVG/CSS/Pixi geometry for UI chrome, plus **twelve** Grok Imagine portrait scenic backdrops (`wordwhirl-sky-l01.jpg` … `l12.jpg`), one distinct palette per level. Active plate is selected via `--wordwhirl-sky` CSS var. Desktop rails cover-crop the same plate. The Gamojo Wordscapes permalink is a permitted public layout/timing reference only — no source asset or palette is copied. `public/thumbnail.jpg` is rendered from the original Wordwhirl composition at 512×512.
- Motion timing: final-word celebrate beat (~1.65 s) keeps the board fully visible (no dim scrim) with a bottom “Sky Cleared” celebration + progress meter, then the full results card; wheel labels sit on a growing pill; shuffle eases letters with cubic-out; toast holds ~2.8 s; reduced-motion collapses decorative delays.

## Audio

- Direction: airy marimba-like triangle plucks, soft paper ticks, filtered wind, and restrained fifths; no vocals, harsh highs, or continuous bass.
- States: sparse menu motif; slightly fuller compass pulse in play; consonant route-clear cadence; scheduling suspends for pause/background/host overlays and resumes without a hard restart.
- Feedback: letter enter, invalid word, accepted word, bonus Spark, hint reveal, level clear, navigation, and purchase outcome each have named procedural cues plus visual feedback; meaningful results pair with capability-gated haptics.
- Settings: persisted Music, SFX, haptics, and reduced motion. Defaults: music 34%, SFX 68%.
- Assets: one bounded procedural Web Audio service; no remote generation, external files, or RUN credits.

## Measurement

- Decision / owner: identify the first level or interaction where players stall; product owner reviews after a meaningful sample.
- Primary: unique `level_completed` players / unique `level_started` players by stable level ID and build version.
- Supporting: active completion duration, attempts, invalid submissions, hints used by source, bonus words, and highest level reached.
- FTUE funnel: boot → menu ready → first compass gesture → first accepted word → level 1 complete → level 2 complete.
- Guardrails: renderer/runtime errors, puzzle solvability, saves, monetization verification, duplicate events, and bounded property cardinality.
- Prohibited data: entered non-dictionary strings, raw pointer paths, save snapshots, payment data, identifiers beyond host-provided analytics context.

## Verification

- Simulation validates every answer against its wheel, crossword intersections, duplicate-letter use, hint reachability, scoring, and full twelve-level progression.
- Browser QA covers 320×568, 390×844, 768×1024, 1024×768, and 1440×900; pointer swipe, keyboard entry, results, shop, settings, save/reload, pause, safe areas, reduced motion, and renderer fallback.
- Host-only QA remains required for real ads, Shop pricing, checkout, entitlements, refunds, haptics, and RUN storage/lifecycle delivery.
