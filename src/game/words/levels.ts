import { isSafeWord } from "./dictionary.ts";

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
 *   Levels 10–12 → 3–6
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

export const LEVELS: readonly WordLevel[] = Object.freeze([
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

export function levelForNumber(levelNumber: number): WordLevel {
    const index = Math.max(0, Math.min(LEVELS.length - 1, Math.floor(levelNumber) - 1));
    const level = LEVELS[index];
    if (!level) throw new Error(`Missing WORDWHIRL level ${index + 1}`);
    return level;
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
export function assertLevelUsesSafeWords(level: WordLevel, levelNumber = LEVELS.indexOf(level) + 1): void {
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
