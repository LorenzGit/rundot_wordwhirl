import { store } from "../../state/store.ts";
import { recordAnalytics, recordFunnelStep } from "../../sdk/runSdk.ts";
import packageJson from "../../../package.json";
import { countedSteps, createAnalytics } from "./analytics.ts";
import { saveSystem } from "../save.ts";

/**
 * Stable funnel names and ordering. Append after release; never renumber
 * existing steps. Keep optional screens and branching economy actions out of
 * ordered funnels: they remain custom events so conversion cannot exceed 100%.
 */
export const analytics = createAnalytics({
    emitEvent: (name, payload) => {
        void recordAnalytics(name, { ...payload, build_version: packageJson.version });
    },
    emitFunnelStep: (step, name, funnel, order) => {
        // Return the delivery promise so once-ever marks persist only after a
        // confirmed emit (a rejected/false result releases the mark to retry).
        return recordFunnelStep(step, name, funnel, order);
    },
    funnels: {
        load: {
            order: 0,
            onceEver: true,
            steps: ["load_started", "load_sdk_ready", "load_save_ready", "load_assets_ready"],
        },
        /** Coarse mandatory FTUE. Frozen and causally ordered. */
        ftue: {
            order: 1,
            onceEver: true,
            steps: [
                "game_loaded",
                "menu_viewed",
                "first_level_started",
                "first_compass_gesture",
                "first_word_accepted",
                "first_level_completed",
                "second_level_completed",
            ],
        },
        ftue_v2: {
            order: 1,
            onceEver: true,
            steps: [
                "menu_ready",
                "play_tapped",
                "first_gesture",
                "first_word",
                "level_1_complete",
                "continue_tapped",
                "level_2_complete",
            ],
        },
        engagement: { order: 2, steps: countedSteps("level_completed_", 12) },
        purchase: {
            order: 3,
            steps: ["shop_opened", "item_selected", "checkout_started", "purchase_complete"],
        },
        /** Rewarded and paid refill paths are separate causal funnels. */
        hint_ad_refill: {
            order: 4,
            steps: ["hint_stock_empty", "hint_ad_offered", "hint_ad_complete"],
        },
        hint_purchase: { order: 4, steps: ["hint_pack_viewed", "hint_pack_selected", "hint_pack_purchased"] },
    },
    enrich: () => {
        const state = store.get();
        return {
            levels_completed: state.levelsCompleted,
            level: state.level,
            hints_stock: state.hints,
            sparks: state.sparks,
            phase: state.phase,
            menu_screen: state.menuScreen,
            reduced_motion: state.reducedMotion,
            notifications_enabled: state.notificationsEnabled,
        };
    },
    marksKey: "wordwhirl_funnel_marks",
    readOnceEverMarks: () => store.get().analyticsFunnelMarks,
    writeOnceEverMarks: (marks) => {
        store.patch({ analyticsFunnelMarks: marks.slice(-160) });
        saveSystem.scheduleFlush();
    },
    debug: import.meta.env.DEV,
});
