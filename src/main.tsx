import React from "react";
import { createRoot } from "react-dom/client";
import App from "./ui/App.tsx";
import ErrorBoundary from "./ui/ErrorBoundary.tsx";
import { analytics } from "./systems/analytics/analyticsConfig.ts";
import { audioManager } from "./audio/audioManager.ts";
import { warmAssets } from "./assets/preload.ts";
import { leaveLevel } from "./game/gameController.ts";
import { installBrowserQaContract } from "./qa/browserContract.ts";
import {
    applyRunSafeArea,
    getRunCapabilities,
    initSdk,
    readAttribution,
    registerLifecycles,
    requestHostExit,
} from "./sdk/runSdk.ts";
import { store } from "./state/store.ts";
import { resumeFromHostPause, setHostPaused } from "./systems/hostPause.ts";
import { reconcilePendingPurchase } from "./systems/monetization/commerce.ts";
import { runtimeServices } from "./systems/runtimeServices.ts";
import { saveSystem } from "./systems/save.ts";
import "./styles/app.css";

function liftBootCover(): void {
    const cover = document.getElementById("boot-cover");
    if (!cover || cover.classList.contains("hidden")) return;
    cover.classList.add("hidden");
    cover.setAttribute("aria-busy", "false");
    window.setTimeout(() => cover.remove(), 400);
}

function setBootProgress(progress: number): void {
    const bounded = Math.max(0, Math.min(1, progress));
    const percent = Math.round(bounded * 100);
    store.patch({ loadProgress: bounded });
    const cover = document.getElementById("boot-cover");
    const fill = document.getElementById("boot-fill");
    const copy = document.getElementById("boot-copy");
    if (cover) {
        cover.classList.add("is-determinate");
        cover.setAttribute("aria-valuenow", String(percent));
    }
    if (fill) fill.style.width = `${Math.max(5, percent)}%`;
    if (copy) copy.textContent = percent >= 100 ? "TAILWIND CAUGHT" : `CHARTING THE SKY… ${percent}%`;
}

analytics.installErrorCapture();
analytics.funnelStep("load", 1);

async function boot(): Promise<void> {
    const rootElement = document.getElementById("root");
    if (!rootElement) throw new Error("Missing #root");
    createRoot(rootElement).render(
        <React.StrictMode>
            <ErrorBoundary>
                <App />
            </ErrorBoundary>
        </React.StrictMode>,
    );

    setBootProgress(0.05);
    await Promise.all([
        initSdk().then(() => {
            analytics.markTransportReady();
            analytics.funnelStep("load", 2, { host: getRunCapabilities().host });
            applyRunSafeArea();
        }),
        saveSystem.load().then(() => {
            document.documentElement.dataset.reducedMotion = String(store.get().reducedMotion);
            document.documentElement.dataset.quality = store.get().quality;
            audioManager.bind();
            analytics.funnelStep("load", 3);
        }),
    ]);
    setBootProgress(0.15);
    await warmAssets((progress) => setBootProgress(0.15 + progress * 0.85));
    setBootProgress(1);
    analytics.funnelStep("load", 4);
    store.patch({ phase: "menu", loadProgress: 1 });
    requestAnimationFrame(() => requestAnimationFrame(liftBootCover));

    if (import.meta.env.DEV) {
        const { applyDevelopmentScreenPreview } = await import("./dev/preview.ts");
        applyDevelopmentScreenPreview();
    }

    registerLifecycles({
        onPause: () => {
            setHostPaused("host_pause", true);
            void saveSystem.flush();
        },
        onResume: () => setHostPaused("host_pause", false),
        onSleep: () => {
            setHostPaused("host_sleep", true);
            void saveSystem.flush();
            analytics.sessionPause();
        },
        onAwake: () => {
            setHostPaused("host_sleep", false);
            runtimeServices.resume();
            void reconcilePendingPurchase();
        },
        onQuit: () => {
            void saveSystem.flush();
            analytics.sessionEnd();
        },
        onIdentityChanged: (event) => {
            if (event.idChanged) window.location.reload();
            else runtimeServices.resume();
        },
        onBackButton: () => {
            const state = store.get();
            if (state.phase === "playing") {
                resumeFromHostPause();
                leaveLevel();
            } else if (state.menuScreen !== "main") {
                store.patch({ menuScreen: "main" });
            } else {
                void requestHostExit();
            }
        },
    });

    runtimeServices.bootstrap();
    analytics.funnelStep("ftue", 1);
    analytics.funnelStep("ftue", 2);
    analytics.funnelStep("onboarding", 1);
    analytics.sessionStart(store.get().levelsCompleted === 0, await readAttribution());

    const { resolveReturnNotificationLaunch, refreshReturnNotifications } = await import(
        "./systems/retention/returnNotifications.ts"
    );
    await resolveReturnNotificationLaunch();
    if (store.get().levelsCompleted > 0 || store.get().lifetimeWords > 0) {
        void refreshReturnNotifications("boot_return");
    }

    installBrowserQaContract();
}

function preventBrowserChrome(event: Event): void {
    event.preventDefault();
}

document.addEventListener("selectstart", preventBrowserChrome);
document.addEventListener("contextmenu", preventBrowserChrome);
document.addEventListener("dragstart", preventBrowserChrome);
window.addEventListener("unhandledrejection", (event) => {
    console.warn("[runtime] guarded unhandled rejection", event.reason);
    event.preventDefault();
});

function start(): void {
    void boot().catch((error) => {
        console.error("[boot] fatal startup failure", error);
        analytics.trackError("boot_failure", error);
        analytics.markTransportReady();
        liftBootCover();
        const root = document.getElementById("root");
        if (!root) return;
        root.innerHTML =
            '<main class="fatal-error" role="alert"><h1>THE WIND DROPPED</h1><p>Reload to chart the route again.</p></main>';
    });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
else start();
