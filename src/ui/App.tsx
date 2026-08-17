import { useEffect } from "react";
import { audioManager } from "../audio/audioManager.ts";
import GameCanvas from "../game/GameCanvas.tsx";
import { ensureLevelResult } from "../game/gameController.ts";
import { skyCssUrlForLevel } from "../game/skies.ts";
import { applyRunSafeArea } from "../sdk/runSdk.ts";
import { store, useStore } from "../state/store.ts";
import HowToScreen from "./HowToScreen.tsx";
import Hud from "./Hud.tsx";
import LoadingScreen from "./LoadingScreen.tsx";
import MainMenu from "./MainMenu.tsx";
import ResultsOverlay from "./ResultsOverlay.tsx";
import RouteScreen from "./RouteScreen.tsx";
import SettingsScreen from "./SettingsScreen.tsx";
import ShopScreen from "./ShopScreen.tsx";
import { useButtonFeedback } from "./useButtonFeedback.ts";
import type { CSSProperties } from "react";

const TOAST_HIDE_MS = 2_800;

function useOrientationSafeArea(): void {
    useEffect(() => {
        let pending = 0;
        const refresh = () => applyRunSafeArea();
        const resize = () => {
            window.cancelAnimationFrame(pending);
            pending = window.requestAnimationFrame(refresh);
        };
        window.addEventListener("orientationchange", refresh);
        window.addEventListener("resize", resize, { passive: true });
        return () => {
            window.removeEventListener("orientationchange", refresh);
            window.removeEventListener("resize", resize);
            window.cancelAnimationFrame(pending);
        };
    }, []);
}

function useAudioUnlock(): void {
    useEffect(() => {
        const unlock = () => void audioManager.unlock();
        window.addEventListener("pointerdown", unlock, { once: true, capture: true });
        window.addEventListener("keydown", unlock, { once: true, capture: true });
        return () => {
            window.removeEventListener("pointerdown", unlock, { capture: true });
            window.removeEventListener("keydown", unlock, { capture: true });
        };
    }, []);
}

function MenuRoute() {
    const screen = useStore((state) => state.menuScreen);
    if (screen === "route") return <RouteScreen />;
    if (screen === "shop") return <ShopScreen />;
    if (screen === "settings") return <SettingsScreen />;
    if (screen === "how-to") return <HowToScreen />;
    return <MainMenu />;
}

export default function App() {
    useOrientationSafeArea();
    useAudioUnlock();
    useButtonFeedback();
    const phase = useStore((state) => state.phase);
    const level = useStore((state) => state.level);
    // Menu stays on the dawn plate; gameplay advances through all 12 level skies.
    const skyLevel = phase === "playing" ? level : 1;
    const skyCss = skyCssUrlForLevel(skyLevel);
    const skyStyle = { ["--wordwhirl-sky" as string]: skyCss } as CSSProperties;

    useEffect(() => {
        if (phase === "loading") return;
        const cover = document.getElementById("boot-cover");
        if (!cover) return;
        cover.classList.add("hidden");
        const timeout = window.setTimeout(() => cover.remove(), 400);
        return () => window.clearTimeout(timeout);
    }, [phase]);

    useEffect(() => {
        document.documentElement.style.setProperty("--wordwhirl-sky", skyCss);
        document.body.dataset.sky = `l${String(skyLevel).padStart(2, "0")}`;
        return () => {
            document.documentElement.style.removeProperty("--wordwhirl-sky");
            delete document.body.dataset.sky;
        };
    }, [skyCss, skyLevel]);

    // Recover a fully-solved board with no ephemeral result (save/reload dead end).
    // Re-run when `level` changes so a mid-session route advance is covered.
    useEffect(() => {
        if (phase !== "playing") return;
        void level;
        ensureLevelResult({ grantRewards: false });
    }, [phase, level]);

    return (
        <div id="app-frame" tabIndex={-1} data-sky={`l${String(skyLevel).padStart(2, "0")}`} style={skyStyle}>
            {phase === "loading" && <LoadingScreen />}
            {phase === "menu" && <MenuRoute />}
            {phase === "playing" && (
                <div className="game-layer">
                    <GameCanvas key={level} />
                    <Hud />
                </div>
            )}
            {/* Above the canvas/HUD so completion UI cannot be buried under Pixi. */}
            {phase === "playing" && <ResultsOverlay />}
            <Toast />
        </div>
    );
}

function Toast() {
    const toast = useStore((state) => state.toast);
    const seq = useStore((state) => state.toastSeq);
    useEffect(() => {
        if (!toast) return;
        const timeout = window.setTimeout(() => {
            // Do not let an older toast's timer dismiss a newer message. The
            // seq comparison (not the text) keeps a repeated identical toast
            // alive for its own full duration.
            if (store.get().toastSeq === seq) store.patch({ toast: null });
        }, TOAST_HIDE_MS);
        return () => window.clearTimeout(timeout);
    }, [toast, seq]);
    if (!toast) return null;
    return (
        <button type="button" className="toast" aria-live="polite" onClick={() => store.patch({ toast: null })}>
            {toast}
        </button>
    );
}
