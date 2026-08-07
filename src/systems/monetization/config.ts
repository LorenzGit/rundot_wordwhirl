import { HINT_ECONOMY, PLATFORM_IDS } from "../../config/platform.ts";
import { createMonetizationPlan } from "./monetizationPlan.ts";
import { createProductRegistry } from "./productRegistry.ts";

export const monetizationPlan = createMonetizationPlan({
    model: "hybrid",
    nonPayerPromise:
        "Every puzzle and route remains playable without ads or purchases. Players start with three hints; optional rewarded videos refill three more, and a paid pack is never required. Shuffle is free; there are no lives or forced interstitials.",
    purchaseArchitecture: "shop-entitlements",
    architectureRationale:
        "The Aurora Compass is a permanent cross-device unlock via durable entitlements. Hint packs are consumable Shop items that grant local stock only after a verified purchase.",
    firstExposure: {
        valueMoment:
            "The player completes a few levels, spends their starter hints, and understands optional refill paths.",
        minCompletedSessions: 2,
        minProgression: 3,
    },
    primaryKpis: ["game_payer_conversion", "rewarded_completion_rate"],
    guardrails: {
        retention: "D1/D7 retention by first-offer exposure cohort",
        sessionHealth: "post-shop and post-ad puzzle abandonment",
        economyHealth: "hint use split by stock, ad refill, and paid pack",
        reliability: "purchase and ad error rate excluding cancellation",
    },
});

export const products = createProductRegistry([
    {
        id: "aurora_compass",
        catalogItemId: PLATFORM_IDS.auroraCompassItem,
        kind: "durable",
        expectedEntitlementIds: [PLATFORM_IDS.auroraCompassEntitlement],
        unique: true,
        unlockDescription: "Cosmetic aurora theme after the player understands the core loop",
    },
    {
        id: "hint_pack",
        catalogItemId: PLATFORM_IDS.hintPackItem,
        kind: "consumable",
        expectedEntitlementIds: [PLATFORM_IDS.hintPackEntitlement],
        unique: false,
        unlockDescription: `Adds ${HINT_ECONOMY.packSize} hints to the global stock for ${HINT_ECONOMY.packPriceRb} RB`,
    },
]);

export type ProductId = "aurora_compass" | "hint_pack";

export const PRODUCT_NAMES: Readonly<Record<ProductId, string>> = {
    aurora_compass: "AURORA COMPASS",
    hint_pack: "HINT PACK · 30",
};

export const DEV_PREVIEW_PRICES: Readonly<Record<ProductId, string>> = {
    aurora_compass: "199 RB · PREVIEW",
    hint_pack: "200 RB · PREVIEW",
};
