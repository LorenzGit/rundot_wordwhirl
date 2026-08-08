/**
 * Per-level scenic skies (Grok Imagine plates).
 * Menu/boot uses level 1 (dawn). Gameplay swaps by current level.
 */
import sky01 from "../assets/art/wordwhirl-sky-l01.jpg";
import sky02 from "../assets/art/wordwhirl-sky-l02.jpg";
import sky03 from "../assets/art/wordwhirl-sky-l03.jpg";
import sky04 from "../assets/art/wordwhirl-sky-l04.jpg";
import sky05 from "../assets/art/wordwhirl-sky-l05.jpg";
import sky06 from "../assets/art/wordwhirl-sky-l06.jpg";
import sky07 from "../assets/art/wordwhirl-sky-l07.jpg";
import sky08 from "../assets/art/wordwhirl-sky-l08.jpg";
import sky09 from "../assets/art/wordwhirl-sky-l09.jpg";
import sky10 from "../assets/art/wordwhirl-sky-l10.jpg";
import sky11 from "../assets/art/wordwhirl-sky-l11.jpg";
import sky12 from "../assets/art/wordwhirl-sky-l12.jpg";

const LEVEL_SKIES: readonly string[] = [
    sky01,
    sky02,
    sky03,
    sky04,
    sky05,
    sky06,
    sky07,
    sky08,
    sky09,
    sky10,
    sky11,
    sky12,
];

export const SKY_COUNT = LEVEL_SKIES.length;

/**
 * Resolved Vite URL for the sky plate shown on this level (1-based).
 * Levels are unbounded and plates are not, so the twelve cycle.
 */
export function skyUrlForLevel(levelNumber: number): string {
    const ordinal = Math.max(1, Math.floor(levelNumber));
    const index = (ordinal - 1) % LEVEL_SKIES.length;
    return LEVEL_SKIES[index] ?? sky01;
}

/** CSS `url(...)` value for --wordwhirl-sky. */
export function skyCssUrlForLevel(levelNumber: number): string {
    return `url(${skyUrlForLevel(levelNumber)})`;
}

/** @deprecated Prefer skyUrlForLevel; kept for older call sites. */
export type SkyId = "dawn" | "meadow" | "tempest" | "aurora";

export function skyIdForRoute(route: string): SkyId {
    const name = route.toLowerCase();
    if (name.includes("meadow")) return "meadow";
    if (name.includes("tempest")) return "tempest";
    if (name.includes("aurora")) return "aurora";
    return "dawn";
}
