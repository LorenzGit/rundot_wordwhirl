import { buildCrossword } from "./crossword.ts";
import { dictionaryWordsFrom, isSafeWord } from "./dictionary.ts";
import { WHEELS } from "./wheels.data.ts";

export interface WordLevel {
    id: string;
    route: string;
    title: string;
    letters: string;
    answers: readonly string[];
    bonus: readonly string[];
}

/**
 * Word-length difficulty bands (inclusive max letter count for every answer/bonus):
 *   Levels 1–3  → 3 only
 *   Levels 4–6  → 3–4
 *   Levels 7–9  → 3–5
 *   Levels 10+  → 3–6
 *
 * The allow-list tops out at six letters, so from level 10 the word-length lever is
 * spent. Generated levels (13+) ramp difficulty through wheel pool richness and
 * answer count instead — see `generatedLevel`.
 *
 * Every answer and bonus word must also appear in safe-english-words-3to6.txt.
 */
export const LEVEL_LENGTH_BANDS = Object.freeze([
    { fromLevel: 1, toLevel: 3, maxLetters: 3 as const },
    { fromLevel: 4, toLevel: 6, maxLetters: 4 as const },
    { fromLevel: 7, toLevel: 9, maxLetters: 5 as const },
    { fromLevel: 10, toLevel: 12, maxLetters: 6 as const },
]);

export function maxWordLengthForLevel(levelNumber: number): 3 | 4 | 5 | 6 {
    const band = LEVEL_LENGTH_BANDS.find((entry) => levelNumber >= entry.fromLevel && levelNumber <= entry.toLevel);
    return band?.maxLetters ?? 6;
}

/** The authored teaching sequence. Levels beyond this are generated. */
export const HANDCRAFTED_LEVELS: readonly WordLevel[] = Object.freeze([
    // --- Band 1: 3-letter words only ---
    { id: "dawn-01", route: "Dawn Draft", title: "First Light", letters: "SUN", answers: ["SUN"], bonus: [] },
    {
        id: "dawn-02",
        route: "Dawn Draft",
        title: "Westward",
        letters: "OWN",
        answers: ["OWN", "NOW", "WON"],
        bonus: [],
    },
    {
        id: "dawn-03",
        route: "Dawn Draft",
        title: "Tea Gale",
        letters: "TEA",
        answers: ["TEA", "ATE", "EAT"],
        bonus: [],
    },
    // --- Band 2: 3–4 letter words ---
    {
        id: "meadow-01",
        route: "Meadow Gale",
        title: "Goldleaf",
        letters: "GOLD",
        answers: ["GOLD", "DOG", "LOG", "OLD"],
        bonus: [],
    },
    {
        id: "meadow-02",
        route: "Meadow Gale",
        title: "Bearpath",
        letters: "BEAR",
        answers: ["BEAR", "BARE", "EAR", "BAR"],
        bonus: ["ARE", "BRA", "ERA"],
    },
    {
        id: "meadow-03",
        route: "Meadow Gale",
        title: "Notestone",
        letters: "NOTE",
        answers: ["NOTE", "TONE", "NET", "ONE"],
        bonus: ["TEN", "TOE", "TON", "NOT"],
    },
    // --- Band 3: 3–5 letter words ---
    {
        id: "tempest-01",
        route: "Tempest Turn",
        title: "Stormglass",
        letters: "STORM",
        answers: ["STORM", "MOST", "SORT", "ROT"],
        bonus: [],
    },
    {
        id: "tempest-02",
        route: "Tempest Turn",
        title: "Dream Current",
        letters: "DREAM",
        answers: ["DREAM", "READ", "DEAR", "MADE"],
        bonus: ["ARMED", "DARE", "DAME", "ARM", "EAR", "RED"],
    },
    {
        id: "tempest-03",
        route: "Tempest Turn",
        title: "Heartwind",
        letters: "HEART",
        answers: ["HEART", "EARTH", "HEAT", "TEAR"],
        bonus: ["HEAR", "RATE", "ART", "EAR", "ARE"],
    },
    // --- Band 4: 3–6 letter words ---
    {
        id: "aurora-01",
        route: "Aurora Arc",
        title: "Planetwake",
        letters: "PLANET",
        answers: ["PLANET", "PLANE", "PLANT", "PANEL"],
        bonus: ["PLATE", "LANE", "LEAN", "PLAN", "PALE"],
    },
    {
        id: "aurora-02",
        route: "Aurora Arc",
        title: "Gardenrise",
        letters: "GARDEN",
        answers: ["GARDEN", "DANGER", "RANGE", "GRADE"],
        bonus: ["GRAND", "ANGER", "DEAR", "DARE", "AGE"],
    },
    {
        id: "aurora-03",
        route: "Aurora Arc",
        title: "Streamline",
        letters: "STREAM",
        answers: ["STREAM", "MASTER", "SMART", "STARE"],
        bonus: ["RATES", "MATES", "STAR", "ARTS", "TEAM"],
    },
]);

/** First level number produced by the generator rather than authored by hand. */
export const FIRST_GENERATED_LEVEL = HANDCRAFTED_LEVELS.length + 1;

/**
 * Levels per sky arc. Progression is unbounded, so this is the celebration and
 * `routeLoops` cadence rather than the end of the content.
 */
export const LEVELS_PER_ARC = HANDCRAFTED_LEVELS.length;

const ROUTE_NAMES: readonly string[] = Object.freeze([
    "Dawn Draft",
    "Meadow Gale",
    "Tempest Turn",
    "Aurora Arc",
    "Lantern Reach",
    "Harbour Veer",
    "Ember Crossing",
    "Solstice Run",
]);
const TITLE_HEAD: readonly string[] = Object.freeze([
    "First",
    "High",
    "Long",
    "Still",
    "Wide",
    "Far",
    "Deep",
    "Bright",
    "Quiet",
    "Last",
]);
const TITLE_TAIL: readonly string[] = Object.freeze([
    "Light",
    "Draft",
    "Current",
    "Crossing",
    "Reach",
    "Passage",
    "Drift",
    "Span",
    "Channel",
    "Verge",
]);

/** Wheels whose layout search failed are skipped; ~9% of the table needs a retry. */
const MAX_WHEEL_ATTEMPTS = 12;
const BONUS_CAP = 6;
/**
 * The board auto-scales to fit, so an oversized grid does not overflow — it shrinks
 * cells until the letters stop being readable. These are the widest and tallest the
 * twelve authored boards get, so generated levels are never worse than what ships.
 */
const MAX_BOARD_WIDTH = 9;
const MAX_BOARD_HEIGHT = 7;
/** Bounded so an unlimited run cannot grow memory without limit. */
const LEVEL_MEMO_LIMIT = 64;

const levelMemo = new Map<number, WordLevel>();

function rotate<T>(items: readonly T[], offset: number): T[] {
    if (items.length === 0) return [];
    const shift = ((offset % items.length) + items.length) % items.length;
    return [...items.slice(shift), ...items.slice(0, shift)];
}

/** Answers grow with depth but never exceed what the wheel's pool can support. */
function answerCountFor(step: number, poolSize: number): number {
    const ramped = 4 + Math.floor(step / 60);
    return Math.max(3, Math.min(8, ramped, poolSize - 2));
}

/**
 * Build level `levelNumber` (> HANDCRAFTED_LEVELS.length) from the frozen wheel table.
 *
 * Pure function of the level number: no RNG, no clock, no stored state. Every player
 * gets the same level 847 forever, which is what keeps the "no gameplay randomness"
 * rule intact while the content is unbounded.
 */
function generatedLevel(levelNumber: number): WordLevel {
    const step = levelNumber - FIRST_GENERATED_LEVEL;
    const span = WHEELS.length;
    // Each pass through the table reuses wheels with a different answer slice.
    const cycle = Math.floor(step / span);
    // The table is ranked easiest-first, so a naive wrap would reset difficulty to
    // trivial after one pass. Later passes stay in the richer half of the ladder.
    const floorIndex = cycle === 0 ? 0 : Math.floor(span / 2);
    const usable = span - floorIndex;
    const maxLen = maxWordLengthForLevel(levelNumber);

    for (let attempt = 0; attempt < MAX_WHEEL_ATTEMPTS; attempt += 1) {
        const wheel = WHEELS[floorIndex + (((step % span) + attempt) % usable)];
        if (!wheel) continue;
        const pool = dictionaryWordsFrom(wheel).filter((word) => word.length <= maxLen);
        const top = pool.find((word) => word.length === maxLen);
        if (!top) continue;

        const rest = rotate(
            pool.filter((word) => word !== top),
            cycle,
        );
        const want = answerCountFor(step, pool.length);

        // Shed answers before abandoning the wheel: fewer words means a smaller board.
        for (let count = want; count >= 3; count -= 1) {
            const answers = [top, ...rest.slice(0, count - 1)];
            if (answers.length < count) break;
            const level: WordLevel = {
                id: `gen-${levelNumber}`,
                route: ROUTE_NAMES[Math.floor((levelNumber - 1) / 3) % ROUTE_NAMES.length] ?? "Sky Route",
                title: `${TITLE_HEAD[levelNumber % TITLE_HEAD.length]} ${TITLE_TAIL[Math.floor(levelNumber / TITLE_HEAD.length) % TITLE_TAIL.length]}`,
                letters: wheel,
                answers,
                bonus: rest.slice(count - 1, count - 1 + BONUS_CAP),
            };

            try {
                assertLevelUsesSafeWords(level, levelNumber);
                // Proves a clean, readable layout exists before the player sees it.
                const board = buildCrossword(level);
                if (board.width > MAX_BOARD_WIDTH || board.height > MAX_BOARD_HEIGHT) continue;
                return level;
            } catch {
                // No clean layout at this answer count; try one word fewer.
            }
        }
    }
    throw new Error(`No playable wheel for WORDWHIRL level ${levelNumber} after ${MAX_WHEEL_ATTEMPTS} attempts`);
}

export function levelForNumber(levelNumber: number): WordLevel {
    const requested = Math.max(1, Math.floor(levelNumber));
    if (requested <= HANDCRAFTED_LEVELS.length) {
        const level = HANDCRAFTED_LEVELS[requested - 1];
        if (!level) throw new Error(`Missing WORDWHIRL level ${requested}`);
        return level;
    }

    const memoized = levelMemo.get(requested);
    if (memoized) return memoized;

    const built = generatedLevel(requested);
    levelMemo.set(requested, built);
    if (levelMemo.size > LEVEL_MEMO_LIMIT) {
        const oldest = levelMemo.keys().next().value;
        if (oldest !== undefined) levelMemo.delete(oldest);
    }
    return built;
}

/** Test helper: drop memoized generated levels after table or band changes. */
export function clearLevelMemo(): void {
    levelMemo.clear();
}

export function canSpell(letters: string, word: string): boolean {
    const available = new Map<string, number>();
    for (const letter of letters.toUpperCase()) available.set(letter, (available.get(letter) ?? 0) + 1);
    for (const letter of word.toUpperCase()) {
        const remaining = available.get(letter) ?? 0;
        if (remaining <= 0) return false;
        available.set(letter, remaining - 1);
    }
    return true;
}

/** Fail fast if a handcrafted level drifts off the allow-list or length band. */
export function assertLevelUsesSafeWords(level: WordLevel, levelNumber = HANDCRAFTED_LEVELS.indexOf(level) + 1): void {
    const maxLen = maxWordLengthForLevel(levelNumber > 0 ? levelNumber : 1);
    const words = [...level.answers, ...level.bonus];
    for (const word of words) {
        if (!isSafeWord(word)) {
            throw new Error(`${level.id}: "${word}" is not in safe-english-words-3to6.txt`);
        }
        if (word.length > maxLen) {
            throw new Error(`${level.id}: "${word}" is ${word.length} letters; band max is ${maxLen}`);
        }
        if (!canSpell(level.letters, word)) {
            throw new Error(`${level.id}: "${word}" cannot be spelled from ${level.letters}`);
        }
    }
    if (levelNumber >= 4) {
        const hasTopLength = level.answers.some((word) => word.length === maxLen);
        if (!hasTopLength) {
            throw new Error(`${level.id}: band requires at least one ${maxLen}-letter answer`);
        }
    }
}
