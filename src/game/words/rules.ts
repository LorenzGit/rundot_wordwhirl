import { isSafeWord, normalizeWord } from "./dictionary.ts";
import type { WordLevel } from "./levels.ts";

export type SubmissionResult = "answer" | "bonus" | "duplicate" | "invalid";

export function evaluateWord(
    level: WordLevel,
    rawWord: string,
    foundWords: readonly string[],
    foundBonusWords: readonly string[],
): SubmissionResult {
    const word = normalizeWord(rawWord);
    // Hard gate: nothing outside safe-english-words-3to6.txt is ever accepted.
    if (!isSafeWord(word)) return "invalid";
    if (foundWords.includes(word) || foundBonusWords.includes(word)) return "duplicate";
    if (level.answers.includes(word)) return "answer";
    if (level.bonus.includes(word)) return "bonus";
    return "invalid";
}

export function levelSparkReward(levelNumber: number): number {
    return 20 + Math.min(40, Math.max(0, levelNumber - 1) * 4);
}
