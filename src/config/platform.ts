export const PLATFORM_IDS = Object.freeze({
    gameId: "REPLACE_WITH_RUN_GAME_ID",
    rewardedHint: "wordwhirl_hint_rewarded",
    auroraCompassItem: "wordwhirl_aurora_compass_pack",
    auroraCompassEntitlement: "wordwhirl_aurora_compass",
    hintPackItem: "wordwhirl_hint_pack_30",
    hintPackEntitlement: "wordwhirl_hints",
});

/** Global starting stock, ad refill size, and paid pack size. */
export const HINT_ECONOMY = Object.freeze({
    startingStock: 3,
    adRefill: 3,
    packSize: 30,
    packPriceRb: 200,
});

export function isConfiguredPlatformId(value: string): boolean {
    return value.length > 0 && !value.startsWith("REPLACE_WITH_");
}
