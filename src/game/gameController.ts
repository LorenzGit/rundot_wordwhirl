import { audioManager } from "../audio/audioManager.ts";
import { HINT_ECONOMY } from "../config/platform.ts";
import { showHintRewardedAd } from "../systems/ads.ts";
import {
    abandonWordwhirlLevel,
    completeWordwhirlLevel,
    recordAcceptedWord,
    recordBonusWord,
    recordCompassGesture,
    recordDuplicateWord,
    recordHintAdOffered,
    recordHintAdResult,
    recordHintStockEmpty,
    recordHintUsed,
    recordInvalidWord,
    recordPlayTapped,
    recordResultsContinue,
    recordShuffle,
    recordWordSubmitted,
    startWordwhirlLevel,
} from "../systems/gameAnalytics.ts";
import { refreshReturnNotifications } from "../systems/retention/returnNotifications.ts";
import { runtimeServices } from "../systems/runtimeServices.ts";
import { saveSystem } from "../systems/save.ts";
import { store } from "../state/store.ts";
import { answersFullyRevealed, crosswordFor, nextHintCell } from "./words/crossword.ts";
import { LEVELS_PER_ARC, levelForNumber } from "./words/levels.ts";
import { evaluateWord, levelSparkReward } from "./words/rules.ts";

let feedbackId = 0;

function feedback(text: string, tone: "good" | "bonus" | "bad" | "neutral"): void {
    feedbackId += 1;
    store.patch({ wordFeedback: { id: feedbackId, text, tone } });
}

function resetPuzzleState(): void {
    store.patch({
        currentFoundWords: [],
        currentBonusWords: [],
        revealedCells: [],
        hintsUsed: 0,
        invalidAttempts: 0,
        result: null,
        wordFeedback: null,
        shuffleNonce: store.get().shuffleNonce + 1,
    });
}

export function levelFullySolved(state = store.get()): boolean {
    const level = levelForNumber(state.level);
    return level.answers.every((answer) => state.currentFoundWords.includes(answer));
}

/**
 * Open the level-complete surface if every answer is already found.
 * Used after a cold resume where progress was saved without an ephemeral `result`.
 * Never double-grants sparks/records unless `grantRewards` is true.
 */
export function ensureLevelResult(options?: { grantRewards?: boolean }): boolean {
    const state = store.get();
    if (state.result) return true;
    if (!levelFullySolved(state)) return false;

    const level = levelForNumber(state.level);
    const grantRewards = options?.grantRewards === true;
    const reward = grantRewards ? levelSparkReward(state.level) : 0;
    const perfect = grantRewards && state.invalidAttempts === 0 && state.hintsUsed === 0;
    const perfectStreak = perfect ? state.currentPerfectStreak + 1 : state.currentPerfectStreak;
    const routeComplete = state.level % LEVELS_PER_ARC === 0;

    store.patch({
        sparks: state.sparks + reward,
        levelsCompleted: state.levelsCompleted + (grantRewards ? 1 : 0),
        perfectLevels: state.perfectLevels + (perfect ? 1 : 0),
        currentPerfectStreak: perfect ? perfectStreak : grantRewards ? 0 : state.currentPerfectStreak,
        bestPerfectStreak: Math.max(state.bestPerfectStreak, perfectStreak),
        result: {
            title: level.title,
            reward: grantRewards ? reward : levelSparkReward(state.level),
            words: state.currentFoundWords.length,
            perfect: grantRewards ? perfect : state.invalidAttempts === 0 && state.hintsUsed === 0,
            routeComplete,
        },
    });
    return true;
}

export function startCurrentLevel(): void {
    recordPlayTapped();
    // Resume a fully-cleared board into the results flow instead of a dead end
    // (save keeps found words but not the ephemeral result object).
    if (levelFullySolved()) {
        store.patch({ phase: "playing", menuScreen: "main" });
        ensureLevelResult({ grantRewards: false });
    } else {
        store.patch({ phase: "playing", menuScreen: "main", result: null });
    }
    audioManager.play("start");
    startWordwhirlLevel();
    void refreshReturnNotifications("level_start");
}

export function recordGesture(): void {
    recordCompassGesture();
}

export function submitWord(rawWord: string): void {
    const state = store.get();
    if (state.result || state.paused) return;
    const level = levelForNumber(state.level);
    const word = rawWord.toUpperCase();
    recordWordSubmitted(word.length);
    const result = evaluateWord(level, word, state.currentFoundWords, state.currentBonusWords);

    if (result === "answer") {
        recordAcceptedWord(word.length);
        const foundWords = [...state.currentFoundWords, word];
        const complete = foundWords.length === level.answers.length;
        if (!complete) {
            store.patch({ currentFoundWords: foundWords, lifetimeWords: state.lifetimeWords + 1 });
            feedback(word, "good");
            audioManager.play("word");
            void runtimeServices.haptic("light");
            void saveSystem.flush();
            return;
        }

        const reward = levelSparkReward(state.level);
        const perfect = state.invalidAttempts === 0 && state.hintsUsed === 0;
        const perfectStreak = perfect ? state.currentPerfectStreak + 1 : 0;
        const routeComplete = state.level % LEVELS_PER_ARC === 0;
        store.patch({
            currentFoundWords: foundWords,
            lifetimeWords: state.lifetimeWords + 1,
            sparks: state.sparks + reward,
            levelsCompleted: state.levelsCompleted + 1,
            perfectLevels: state.perfectLevels + (perfect ? 1 : 0),
            currentPerfectStreak: perfectStreak,
            bestPerfectStreak: Math.max(state.bestPerfectStreak, perfectStreak),
            result: { title: level.title, reward, words: foundWords.length, perfect, routeComplete },
        });
        feedback(word, "good");
        audioManager.play("clear");
        void runtimeServices.haptic("success");
        completeWordwhirlLevel(state.hintsUsed, state.invalidAttempts, state.currentBonusWords.length);
        void saveSystem.flush();
        void refreshReturnNotifications("level_complete");
        return;
    }

    if (result === "bonus") {
        store.patch({
            currentBonusWords: [...state.currentBonusWords, word],
            lifetimeBonusWords: state.lifetimeBonusWords + 1,
            sparks: state.sparks + 5,
        });
        recordBonusWord(word.length);
        feedback(`BONUS +5`, "bonus");
        audioManager.play("bonus");
        void runtimeServices.haptic("light");
        void saveSystem.flush();
        return;
    }

    if (result === "duplicate") {
        recordDuplicateWord(word.length);
        feedback("ALREADY FOUND", "neutral");
        audioManager.play("tap");
        return;
    }

    store.patch({ invalidAttempts: state.invalidAttempts + 1 });
    feedback(word.length > 1 ? "NOT IN THIS WIND" : "KEEP SWIPING", "bad");
    audioManager.play("error");
    void runtimeServices.haptic("warning");
    recordInvalidWord(word.length);
    void saveSystem.flush();
}

function spendHintAndReveal(source: "stock" | "ad_refill"): boolean {
    const state = store.get();
    if (state.hints <= 0) return false;
    const level = levelForNumber(state.level);
    const cell = nextHintCell(crosswordFor(level), state.currentFoundWords, state.revealedCells);
    if (!cell) {
        store.patch({ toast: "NO CELLS LEFT TO REVEAL" });
        return false;
    }
    const revealedCells = [...state.revealedCells, cell.key];

    // A reveal can fill in the last missing cell of an answer. Credit those words:
    // otherwise the board reads as finished while the level never completes, and a
    // player who hinted out the final word is left with nothing left to do.
    const credited = answersFullyRevealed(crosswordFor(level), level.answers, state.currentFoundWords, revealedCells);
    const currentFoundWords = [...state.currentFoundWords, ...credited];

    store.patch({
        hints: state.hints - 1,
        revealedCells,
        hintsUsed: state.hintsUsed + 1,
        currentFoundWords,
        lifetimeWords: state.lifetimeWords + credited.length,
    });
    feedback(`${cell.letter} REVEALED`, "bonus");
    audioManager.play("hint");
    void runtimeServices.haptic("light");
    recordHintUsed(source, store.get().hints);
    if (store.get().hints === 0) recordHintStockEmpty();

    if (levelFullySolved()) {
        const solvedState = store.get();
        if (ensureLevelResult({ grantRewards: true })) {
            audioManager.play("clear");
            void runtimeServices.haptic("success");
            completeWordwhirlLevel(
                solvedState.hintsUsed,
                solvedState.invalidAttempts,
                solvedState.currentBonusWords.length,
            );
            void refreshReturnNotifications("level_complete");
        }
    }
    void saveSystem.flush();
    return true;
}

export function hintsRemaining(): number {
    return Math.max(0, store.get().hints);
}

export function hintLabel(): string {
    const stock = hintsRemaining();
    if (stock > 0) return `HINT · ${stock}`;
    return "WATCH AD +3";
}

export async function requestHint(): Promise<void> {
    const state = store.get();
    if (state.hintBusy || state.result) return;

    if (state.hints > 0) {
        spendHintAndReveal("stock");
        return;
    }

    // Empty stock: optional ad refill (+3). Paid packs live in the Compass shop.
    recordHintStockEmpty();
    recordHintAdOffered();
    store.patch({ hintBusy: true });
    const result = await showHintRewardedAd();
    store.patch({ hintBusy: false });
    if (result === "verified") {
        store.patch({ hints: store.get().hints + HINT_ECONOMY.adRefill });
        void saveSystem.flush();
        recordHintAdResult("verified", store.get().hints);
        store.patch({ toast: `+${HINT_ECONOMY.adRefill} HINTS ADDED` });
        audioManager.play("reward");
        void runtimeServices.haptic("success");
        return;
    }
    recordHintAdResult(result, store.get().hints);
    if (result === "cancelled") store.patch({ toast: "AD CLOSED — NO HINTS ADDED" });
    else if (result === "unavailable") store.patch({ toast: "NO AD — BUY A 30-HINT PACK IN COMPASS (200 RB)" });
    else store.patch({ toast: "AD FAILED — NO HINTS ADDED" });
}

export function shuffleLetters(): void {
    if (store.get().result || store.get().paused) return;
    store.patch({ shuffleNonce: store.get().shuffleNonce + 1 });
    recordShuffle();
    feedback("WIND SHIFT", "neutral");
    audioManager.play("shuffle");
}

export function advanceLevel(): void {
    recordResultsContinue();
    const state = store.get();
    // Progression is unbounded; an arc boundary is a milestone, not a wrap.
    const arcComplete = state.level % LEVELS_PER_ARC === 0;
    store.patch({ level: state.level + 1, routeLoops: state.routeLoops + (arcComplete ? 1 : 0) });
    resetPuzzleState();
    void saveSystem.flush();
    startWordwhirlLevel();
    void refreshReturnNotifications("advance_level");
}

export function leaveLevel(): void {
    abandonWordwhirlLevel("menu_exit");
    store.patch({ phase: "menu", menuScreen: "main", result: null });
    void saveSystem.flush();
    void refreshReturnNotifications("leave_level");
}
