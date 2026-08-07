import { store } from "../../state/store.ts";
import { recordAnalytics, recordFunnelStep } from "../../sdk/runSdk.ts";
import packageJson from "../../../package.json";
import { countedSteps, createAnalytics } from "./analytics.ts";

/**
 * Stable funnel names and ordering. Append after release; never renumber
 * existing steps. New once-ever detail goes in `onboarding` so historical
 * `ftue` curves stay valid.
 */
export const analytics = createAnalytics({
    emitEvent: (name, payload) => {
        void recordAnalytics(name, { ...payload, build_version: packageJson.version });
    },
    emitFunnelStep: (step, name, funnel, order) => {
        void recordFunnelStep(step, name, funnel, order);
    },
    funnels: {
        load: {
            order: 0,
            onceEver: true,
            steps: ["load_started", "load_sdk_ready", "load_save_ready", "load_assets_ready"],
        },
        /**
         * Coarse FTUE (frozen step numbers). Prefer `onboarding` for new
         * granular drop-off analysis; keep firing these for continuity.
         */
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
        /** Granular once-ever beats — primary product funnel for drop-off. */
        onboarding: {
            order: 1,
            onceEver: true,
            steps: [
                "onb_boot_complete",
                "onb_menu_ready",
                "onb_howto_opened",
                "onb_route_opened",
                "onb_play_tapped",
                "onb_l1_started",
                "onb_l1_tutorial_shown",
                "onb_l1_first_letter",
                "onb_l1_word_submitted",
                "onb_l1_word_accepted",
                "onb_l1_completed",
                "onb_results_celebrate_shown",
                "onb_results_card_opened",
                "onb_results_continue",
                "onb_l2_started",
                "onb_l2_first_word",
                "onb_l2_completed",
                "onb_l3_started",
                "onb_first_hint_used",
                "onb_first_shuffle",
                "onb_hint_stock_empty",
                "onb_first_ad_refill_offer",
                "onb_first_ad_refill_complete",
                "onb_shop_opened",
                "onb_hint_pack_selected",
                "onb_settings_opened",
            ],
        },
        engagement: { order: 2, steps: countedSteps("level_completed_", 12) },
        purchase: {
            order: 3,
            steps: ["shop_opened", "item_selected", "checkout_started", "purchase_complete"],
        },
        /** Repeatable hint economy funnel for refill conversion. */
        hint_refill: {
            order: 4,
            steps: [
                "hint_stock_empty",
                "hint_ad_offered",
                "hint_ad_complete",
                "hint_pack_viewed",
                "hint_pack_purchased",
            ],
        },
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
    debug: import.meta.env.DEV,
});
