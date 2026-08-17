import { showVerifiedRewardedAd, type VerifiedActionResult } from "../sdk/runSdk.ts";
import { PLATFORM_IDS } from "../config/platform.ts";
import { store } from "../state/store.ts";
import { saveSystem } from "./save.ts";
import { canUseTimeGates, localDayKey, serverNow } from "./serverTime.ts";
import { runtimeServices } from "./runtimeServices.ts";

const SESSION_CAP = 3;
const DAILY_CAP = 5;
const COOLDOWN_MS = 20_000;

let sessionCount = 0;
let lastShownAt = -Infinity;

export type RewardedHintBlockReason =
    | "ok"
    | "locked"
    | "disabled"
    | "cooldown"
    | "session-cap"
    | "daily-cap"
    | "time-untrusted";

function refreshDay(): void {
    const today = localDayKey(serverNow());
    const state = store.get();
    if (state.adHintDay === today) return;
    store.patch({ adHintDay: today, adHintsToday: 0 });
    void saveSystem.flush();
}

export function rewardedHintEligibility(): RewardedHintBlockReason {
    // Refill ads only when the player is out of stock.
    if (store.get().hints > 0) return "locked";
    if (!runtimeServices.config.adsEnabled) return "disabled";
    if (!canUseTimeGates()) return "time-untrusted";
    refreshDay();
    if (performance.now() - lastShownAt < COOLDOWN_MS) return "cooldown";
    if (sessionCount >= SESSION_CAP) return "session-cap";
    if (store.get().adHintsToday >= DAILY_CAP) return "daily-cap";
    return "ok";
}

export async function showHintRewardedAd(): Promise<VerifiedActionResult> {
    const eligibility = rewardedHintEligibility();
    if (eligibility !== "ok") return "unavailable";
    runtimeServices.track("rewarded_ad_offered", {
        ad_display_id: PLATFORM_IDS.rewardedHint,
        placement: "hint_refill",
    });
    const result = await showVerifiedRewardedAd(PLATFORM_IDS.rewardedHint, "Get 3 Hints");
    if (result === "verified") {
        sessionCount += 1;
        lastShownAt = performance.now();
        store.patch({ adHintsToday: store.get().adHintsToday + 1 });
        void saveSystem.flush();
        runtimeServices.track("rewarded_ad_watched", {
            ad_display_id: PLATFORM_IDS.rewardedHint,
            placement: "hint_refill",
        });
    } else {
        // The decline branch. Without it the ad funnel has an offer count and a
        // completion count but no way to tell a refusal from an ad that never
        // filled — two very different problems.
        runtimeServices.track("rewarded_ad_dismissed", {
            ad_display_id: PLATFORM_IDS.rewardedHint,
            placement: "hint_refill",
            result,
        });
    }
    return result;
}

export function adHintDiagnostics(): Record<string, string | number> {
    return {
        eligibility: rewardedHintEligibility(),
        session_count: sessionCount,
        daily_count: store.get().adHintsToday,
    };
}
