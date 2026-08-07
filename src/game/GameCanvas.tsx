import { useEffect, useRef } from "react";
import type { Application } from "pixi.js";
import { abandonWordwhirlLevel, wordwhirlLevelAnalytics } from "../systems/gameAnalytics.ts";
import { store, useStore } from "../state/store.ts";
import {
    acquireRendererRuntime,
    type RendererLease,
    type RendererLifecycleScope,
} from "../rendering/rendererLifecycle.ts";
import { createPixiApp } from "./pixiApp.ts";
import { createStage, type Stage } from "./stage.ts";
import { createWordScene, type Scene } from "./wordScene.ts";

interface GameRenderer {
    app: Application;
}

async function initializeGameRenderer(scope: RendererLifecycleScope, host: HTMLElement): Promise<GameRenderer> {
    const app = await createPixiApp(scope, host);
    scope.throwIfCancelled();
    const stage: Stage = createStage(app);
    scope.manage(() => stage.destroy());
    const scene: Scene = createWordScene(app, stage);
    scope.manage(() => scene.destroy());
    if (store.get().paused || document.hidden) app.ticker.stop();
    return { app };
}

export default function GameCanvas() {
    const hostRef = useRef<HTMLDivElement | null>(null);
    const appRef = useRef<Application | null>(null);
    const paused = useStore((state) => state.paused);

    useEffect(() => {
        const host = hostRef.current;
        if (!host) return;
        const abortController = new AbortController();
        let lease: RendererLease<GameRenderer> | null = null;
        void acquireRendererRuntime("wordwhirl-pixi", abortController.signal, (scope) =>
            initializeGameRenderer(scope, host),
        )
            .then((nextLease) => {
                lease = nextLease;
                appRef.current = nextLease.value.app;
            })
            .catch((error: unknown) => {
                if (abortController.signal.aborted || (error instanceof DOMException && error.name === "AbortError"))
                    return;
                console.error("[renderer] Pixi initialization failed", error);
                abandonWordwhirlLevel("renderer_error");
                store.patch({ phase: "menu", menuScreen: "main", toast: "THE SKY COULD NOT RENDER ON THIS DEVICE" });
            });
        return () => {
            abortController.abort();
            appRef.current = null;
            void lease?.release();
        };
    }, []);

    useEffect(() => {
        const app = appRef.current;
        if (!app) return;
        if (paused || document.hidden) app.ticker.stop();
        else app.ticker.start();
    }, [paused]);

    useEffect(() => {
        const syncVisibility = () => {
            const app = appRef.current;
            wordwhirlLevelAnalytics.setPaused("document_hidden", document.hidden);
            if (!app) return;
            if (document.hidden || store.get().paused) app.ticker.stop();
            else app.ticker.start();
        };
        syncVisibility();
        document.addEventListener("visibilitychange", syncVisibility);
        return () => document.removeEventListener("visibilitychange", syncVisibility);
    }, []);

    return <div ref={hostRef} className="pixi-host" />;
}
