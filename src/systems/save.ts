import { HINT_ECONOMY } from "../config/platform.ts";
import { getRunCapabilities, readAppStorage, writeAppStorage } from "../sdk/runSdk.ts";
import { levelForNumber } from "../game/words/levels.ts";
import { store, type AppState, type PendingPurchaseIntentSnapshot } from "../state/store.ts";

const SAVE_KEY = "wordwhirl:save:v1";
export const SAVE_VERSION = 3;

export interface WordwhirlSaveV2 {
    version: 3;
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
        | "dailyRewardLastClaimDay"
        | "dailyRewardStreak"
        | "dailyRewardClaimIds"
        | "likePrompted"
        | "analyticsFunnelMarks"
    >;
    commerce: Pick<AppState, "pendingPurchaseIntent" | "ownedProductIds">;
}

/** @deprecated wire name kept for call sites; always SAVE_VERSION shape. */
export type WordwhirlSaveV1 = WordwhirlSaveV2;

/** "unavailable": RUN storage could not be read; defaults are in memory but never written to the cloud. */
export type SaveSource = "run" | "local" | "defaults" | "unavailable";

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

function recentStrings(value: unknown, limit: number): string[] {
    if (!Array.isArray(value)) return [];
    return [
        ...new Set(value.filter((entry): entry is string => typeof entry === "string" && entry.length <= 160)),
    ].slice(-limit);
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
            dailyRewardLastClaimDay: state.dailyRewardLastClaimDay,
            dailyRewardStreak: state.dailyRewardStreak,
            dailyRewardClaimIds: state.dailyRewardClaimIds,
            likePrompted: state.likePrompted,
            analyticsFunnelMarks: state.analyticsFunnelMarks,
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
    // Accept v1 (no hints field), v2, and current v3 engagement state.
    const version = candidate.version;
    if ((version !== 1 && version !== 2 && version !== 3) || !candidate.settings || !candidate.progress) {
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
            dailyRewardLastClaimDay: dayKey(progress.dailyRewardLastClaimDay),
            dailyRewardStreak: integer(progress.dailyRewardStreak),
            dailyRewardClaimIds: recentStrings(progress.dailyRewardClaimIds, 90),
            likePrompted: booleanOr(progress.likePrompted, false),
            analyticsFunnelMarks: recentStrings(progress.analyticsFunnelMarks, 160),
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
    const runtimeMarks = store.get().analyticsFunnelMarks;
    store.patch({
        ...save.settings,
        ...save.progress,
        analyticsFunnelMarks: [...new Set([...save.progress.analyticsFunnelMarks, ...runtimeMarks])],
        ...save.commerce,
    });
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
let scheduledFlushTimer = 0;

/**
 * Remote-write guard. A failed or timed-out RUN storage read is not a new
 * player: writing defaults then would replace the real cloud save. Remote
 * writes stay blocked until one read has succeeded. "blocked" means the cloud
 * holds a save from a newer build, which this build must never overwrite.
 */
type RemoteState = "unverified" | "verified" | "blocked";
let remoteState: RemoteState = "unverified";
let verifyInFlight: Promise<void> | null = null;
let verifyRetryTimer = 0;
const VERIFY_RETRY_MS = [2_000, 4_000, 8_000, 15_000, 30_000] as const;

function isNewerSave(raw: string): boolean {
    try {
        const version = (JSON.parse(raw) as { version?: unknown } | null)?.version;
        return typeof version === "number" && version > SAVE_VERSION;
    } catch {
        return false;
    }
}

type RemoteRead = "found" | "empty" | "failed" | "newer";

async function readRemote(): Promise<RemoteRead> {
    const remote = await readAppStorage(SAVE_KEY);
    if (!remote.ok) return "failed";
    if (remote.value === null) return "empty";
    const save = parse(remote.value);
    if (!save) {
        if (isNewerSave(remote.value)) return "newer";
        // Unreadable, not newer: keep a copy before it can be replaced.
        console.warn("[save] unreadable remote save; backing it up");
        await writeAppStorage(`${SAVE_KEY}-unreadable-backup`, remote.value);
        return "empty";
    }
    apply(save);
    lastSaved = JSON.stringify(snapshot());
    return "found";
}

function settleRemote(result: RemoteRead): void {
    if (result === "failed") return;
    remoteState = result === "newer" ? "blocked" : "verified";
    if (result === "newer") console.warn("[save] cloud save is from a newer build; cloud writes disabled");
}

/**
 * Retry the read in the background. flush() never awaits this: a caller that
 * reverts on a failed flush must not revert against a freshly applied save.
 */
function verifyRemote(attempt = 0): void {
    if (remoteState !== "unverified" || verifyInFlight || verifyRetryTimer) return;
    verifyInFlight = (async () => {
        if (usesRunStorage()) settleRemote(await readRemote());
    })().finally(() => {
        verifyInFlight = null;
        if (remoteState !== "unverified" || attempt >= VERIFY_RETRY_MS.length) return;
        verifyRetryTimer = window.setTimeout(() => {
            verifyRetryTimer = 0;
            verifyRemote(attempt + 1);
        }, VERIFY_RETRY_MS[attempt]);
    });
}

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
        if (!usesRunStorage()) {
            const save = parse(readLocal());
            if (save) apply(save);
            lastSaved = JSON.stringify(snapshot());
            return save ? "local" : "defaults";
        }
        const result = await readRemote();
        settleRemote(result);
        if (result === "found") return "run";
        lastSaved = JSON.stringify(snapshot());
        if (result === "failed") {
            console.warn("[save] cloud save unreadable at boot; cloud writes paused until a read succeeds");
            verifyRemote();
            return "unavailable";
        }
        return "defaults";
    },
    async flush(): Promise<boolean> {
        if (scheduledFlushTimer) {
            window.clearTimeout(scheduledFlushTimer);
            scheduledFlushTimer = 0;
        }
        if (usesRunStorage() && remoteState !== "verified") {
            // Never write over a cloud save this session has not read. A host
            // that attached after load() lands here too.
            verifyRemote();
            return false;
        }
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
    scheduleFlush(delayMs = 350): void {
        if (scheduledFlushTimer) window.clearTimeout(scheduledFlushTimer);
        scheduledFlushTimer = window.setTimeout(() => {
            scheduledFlushTimer = 0;
            void this.flush();
        }, delayMs);
    },
};
