/**
 * Re-engagement local notifications for WORDWHIRL.
 *
 * Uses the game's runSdk rearm helpers (cancel-first, payload reminder_id).
 * Schedule only while the app is alive — never from onSleep/onQuit.
 */
import {
    cancelLocalNotification,
    rearmLocalNotification,
    resolveLaunchIntent,
    setNotificationPreference,
    type NotificationPreferenceResult,
} from "../../sdk/runSdk.ts";
import { store } from "../../state/store.ts";
import { analytics } from "../analytics/analyticsConfig.ts";
import { runtimeServices } from "../runtimeServices.ts";

const HOUR = 3600;
const DAY = 24 * HOUR;

export interface ReturnReminder {
    id: string;
    title: string;
    body: string;
    delaySeconds: number;
}

/** Sliding cadence: primary 24h refreshes every active session; day2/day3 are backup. */
export const RETURN_REMINDERS: readonly ReturnReminder[] = Object.freeze([
    {
        id: "ww_return_24h",
        title: "The sky is waiting",
        body: "Your next Wordwhirl current is ready — clear another sky.",
        delaySeconds: DAY,
    },
    {
        id: "ww_return_48h",
        title: "Winds are shifting",
        body: "Come back for a quick puzzle. Shuffle is free.",
        delaySeconds: 2 * DAY,
    },
    {
        id: "ww_return_72h",
        title: "A new current opened",
        body: "Pick up your Wordwhirl route before the trail cools.",
        delaySeconds: 3 * DAY,
    },
]);

function optedIn(): boolean {
    return store.get().notificationsEnabled !== false;
}

/** Enable/disable platform local notifications and cancel everything on opt-out. */
export async function setNotificationsOptIn(enabled: boolean): Promise<NotificationPreferenceResult> {
    store.patch({ notificationsEnabled: enabled });
    const result = await setNotificationPreference(enabled);
    if (!enabled || result === "disabled" || result === "unavailable" || result === "failed") {
        await cancelAllReturnNotifications();
    } else {
        await refreshReturnNotifications("opt_in");
    }
    runtimeServices.track("notifications_pref_changed", {
        enabled,
        result,
    });
    return result;
}

export async function cancelAllReturnNotifications(): Promise<void> {
    for (const reminder of RETURN_REMINDERS) {
        await cancelLocalNotification(reminder.id);
    }
}

/**
 * Re-arm the full return cadence from "now". Call while the player is active
 * (boot after first play, leaving a level, returning to menu).
 */
export async function refreshReturnNotifications(reason: string): Promise<void> {
    if (!optedIn()) return;
    let scheduled = 0;
    for (const reminder of RETURN_REMINDERS) {
        const ok = await rearmLocalNotification({
            id: reminder.id,
            title: reminder.title,
            body: reminder.body,
            delaySeconds: reminder.delaySeconds,
        });
        if (ok) scheduled += 1;
    }
    if (scheduled > 0) {
        runtimeServices.track("retention_notification_scheduled", {
            reason,
            count: scheduled,
            primary_delay_s: RETURN_REMINDERS[0]?.delaySeconds ?? 0,
        });
    }
}

/** Attribute notification-driven launches; fire once per boot. */
export async function resolveReturnNotificationLaunch(): Promise<void> {
    const intent = await resolveLaunchIntent();
    if (!intent) {
        runtimeServices.track("launch_intent", { kind: "unknown_or_organic" });
        return;
    }
    const reminderId = intent.params.reminder_id ?? intent.params.retention_id ?? "";
    runtimeServices.track("launch_intent", {
        kind: intent.kind,
        reminder_id: reminderId || "none",
    });
    if (intent.kind === "notification" || reminderId) {
        analytics.event("retention_notification_opened", {
            launch_kind: intent.kind,
            reminder_id: reminderId || "unknown",
        });
        analytics.event("retention_return_play", {
            launch_kind: intent.kind,
            reminder_id: reminderId || "unknown",
            levels_completed: store.get().levelsCompleted,
        });
    }
}
