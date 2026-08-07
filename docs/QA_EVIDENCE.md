# WORDWHIRL QA evidence

Date: 2026-08-06 · Version: 0.2.4 · Target: RUN public ship (RUNSHIP)

## Ship note (0.2.4)

- Patch bump for public RUNSHIP after private `v1.0.0` and particle-feedback
  polish. Visible UI version reads `package.json` (`v0.2.4` on main menu).
- Platform gameId: `U77YYcBCX44R1p3eAHVG`.

## Automated evidence

- `npm run check`: PASS — format, lint, simulation, invariants, public audit,
  typecheck, embedded production build, and bundled production build.
- `npm run visual-qa`: PASS — 35 captures at 320×568, 390×844,
  768×1024, 1024×768, and 1440×900. Minimum DOM text: 10 CSS px.
  Minimum interactive target: 44 CSS px. Pointer swipe, keyboard, free hint,
  pause/resume, reduced-motion persistence, and reload persistence passed.
- Simulation: PASS — 12 levels, 43 answers, 24 bonus words; every grid and
  hint path resolves.
- Final bundled `dist/` includes the Grok Imagine portrait backdrop
  (`wordwhirl-sky-portrait-*.jpg`, 208 KiB, 720×1280).

## Polish pass (0.1.1)

- One Grok Imagine scenic portrait backdrop wired through CSS + asset manifest
  (desktop rails cover-crop the same plate until a dedicated wide pass).
- Wordscapes-inspired layout/timing: side circular shuffle/hint orbs, delayed
  results reveal (~720 ms), staggered result card, brighter swipe path glow,
  tile-pop particles, celebration confetti, toast hold ~2.8 s.
- Reduced-motion collapses decorative delays and travel.

## UI / art gate

Screenshot: `tmp/visual-qa/phone-tall-game.png` (also reviewed
`phone-small-game.png`, `phone-tall-main.png`, `phone-tall-results.png`,
`desktop-main.png`)

Reference: Gamojo Wordscapes page for structural/timing comparison only.
WORDWHIRL keeps the compact grid/wheel hierarchy and own atlas identity.

Candidate fails first:
- Earlier small-phone orb/wheel letter overlap — fixed with side circular orbs
  and a raised wheel layout; re-captured.
- Earlier results CTA invisible during capture (stagger too long) — fixed with
  shorter stagger + 1400 ms results wait; re-captured.

1. UI overlap: **No** — side orbs clear letter discs on 320×568 and 390×844;
   HUD chips and tutorial bubble keep separation.
2. Text issues: **No** — glyphs complete; automated minimum is 10 px; icon
   orbs use aria-labels for shuffle/hint.
3. Art covered by UI: **No** — scenic sky remains full-bleed backdrop;
   translucent panels do not hide required subjects.
4. Art too small: **No** — letters, grid cells, orbs, and medallion stay readable
   at phone-small.
5. Malformed icons: **No** — SVG strokes complete (shuffle, hint, spark, nav).
6. Style drift: **No** — single Grok plate + ink/paper/mint/apricot chrome
   consistent on menu, play, results; desktop rails use the same plate cover-cropped.
7. Misalignment: **No** — centered board/wheel, symmetric side orbs, shared
   menu baselines, centered desktop frame.
8. Stretch/squash: **No** — backdrop uses cover (uniform scale + crop);
   circular orbs and medallion retain proportions.

Result: **PASS**.

## Readiness checklist

| Gate | Status | Evidence / exception |
| --- | --- | --- |
| Design | PASS | `DESIGN.md`; deterministic simulation. |
| FTUE and accessibility | PASS | Tutorial bubble, free first hint, keyboard path, 44 px/10 px audit, reduced motion. |
| Save and progression | PASS | Versioned save, lifecycle flush, reload QA. |
| Monetization | BLOCKED | Fail-closed local; Playground/host verification still required. |
| LiveOps | BLOCKED | Checked-in defaults only; no remote upload. |
| Visual quality | PASS | Grok backdrop, branded boot, fresh matrix, UI/art gate, 512×512 thumbnail. |
| Audio and haptics | BLOCKED | Procedural audio wired; device mix/host haptics remain. |
| Assets and catalog | PASS | Relative assets, Portrait config, visible version `0.1.1`. |
| Localization | PASS | English-only; locale-aware number audit. |
| Reliability | PASS | `npm run check`, both builds, multi-viewport QA. |
| Reproducible QA | PASS | Dev QA contract + real pointer/keyboard input. |
| Multiplayer / authority | N/A | Single-player deterministic word game. |
| Analytics | BLOCKED | Events wired; live RUN delivery needs initialized game. |
| Safety and support | PASS | No UGC; invalid strings stay local. |
| Release operations | BLOCKED | `gameId` uninitialized; no deploy authorized. |

Decision: **do not ship yet**. Local polish + gates are green; owner-authorized
RUN init / Playground verification remains required.
