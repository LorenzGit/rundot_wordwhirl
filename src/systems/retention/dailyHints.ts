import { getRunCapabilities } from "../../sdk/runSdk.ts";
import { store } from "../../state/store.ts";
import { saveSystem } from "../save.ts";
import { hasServerTime, localDayKey, serverNow } from "../serverTime.ts";
import { analytics } from "../analytics/analyticsConfig.ts";
import { refreshReturnNotifications } from "./returnNotifications.ts";

const REWARDS = [1, 1, 1, 2, 1, 2, 3] as const;
let claimInFlight = false;

function previousDay(day: string): string {
    const date = new Date(`${day}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() - 1);
    return date.toISOString().slice(0, 10);
}

function timeGate() {
    const capabilities = getRunCapabilities();
    const authoritative = capabilities.host && !capabilities.mock;
    if (authoritative && !hasServerTime()) return { ready: false, authoritative, day: null };
    return { ready: true, authoritative, day: localDayKey(serverNow()) };
}

export const dailyHints = {
    view() {
        const gate = timeGate();
        const state = store.get();
        if (!gate.ready || !gate.day)
            return { ...gate, claimed: false, streak: state.dailyRewardStreak, reward: REWARDS[0] };
        const claimed = state.dailyRewardClaimIds.includes(`daily-hints:${gate.day}`);
        const nextStreak = state.dailyRewardLastClaimDay === previousDay(gate.day) ? state.dailyRewardStreak + 1 : 1;
        return {
            ...gate,
            claimed,
            streak: claimed ? state.dailyRewardStreak : nextStreak,
            reward: REWARDS[(Math.max(1, claimed ? state.dailyRewardStreak : nextStreak) - 1) % REWARDS.length] ?? 1,
        };
    },

    async claim(): Promise<{ ok: boolean; reason: string; reward: number }> {
        if (claimInFlight) return { ok: false, reason: "BUSY", reward: 0 };
        const view = this.view();
        if (!view.ready || !view.day) return { ok: false, reason: "WAITING FOR RUN TIME", reward: 0 };
        const claimId = `daily-hints:${view.day}`;
        if (view.claimed || store.get().dailyRewardClaimIds.includes(claimId))
            return { ok: false, reason: "ALREADY CLAIMED", reward: 0 };
        claimInFlight = true;
        const before = store.get();
        store.patch({
            hints: before.hints + view.reward,
            dailyRewardLastClaimDay: view.day,
            dailyRewardStreak: view.streak,
            dailyRewardClaimIds: [...before.dailyRewardClaimIds, claimId].slice(-90),
        });
        const saved = await saveSystem.flush();
        if (!saved) {
            const current = store.get();
            store.patch({
                hints: Math.max(0, current.hints - view.reward),
                dailyRewardLastClaimDay: before.dailyRewardLastClaimDay,
                dailyRewardStreak: before.dailyRewardStreak,
                dailyRewardClaimIds: current.dailyRewardClaimIds.filter((id) => id !== claimId),
            });
        } else {
            analytics.event("daily_hint_reward_claimed", {
                streak: view.streak,
                hints: view.reward,
                authoritative: view.authoritative,
            });
            // Canonical payout name alongside the game's own: only
            // reward_claimed reaches RUN's economy query.
            analytics.event("reward_claimed", {
                amount: view.reward,
                currency: "hint",
                source: "daily_reward",
                streak: view.streak,
            });
            void refreshReturnNotifications("daily_reward_claimed");
        }
        claimInFlight = false;
        return { ok: saved, reason: saved ? "CLAIMED" : "SAVE FAILED", reward: saved ? view.reward : 0 };
    },
};
