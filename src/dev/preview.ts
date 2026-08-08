import { levelSparkReward } from "../game/words/rules.ts";
import { store, type MenuScreen } from "../state/store.ts";

const MENU_SCREENS = new Set<MenuScreen>(["main", "route", "shop", "settings", "how-to"]);

export function applyDevelopmentScreenPreview(): void {
    if (!import.meta.env.DEV) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("numbers") === "large") {
        store.patch({
            sparks: 1_234_567,
            hints: 1_234,
            lifetimeWords: 1_234_567,
            lifetimeBonusWords: 987_654,
            perfectLevels: 12_345,
        });
    }
    // Levels past the authored twelve are generated, so previewing them needs a jump.
    const requestedLevel = Number(params.get("level"));
    if (Number.isFinite(requestedLevel) && requestedLevel >= 1) {
        store.patch({
            level: Math.floor(requestedLevel),
            currentFoundWords: [],
            currentBonusWords: [],
            revealedCells: [],
            result: null,
        });
    }
    const requested = params.get("screen");
    if (!requested) return;
    if (requested === "game") {
        store.patch({ phase: "playing", menuScreen: "main", paused: false, result: null });
        return;
    }
    if (requested === "results") {
        store.patch({
            phase: "playing",
            menuScreen: "main",
            paused: false,
            result: {
                title: "Dream Current",
                reward: levelSparkReward(10),
                words: 4,
                perfect: true,
                routeComplete: false,
            },
        });
        return;
    }
    if (MENU_SCREENS.has(requested as MenuScreen)) {
        store.patch({ phase: "menu", menuScreen: requested as MenuScreen, paused: false });
        return;
    }
    console.warn(`[dev] Unknown screen preview "${requested}".`);
}
