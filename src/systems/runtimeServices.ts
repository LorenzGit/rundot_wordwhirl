import packageJson from "../../package.json";
import { PLATFORM_IDS, isConfiguredPlatformId } from "../config/platform.ts";
import {
    fetchLiveOps,
    getRunCapabilities,
    recordAnalytics,
    recordFunnelStep,
    triggerHaptic,
    type HapticStyle,
} from "../sdk/runSdk.ts";
import { store } from "../state/store.ts";
import { refreshServerTime } from "./serverTime.ts";

export interface RuntimeConfig {
    adsEnabled: boolean;
    shopEnabled: boolean;
}

const DEFAULTS: Readonly<RuntimeConfig> = Object.freeze({ adsEnabled: false, shopEnabled: false });
let config: RuntimeConfig = { ...DEFAULTS };
let nextRefreshTimer = 0;

function clearRefresh(): void {
    if (!nextRefreshTimer) return;
    window.clearTimeout(nextRefreshTimer);
    nextRefreshTimer = 0;
}

function objectValue(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function normalize(values: Record<string, unknown>): RuntimeConfig {
    const monetization = objectValue(values.wordwhirl_monetization ?? objectValue(values.runtime).monetization);
    const enabled = monetization.enabled === true;
    return {
        adsEnabled:
            enabled && monetization.rewardedAdsEnabled === true && isConfiguredPlatformId(PLATFORM_IDS.rewardedHint),
        shopEnabled:
            enabled &&
            monetization.purchasesEnabled === true &&
            (isConfiguredPlatformId(PLATFORM_IDS.auroraCompassItem) ||
                isConfiguredPlatformId(PLATFORM_IDS.hintPackItem)),
    };
}

async function refresh(): Promise<void> {
    clearRefresh();
    const [liveOps, trustedTimeReady] = await Promise.all([fetchLiveOps(), refreshServerTime()]);
    if (!liveOps) {
        // KEEP the live config on a failed fetch: resetting to DEFAULTS here
        // yanked an enabled shop/ads surface for the rest of the session on a
        // single resume-time network blip. Retry only where a host could
        // actually answer — without the capability this null is permanent.
        store.patch({ runtimeReady: true, trustedTimeReady });
        if (getRunCapabilities().liveops) {
            nextRefreshTimer = window.setTimeout(() => void refresh(), 60_000);
        }
        return;
    }
    config = normalize(liveOps.values);
    store.patch({ runtimeReady: true, runtimeConfigVersion: liveOps.configVersion, trustedTimeReady });
    if (liveOps.nextChangeAt) {
        const delay = Math.max(1_000, Math.min(liveOps.nextChangeAt - Date.now() + 500, 2_147_000_000));
        nextRefreshTimer = window.setTimeout(() => void refresh(), delay);
    }
}

export const runtimeServices = {
    get config(): Readonly<RuntimeConfig> {
        return config;
    },
    bootstrap(): void {
        void refresh();
        this.track("game_boot", { version: packageJson.version });
        // Canonical core-loop name RUN's query filters on. The `game_loaded`
        // funnel step keeps its shipped name; this is the queryable event.
        this.track("game_opened", { version: packageJson.version });
    },
    resume(): void {
        void refresh();
    },
    track(eventName: string, payload: Record<string, unknown> = {}): void {
        void recordAnalytics(eventName, { ...payload, build_version: packageJson.version });
    },
    funnel(step: number, name: string, funnel: string, funnelOrder = 0): void {
        void recordFunnelStep(step, name, funnel, funnelOrder);
    },
    async haptic(style: HapticStyle): Promise<boolean> {
        return store.get().hapticsEnabled ? triggerHaptic(style) : false;
    },
};
