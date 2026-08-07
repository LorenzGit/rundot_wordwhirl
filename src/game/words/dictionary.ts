/**
 * Project dictionary — only words from safe-english-words-3to6.txt are legal.
 * Answers and bonus lists must be subsets of this set (enforced by simulation).
 */
import { SAFE_WORD_LIST } from "./safeWords.data.ts";

export const SAFE_WORDS: ReadonlySet<string> = new Set(SAFE_WORD_LIST);

export function normalizeWord(raw: string): string {
    return raw.trim().toUpperCase();
}

export function isSafeWord(raw: string): boolean {
    return SAFE_WORDS.has(normalizeWord(raw));
}

/** Words from the dictionary that can be spelled with the given multiset of letters. */
export function dictionaryWordsFrom(letters: string): string[] {
    const upper = letters.toUpperCase();
    const available = new Map<string, number>();
    for (const letter of upper) available.set(letter, (available.get(letter) ?? 0) + 1);

    const results: string[] = [];
    for (const word of SAFE_WORDS) {
        if (word.length > upper.length) continue;
        const pool = new Map(available);
        let ok = true;
        for (const letter of word) {
            const remaining = pool.get(letter) ?? 0;
            if (remaining <= 0) {
                ok = false;
                break;
            }
            pool.set(letter, remaining - 1);
        }
        if (ok) results.push(word);
    }
    return results.sort((a, b) => b.length - a.length || a.localeCompare(b));
}
