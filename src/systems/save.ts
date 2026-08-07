import { HINT_ECONOMY } from "../config/platform.ts";
import { getRunCapabilities, readAppStorage, writeAppStorage } from "../sdk/runSdk.ts";
import { levelForNumber } from "../game/words/levels.ts";
import { store, type AppState, type PendingPurchaseIntentSnapshot } from "../state/store.ts";

const SAVE_KEY = "wordwhirl:save:v1";
export const SAVE_VERSION = 2;

export interface WordwhirlSaveV2 {
    version: 2;
    settings: Pick<
        AppState,
        | "musicEnabled"
        | "musicVolume"
        | "sfxEnabled"
        | "sfxVolume"
        | "hapticsEnabled"
        | "reducedMotion"
        | "notificationsEnabled"
        | "locale"
        | "quality"
    >;
    progress: Pick<
        AppState,
        | "sparks"
        | "hints"
        | "level"
        | "levelsCompleted"
        | "routeLoops"
        | "lifetimeWords"
        | "lifetimeBonusWords"
        | "perfectLevels"
        | "currentPerfectStreak"
        | "bestPerfectStreak"
        | "currentFoundWords"
        | "currentBonusWords"
        | "revealedCells"
        | "hintsUsed"
        | "invalidAttempts"
        | "adHintDay"
        | "adHintsToday"
    >;
    commerce: Pick<AppState, "pendingPurchaseIntent" | "ownedProductIds">;
}

/** @deprecated wire name kept for call sites; always SAVE_VERSION shape. */
export type WordwhirlSaveV1 = WordwhirlSaveV2;

export type SaveSource = "run" | "local" | "defaults";

function clamp01(value: unknown, fallback: number): number {
    return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback;
}

function booleanOr(value: unknown, fallback: boolean): boolean {
    return typeof value === "boolean" ? value : fallback;
}

function integer(value: unknown, fallback = 0, minimum = 0): number {
    const parsed = Number(value);
    return Number.isFinite(parsed)
        ? Math.min(Number.MAX_SAFE_INTEGER, Math.max(minimum, Math.floor(parsed)))
        : fallback;
}

function dayKey(value: unknown): string | null {
    return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function pendingIntent(value: unknown): PendingPurchaseIntentSnapshot | null {
    if (!value || typeof value !== "object") return null;
    const candidate = value as Partial<PendingPurchaseIntentSnapshot>;
    if (
        typeof candidate.productId !== "string" ||
        typeof candidate.catalogItemId !== "string" ||
        typeof candidate.idempotencyKey !== "string" ||
        candidate.idempotencyKey.length === 0 ||
        candidate.idempotencyKey.length > 160
    ) {
        return null;
    }
    return {
        productId: candidate.productId.slice(0, 64),
        catalogItemId: candidate.catalogItemId.slice(0, 96),
        idempotencyKey: candidate.idempotencyKey,
        startedAt: integer(candidate.startedAt),
    };
}

function knownWords(value: unknown, allowed: readonly string[]): string[] {
    if (!Array.isArray(value)) return [];
    const allowedSet = new Set(allowed);
    return [...new Set(value.filter((entry): entry is string => typeof entry === "string" && allowedSet.has(entry)))];
}

function cellKeys(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return [
        ...new Set(value.filter((entry): entry is string => typeof entry === "string" && /^\d+,\d+$/.test(entry))),
    ].slice(0, 64);
}

function productIds(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return [
        ...new Set(
            value.filter((entry): entry is string => typeof entry === "string" && /^[a-z][a-z0-9_]{0,63}$/.test(entry)),
        ),
    ].slice(0, 16);
}

function snapshot(): WordwhirlSaveV2 {
    const state = store.get();
    return {
        version: SAVE_VERSION,
        settings: {
            musicEnabled: state.musicEnabled,
            musicVolume: state.musicVolume,
            sfxEnabled: state.sfxEnabled,
            sfxVolume: state.sfxVolume,
            hapticsEnabled: state.hapticsEnabled,
            reducedMotion: state.reducedMotion,
            notificationsEnabled: state.notificationsEnabled,
            locale: state.locale,
            quality: state.quality,
        },
        progress: {
            sparks: state.sparks,
            hints: state.hints,
            level: state.level,
            levelsCompleted: state.levelsCompleted,
            routeLoops: state.routeLoops,
            lifetimeWords: state.lifetimeWords,
            lifetimeBonusWords: state.lifetimeBonusWords,
            perfectLevels: state.perfectLevels,
            currentPerfectStreak: state.currentPerfectStreak,
            bestPerfectStreak: state.bestPerfectStreak,
            currentFoundWords: state.currentFoundWords,
            currentBonusWords: state.currentBonusWords,
            revealedCells: state.revealedCells,
            hintsUsed: state.hintsUsed,
            invalidAttempts: state.invalidAttempts,
            adHintDay: state.adHintDay,
            adHintsToday: state.adHintsToday,
        },
        commerce: {
            pendingPurchaseIntent: state.pendingPurchaseIntent,
            ownedProductIds: state.ownedProductIds,
        },
    };
}

function migrate(raw: unknown): WordwhirlSaveV2 | null {
    if (!raw || typeof raw !== "object") return null;
    const candidate = raw as {
        version?: number;
        settings?: WordwhirlSaveV2["settings"];
        progress?: Record<string, unknown>;
        commerce?: WordwhirlSaveV2["commerce"];
    };
    // Accept v1 (no hints field) and v2.
    const version = candidate.version;
    if ((version !== 1 && version !== 2) || !candidate.settings || !candidate.progress) {
        return null;
    }
    const defaults = snapshot();
    const settings = candidate.settings;
    const progress = candidate.progress as WordwhirlSaveV2["progress"] & { hints?: unknown };
    const level = integer(progress.level, 1, 1);
    const currentLevel = levelForNumber(level);
    // Missing hints on old saves → starter stock (not zero).
    const hints =
        typeof progress.hints === "number"
            ? integer(progress.hints, HINT_ECONOMY.startingStock)
            : HINT_ECONOMY.startingStock;
    return {
        version: SAVE_VERSION,
        settings: {
            musicEnabled: booleanOr(settings.musicEnabled, defaults.settings.musicEnabled),
            musicVolume: clamp01(settings.musicVolume, defaults.settings.musicVolume),
            sfxEnabled: booleanOr(settings.sfxEnabled, defaults.settings.sfxEnabled),
            sfxVolume: clamp01(settings.sfxVolume, defaults.settings.sfxVolume),
            hapticsEnabled: booleanOr(settings.hapticsEnabled, defaults.settings.hapticsEnabled),
            reducedMotion: booleanOr(settings.reducedMotion, defaults.settings.reducedMotion),
            notificationsEnabled: booleanOr(
                (settings as { notificationsEnabled?: boolean }).notificationsEnabled,
                defaults.settings.notificationsEnabled,
            ),
            locale: settings.locale === "English" ? "English" : defaults.settings.locale,
            quality: settings.quality === "low" ? "low" : "high",
        },
        progress: {
            sparks: integer(progress.sparks),
            hints,
            level,
            levelsCompleted: integer(progress.levelsCompleted),
            routeLoops: integer(progress.routeLoops),
            lifetimeWords: integer(progress.lifetimeWords),
            lifetimeBonusWords: integer(progress.lifetimeBonusWords),
            perfectLevels: integer(progress.perfectLevels),
            currentPerfectStreak: integer(progress.currentPerfectStreak),
            bestPerfectStreak: integer(progress.bestPerfectStreak),
            currentFoundWords: knownWords(progress.currentFoundWords, currentLevel.answers),
            currentBonusWords: knownWords(progress.currentBonusWords, currentLevel.bonus),
            revealedCells: cellKeys(progress.revealedCells),
            hintsUsed: integer(progress.hintsUsed),
            invalidAttempts: integer(progress.invalidAttempts),
            adHintDay: dayKey(progress.adHintDay),
            adHintsToday: integer(progress.adHintsToday),
        },
        commerce: {
            pendingPurchaseIntent: pendingIntent(candidate.commerce?.pendingPurchaseIntent),
            ownedProductIds: productIds(candidate.commerce?.ownedProductIds),
        },
    };
}

function parse(raw: string | null): WordwhirlSaveV2 | null {
    if (!raw) return null;
    try {
        return migrate(JSON.parse(raw));
    } catch {
        return null;
    }
}

function apply(save: WordwhirlSaveV2): void {
    store.patch({ ...save.settings, ...save.progress, ...save.commerce });
}

function readLocal(): string | null {
    try {
        return window.localStorage.getItem(SAVE_KEY);
    } catch (error) {
        console.warn("[save] local read failed", error);
        return null;
    }
}

function usesRunStorage(): boolean {
    const capabilities = getRunCapabilities();
    return capabilities.host && !capabilities.mock;
}

let lastSaved = "";
let pendingSave: string | null = null;
let flushInFlight: Promise<boolean> | null = null;

async function persist(serialized: string): Promise<boolean> {
    if (usesRunStorage()) return writeAppStorage(SAVE_KEY, serialized);
    try {
        window.localStorage.setItem(SAVE_KEY, serialized);
        return true;
    } catch (error) {
        console.warn("[save] local write failed", error);
        return false;
    }
}

export const saveSystem = {
    async load(): Promise<SaveSource> {
        const raw = usesRunStorage() ? await readAppStorage(SAVE_KEY) : null;
        const save = parse(raw ? (raw.ok ? raw.value : null) : readLocal());
        if (save) apply(save);
        lastSaved = JSON.stringify(snapshot());
        return save ? (usesRunStorage() ? "run" : "local") : "defaults";
    },
    async flush(): Promise<boolean> {
        const serialized = JSON.stringify(snapshot());
        if (serialized === lastSaved && pendingSave === null) return true;
        pendingSave = serialized;
        if (flushInFlight) return flushInFlight;
        flushInFlight = (async () => {
            let succeeded = true;
            while (pendingSave !== null) {
                const next = pendingSave;
                pendingSave = null;
                if (next === lastSaved) continue;
                if (await persist(next)) lastSaved = next;
                else succeeded = false;
            }
            return succeeded;
        })().finally(() => {
            flushInFlight = null;
        });
        return flushInFlight;
    },
};
