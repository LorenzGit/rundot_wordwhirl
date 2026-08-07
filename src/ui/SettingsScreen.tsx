import { useEffect } from "react";
import { audioManager } from "../audio/audioManager.ts";
import { recordScreenView, recordSettingsChanged } from "../systems/gameAnalytics.ts";
import { setNotificationsOptIn } from "../systems/retention/returnNotifications.ts";
import { saveSystem } from "../systems/save.ts";
import { runtimeServices } from "../systems/runtimeServices.ts";
import { store, useStore, type AppState } from "../state/store.ts";
import MenuScreenLayout from "./MenuScreenLayout.tsx";

function persist(patch: Partial<AppState>): void {
    store.patch(patch);
    void saveSystem.flush();
    for (const [key, value] of Object.entries(patch)) {
        if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
            recordSettingsChanged(key, value);
        }
    }
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange(value: boolean): void }) {
    return (
        <label className="setting-row">
            <span>{label}</span>
            <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
        </label>
    );
}

export default function SettingsScreen() {
    const state = useStore((value) => value);
    useEffect(() => {
        recordScreenView("settings");
    }, []);
    const testHaptic = async () => {
        audioManager.play("reward");
        const sent = await runtimeServices.haptic("success");
        store.patch({ toast: sent ? "HAPTIC SENT" : "HAPTICS NEED A SUPPORTED DEVICE" });
    };
    const toggleNotifications = async (value: boolean) => {
        const result = await setNotificationsOptIn(value);
        void saveSystem.flush();
        if (value && result === "unavailable") {
            store.patch({ toast: "NOTIFICATIONS NEED A RUN HOST" });
        } else if (value && result === "failed") {
            store.patch({ toast: "NOTIFICATION PERMISSION FAILED" });
        }
    };
    return (
        <MenuScreenLayout title="SETTINGS" kicker="COMFORT + ACCESS">
            <div className="settings-list">
                <Toggle
                    label="MUSIC"
                    checked={state.musicEnabled}
                    onChange={(value) => persist({ musicEnabled: value })}
                />
                <label className="setting-slider">
                    <span>MUSIC VOLUME</span>
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={state.musicVolume}
                        onChange={(event) => persist({ musicVolume: Number(event.target.value) })}
                    />
                </label>
                <Toggle
                    label="SOUND EFFECTS"
                    checked={state.sfxEnabled}
                    onChange={(value) => persist({ sfxEnabled: value })}
                />
                <label className="setting-slider">
                    <span>SFX VOLUME</span>
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={state.sfxVolume}
                        onChange={(event) => persist({ sfxVolume: Number(event.target.value) })}
                    />
                </label>
                <div className="setting-row">
                    <span>HAPTICS</span>
                    <div className="setting-actions">
                        <input
                            aria-label="Haptics"
                            type="checkbox"
                            checked={state.hapticsEnabled}
                            onChange={(event) => persist({ hapticsEnabled: event.target.checked })}
                        />
                        <button type="button" disabled={!state.hapticsEnabled} onClick={() => void testHaptic()}>
                            TEST
                        </button>
                    </div>
                </div>
                <Toggle
                    label="REDUCED MOTION"
                    checked={state.reducedMotion}
                    onChange={(value) => {
                        document.documentElement.dataset.reducedMotion = String(value);
                        persist({ reducedMotion: value });
                    }}
                />
                <Toggle
                    label="RETURN REMINDERS"
                    checked={state.notificationsEnabled}
                    onChange={(value) => void toggleNotifications(value)}
                />
                <div className="setting-row">
                    <span>RENDER QUALITY</span>
                    <div className="segmented">
                        <button
                            type="button"
                            className={state.quality === "low" ? "active" : ""}
                            onClick={() => {
                                document.documentElement.dataset.quality = "low";
                                persist({ quality: "low" });
                            }}
                        >
                            LOW
                        </button>
                        <button
                            type="button"
                            className={state.quality === "high" ? "active" : ""}
                            onClick={() => {
                                document.documentElement.dataset.quality = "high";
                                persist({ quality: "high" });
                            }}
                        >
                            HIGH
                        </button>
                    </div>
                </div>
            </div>
            <p className="safety-note">
                Audio pauses for host overlays and backgrounding. Haptics are optional and never carry meaning alone.
                Return reminders re-arm after play (about 1–3 days) and cancel when you opt out.
            </p>
        </MenuScreenLayout>
    );
}
