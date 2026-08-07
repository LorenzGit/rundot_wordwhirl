import { useSyncExternalStore } from "react";

export type MenuScreen = "main" | "route" | "shop" | "settings" | "how-to";

export interface PendingPurchaseIntentSnapshot {
    productId: string;
    catalogItemId: string;
    idempotencyKey: string;
    startedAt: number;
}

export interface LevelResult {
    title: string;
    reward: number;
    words: number;
    perfect: boolean;
    routeComplete: boolean;
}

export interface WordFeedback {
    id: number;
    text: string;
    tone: "good" | "bonus" | "bad" | "neutral";
}

export interface AppState {
    phase: "loading" | "menu" | "playing";
    loadProgress: number;
    paused: boolean;
    menuScreen: MenuScreen;

    sparks: number;
    /** Global spendable hint stock (not per-level). */
    hints: number;
    level: number;
    levelsCompleted: number;
    routeLoops: number;
    lifetimeWords: number;
    lifetimeBonusWords: number;
    perfectLevels: number;
    currentPerfectStreak: number;
    bestPerfectStreak: number;
    currentFoundWords: string[];
    currentBonusWords: string[];
    revealedCells: string[];
    hintsUsed: number;
    invalidAttempts: number;
    adHintDay: string | null;
    adHintsToday: number;

    musicEnabled: boolean;
    musicVolume: number;
    sfxEnabled: boolean;
    sfxVolume: number;
    hapticsEnabled: boolean;
    reducedMotion: boolean;
    /** Local preference; platform permission is separate. Default opted-in. */
    notificationsEnabled: boolean;
    locale: string;
    quality: "high" | "low";

    pendingPurchaseIntent: PendingPurchaseIntentSnapshot | null;
    ownedProductIds: string[];

    result: LevelResult | null;
    shuffleNonce: number;
    wordFeedback: WordFeedback | null;
    hintBusy: boolean;
    toast: string | null;
    runtimeReady: boolean;
    runtimeConfigVersion: string | null;
    trustedTimeReady: boolean;
}

const listeners = new Set<() => void>();

let state: AppState = {
    phase: "loading",
    loadProgress: 0,
    paused: false,
    menuScreen: "main",

    sparks: 0,
    hints: 3,
    level: 1,
    levelsCompleted: 0,
    routeLoops: 0,
    lifetimeWords: 0,
    lifetimeBonusWords: 0,
    perfectLevels: 0,
    currentPerfectStreak: 0,
    bestPerfectStreak: 0,
    currentFoundWords: [],
    currentBonusWords: [],
    revealedCells: [],
    hintsUsed: 0,
    invalidAttempts: 0,
    adHintDay: null,
    adHintsToday: 0,

    musicEnabled: true,
    musicVolume: 0.34,
    sfxEnabled: true,
    sfxVolume: 0.68,
    hapticsEnabled: true,
    reducedMotion: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
    notificationsEnabled: true,
    locale: "English",
    quality: "high",

    pendingPurchaseIntent: null,
    ownedProductIds: [],

    result: null,
    shuffleNonce: 0,
    wordFeedback: null,
    hintBusy: false,
    toast: null,
    runtimeReady: false,
    runtimeConfigVersion: null,
    trustedTimeReady: false,
};

export const store = {
    get(): AppState {
        return state;
    },
    patch(partial: Partial<AppState>): void {
        state = { ...state, ...partial };
        for (const listener of listeners) listener();
    },
    subscribe(listener: () => void): () => void {
        listeners.add(listener);
        return () => listeners.delete(listener);
    },
};

export function useStore<T = AppState>(selector: (state: AppState) => T = (value) => value as unknown as T): T {
    return useSyncExternalStore(store.subscribe, () => selector(state));
}
