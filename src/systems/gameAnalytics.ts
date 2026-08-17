import { LEVELS_PER_ARC, levelForNumber } from "../game/words/levels.ts";
import { store } from "../state/store.ts";
import { analytics } from "./analytics/analyticsConfig.ts";
import { createLevelAnalytics } from "./levelAnalytics.ts";
import { runtimeServices } from "./runtimeServices.ts";
import { submitLeaderboardScore } from "../sdk/runSdk.ts";

let gestureRecorded = false;
let letterSelectRecorded = false;
let wordSubmitRecorded = false;
let shuffleRecorded = false;
let celebrateRecorded = false;

export const wordwhirlLevelAnalytics = createLevelAnalytics({
    emit: (eventName, payload) => runtimeServices.track(eventName, payload),
});

function levelContext() {
    const state = store.get();
    const level = levelForNumber(state.level);
    return {
        level: state.level,
        level_id: level.id,
        route: level.route,
        answer_count: level.answers.length,
        wheel_size: level.letters.length,
        answers_found: state.currentFoundWords.length,
        bonus_found: state.currentBonusWords.length,
        hints_stock: state.hints,
        hints_used_level: state.hintsUsed,
        revealed_cells: state.revealedCells.length,
        invalid_attempts: state.invalidAttempts,
        reduced_motion: state.reducedMotion,
    };
}

export function startWordwhirlLevel(): void {
    gestureRecorded = false;
    letterSelectRecorded = false;
    wordSubmitRecorded = false;
    celebrateRecorded = false;
    const state = store.get();
    const level = levelForNumber(state.level);
    if (state.levelsCompleted === 0) analytics.funnelStep("ftue", 3, { level_id: level.id });

    wordwhirlLevelAnalytics.start({
        level: state.level,
        level_id: level.id,
        route: level.route,
        answer_count: level.answers.length,
        wheel_size: level.letters.length,
        reduced_motion: state.reducedMotion,
        hints_stock: state.hints,
    });

    analytics.event("level_started", {
        ...levelContext(),
        resume: state.currentFoundWords.length > 0 || state.revealedCells.length > 0,
    });
}

export function recordMenuReady(): void {
    analytics.funnelStep("ftue_v2", 1);
    // Canonical onboarding beat. The ftue_v2 funnel above travels a separate
    // pipeline that RUN's core-loop query cannot read.
    if (store.get().levelsCompleted === 0) analytics.event("ftue_started", { entry: "menu" });
    analytics.event("menu_ready", { levels_completed: store.get().levelsCompleted });
}

export function recordScreenView(screen: string): void {
    analytics.event("screen_viewed", { screen });
    if (screen === "shop") {
        analytics.funnelStep("purchase", 1);
        analytics.funnelStep("hint_purchase", 1);
        analytics.event("shop_opened", levelContext());
    }
}

export function recordPlayTapped(): void {
    analytics.funnelStep("ftue_v2", 2);
    analytics.event("play_tapped", levelContext());
}

export function recordTutorialShown(): void {
    analytics.event("tutorial_bubble_shown", { level: 1 });
}

export function recordCompassGesture(): void {
    if (gestureRecorded) return;
    gestureRecorded = true;
    analytics.event("first_compass_gesture", { level: store.get().level });
    if (store.get().levelsCompleted === 0) analytics.funnelStep("ftue", 4);
    if (!letterSelectRecorded) {
        letterSelectRecorded = true;
        analytics.funnelStep("ftue_v2", 3);
        analytics.event("first_letter_selected", levelContext());
    }
}

export function recordWordSubmitted(wordLength: number): void {
    if (!wordSubmitRecorded && store.get().level === 1) {
        wordSubmitRecorded = true;
    }
    analytics.event("word_submitted", {
        ...levelContext(),
        word_length: wordLength,
    });
}

export function recordAcceptedWord(wordLength: number): void {
    const state = store.get();
    analytics.event("word_accepted", {
        ...levelContext(),
        word_length: wordLength,
        is_bonus: false,
    });
    wordwhirlLevelAnalytics.checkpoint("word_found", {
        word_length: wordLength,
        answers_found: state.currentFoundWords.length + 1,
    });
    if (state.levelsCompleted === 0 && state.currentFoundWords.length === 0) {
        analytics.funnelStep("ftue", 5);
        analytics.funnelStep("ftue_v2", 4);
    }
}

export function recordBonusWord(wordLength: number): void {
    analytics.event("bonus_word_found", {
        ...levelContext(),
        word_length: wordLength,
    });
}

export function recordInvalidWord(wordLength: number): void {
    analytics.event("word_rejected", {
        ...levelContext(),
        word_length: wordLength,
    });
    wordwhirlLevelAnalytics.checkpoint("word_rejected", { word_length: wordLength });
}

export function recordDuplicateWord(wordLength: number): void {
    analytics.event("word_duplicate", {
        ...levelContext(),
        word_length: wordLength,
    });
}

export function recordShuffle(): void {
    if (!shuffleRecorded) {
        shuffleRecorded = true;
    }
    analytics.event("shuffle_used", levelContext());
    wordwhirlLevelAnalytics.checkpoint("shuffle_used");
}

export function recordHintUsed(source: string, stockLeft: number): void {
    analytics.event("hint_used", {
        ...levelContext(),
        source,
        stock_left: stockLeft,
    });
    wordwhirlLevelAnalytics.checkpoint("hint_used", { source, stock_left: stockLeft });
}

export function recordHintStockEmpty(): void {
    analytics.funnelStep("hint_ad_refill", 1);
    analytics.event("hint_stock_empty", levelContext());
}

export function recordHintAdOffered(): void {
    analytics.funnelStep("hint_ad_refill", 2);
    analytics.event("hint_ad_offered", levelContext());
}

export function recordHintAdResult(result: string, stockAfter: number): void {
    if (result === "verified") {
        analytics.funnelStep("hint_ad_refill", 3);
    }
    analytics.event("hint_ad_result", {
        ...levelContext(),
        result,
        stock_after: stockAfter,
    });
}

export function recordHintPackSelected(): void {
    analytics.funnelStep("purchase", 2);
    analytics.funnelStep("hint_purchase", 2);
    analytics.event("hint_pack_selected", levelContext());
}

export function recordPurchaseFunnel(
    step: 1 | 2 | 3 | 4,
    productId: string,
    extra: Record<string, string | number | boolean> = {},
): void {
    analytics.funnelStep("purchase", step, { product_id: productId, ...extra });
    if (step === 4 && productId === "hint_pack") {
        analytics.funnelStep("hint_purchase", 3);
        analytics.event("hint_pack_purchased", { ...levelContext(), ...extra });
    }
}

export function completeWordwhirlLevel(hintsUsed: number, invalidAttempts: number, bonusWords: number): void {
    const state = store.get();
    const level = levelForNumber(state.level);
    if (state.level === 1) {
        analytics.funnelStep("ftue", 6);
        analytics.funnelStep("ftue_v2", 5);
        // Clearing level 1 IS finishing onboarding here — there is no separate
        // tutorial sequence to dismiss.
        analytics.event("ftue_completed", { level_id: level.id });
    }
    if (state.level === 2) {
        analytics.funnelStep("ftue", 7);
        analytics.funnelStep("ftue_v2", 7);
    }
    analytics.funnelStep("engagement", Math.min(12, state.level), { level_id: level.id });

    const perfect = invalidAttempts === 0 && hintsUsed === 0;
    const metrics = wordwhirlLevelAnalytics.complete({
        hints_used: hintsUsed,
        invalid_attempts: invalidAttempts,
        bonus_words: bonusWords,
        perfect,
        sparks_reward: state.result?.reward ?? 0,
        hints_stock: state.hints,
    });

    analytics.event("level_completed", {
        ...levelContext(),
        hints_used: hintsUsed,
        invalid_attempts: invalidAttempts,
        bonus_words: bonusWords,
        perfect,
    });

    if (perfect) analytics.event("perfect_level", { level: state.level, level_id: level.id });
    if (state.level % LEVELS_PER_ARC === 0) {
        analytics.event("route_loop_complete", {
            route_loops: state.routeLoops + 1,
            level_id: level.id,
        });
    }
    // Route boundary: every 3 levels
    if (state.level % 3 === 0) {
        analytics.event("route_segment_complete", {
            level: state.level,
            route: level.route,
            level_id: level.id,
        });
        const score = state.levelsCompleted * 1_000 + state.lifetimeWords;
        void submitLeaderboardScore({
            score,
            durationSeconds: metrics?.duration_seconds ?? 1,
            metadata: {
                levels_completed: state.levelsCompleted,
                lifetime_words: state.lifetimeWords,
                route_loops: state.routeLoops,
            },
        }).then((result) => {
            analytics.event("leaderboard_score_submitted", {
                score,
                accepted: result?.accepted ?? false,
                rank: result?.rank ?? 0,
                reason: result?.reason ?? (result ? "unknown" : "unavailable"),
            });
            if (result?.accepted && result.rank) store.patch({ toast: `ROUTE RANK · #${result.rank}` });
        });
    }
}

export function recordResultsCelebrateShown(): void {
    if (celebrateRecorded) return;
    celebrateRecorded = true;
    analytics.event("results_celebrate_shown", levelContext());
}

export function recordResultsCardOpened(): void {
    analytics.event("results_card_opened", levelContext());
}

export function recordResultsContinue(): void {
    if (store.get().level === 1) analytics.funnelStep("ftue_v2", 6);
    analytics.event("results_continue", levelContext());
}

export function abandonWordwhirlLevel(reason: string): void {
    const state = store.get();
    wordwhirlLevelAnalytics.abandon(reason, {
        answers_found: state.currentFoundWords.length,
        hints_used: state.hintsUsed,
        hints_stock: state.hints,
    });
    analytics.event("level_left", {
        ...levelContext(),
        exit_reason: reason,
    });
}

export function recordSettingsChanged(setting: string, value: string | number | boolean): void {
    analytics.event("settings_changed", { setting, value });
}
